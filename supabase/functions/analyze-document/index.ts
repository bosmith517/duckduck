// /supabase/functions/document-analyzer/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6?dts";
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib?dts";
import { getDocument } from "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.mjs";
import { encode } from "https://deno.land/std@0.203.0/encoding/base64.ts";

// ─────────────────────────────────────────────
// 0.  DEFAULT LOCATION OF *YOUR* PDF
//     (will be used when caller sends no body)
// ─────────────────────────────────────────────
const DEFAULT_BUCKET = "business-documents";
const DEFAULT_PATH =
  "6136304e-5b88-4cc6-b0e7-615f9e2f543c/documents/1751457011565_Residential Home Improvement Contract.pdf";

// Types
interface FieldResult {
  fieldName: string;
  fieldType: string;           // text | date | signature | checkbox …
  currentValue?: string | boolean;
  suggestedValue?: string;
  confidence?: number;         // 0-100
}

// CORS helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Helper function to generate suggested values based on field name/type
function generateSuggestedValue(fieldName: string, fieldType: string): string {
  const lowerName = fieldName.toLowerCase();
  
  // For signature fields, return empty
  if (fieldType === "signature") return "";
  
  // Common field patterns
  if (lowerName.includes("name") && !lowerName.includes("company") && !lowerName.includes("business")) {
    if (lowerName.includes("first")) return "John";
    if (lowerName.includes("last")) return "Smith";
    if (lowerName.includes("middle")) return "M";
    return "John Smith";
  }
  
  if (lowerName.includes("email")) return "john.smith@example.com";
  if (lowerName.includes("phone") || lowerName.includes("mobile") || lowerName.includes("cell")) return "(555) 123-4567";
  if (lowerName.includes("address") || lowerName.includes("street")) return "123 Main Street";
  if (lowerName.includes("city")) return "Anytown";
  if (lowerName.includes("state")) return "CA";
  if (lowerName.includes("zip") || lowerName.includes("postal")) return "12345";
  if (lowerName.includes("date") && !lowerName.includes("birth")) return new Date().toISOString().split('T')[0];
  if (lowerName.includes("birth") || lowerName.includes("dob")) return "1990-01-01";
  if (lowerName.includes("company") || lowerName.includes("business")) return "Acme Corporation";
  if (lowerName.includes("ssn") || lowerName.includes("social")) return "XXX-XX-1234";
  if (lowerName.includes("license") || lowerName.includes("driver")) return "D1234567";
  
  // For checkboxes/radio, return false/unchecked by default
  if (fieldType === "checkbox" || fieldType === "radio") return "false";
  
  // Default empty for other fields
  return "";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─────────────────────────────────────────
    // 1. Parse request or fall back to defaults
    // ─────────────────────────────────────────
    const body = req.headers.get("content-type")?.includes("application/json")
      ? await req.json().catch(() => ({}))
      : {};

    const bucket = body.bucket ?? DEFAULT_BUCKET;
    const path   = body.path   ?? DEFAULT_PATH;
    const documentUrl = body.documentUrl;
    const documentName = path.split("/").pop() ?? "document.pdf";

    // ─────────────────────────────────────────
    // 2. Fetch PDF bytes
    // ─────────────────────────────────────────
    let pdfBytes: Uint8Array;

    if (documentUrl) {
      // Public or signed URL path
      const res = await fetch(documentUrl);
      if (!res.ok) throw new Error(`Could not fetch document → ${res.statusText}`);
      pdfBytes = new Uint8Array(await res.arrayBuffer());
    } else {
      // Storage fetch with service-role key (never expires)
      const supabaseUrl   = Deno.env.get("SUPABASE_URL")!;
      const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase      = createClient(supabaseUrl, serviceKey);

      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw new Error(`Storage download failed → ${error.message}`);
      pdfBytes = new Uint8Array(await data.arrayBuffer());
    }

    // ─────────────────────────────────────────
    // 3. Extract AcroForm fields if present
    // ─────────────────────────────────────────
    let fields: FieldResult[] = [];

    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, { throwOnInvalidObject: false });
      const form = pdfDoc.getForm();
      for (const f of form.getFields()) {
        const name = f.getName();
        const ctor = f.constructor.name;                    // e.g. PDFTextField
        const type = ctor.replace(/^PDF|Field$/g, "").toLowerCase();
        const val  = (f as any).getText?.() ?? (f as any).isChecked?.();
        fields.push({ fieldName: name, fieldType: type, currentValue: val });
      }
    } catch { /* no AcroForm – will fall back to heuristic */ }

    // ─────────────────────────────────────────
    // 4. Heuristic blanks ( "_____" / "…." ) if needed
    // ─────────────────────────────────────────
    if (fields.length === 0) {
      const pdf = await getDocument({ data: pdfBytes }).promise;
      let pageTexts: string[] = [];
      const fieldSet = new Set<string>(); // To avoid duplicates

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc   = await page.getTextContent();
        
        // Preserve line breaks better by grouping text by Y position
        const textByLine: { [y: number]: string[] } = {};
        
        tc.items.forEach((item: any) => {
          const y = Math.round(item.transform[5]); // Y position
          if (!textByLine[y]) textByLine[y] = [];
          textByLine[y].push(item.str);
        });
        
        // Sort by Y position (descending, as PDF Y coordinates go from bottom to top)
        const sortedYs = Object.keys(textByLine)
          .map(Number)
          .sort((a, b) => b - a);
        
        let pageText = "";
        sortedYs.forEach(y => {
          pageText += textByLine[y].join(" ") + "\n";
        });
        
        pageTexts.push(pageText);
      }

      const fullText = pageTexts.join("\n");
      
      // Multiple regex patterns to catch different field formats
      const patterns = [
        // Pattern 1: Field with underscores (Name: ____________)
        /([A-Za-z][A-Za-z\s\-']+?):\s*_{3,}/gi,
        
        // Pattern 2: Field with dots (Name: .............)
        /([A-Za-z][A-Za-z\s\-']+?):\s*\.{3,}/gi,
        
        // Pattern 3: Field with dashes (Name: ----------)
        /([A-Za-z][A-Za-z\s\-']+?):\s*-{3,}/gi,
        
        // Pattern 4: Field in brackets [Name] or (Name)
        /[\[(]([A-Za-z][A-Za-z\s\-']+?)[\])]\s*(?:_{2,}|\.{2,}|-{2,})?/gi,
        
        // Pattern 5: Field followed by blank line or space (Name \n________)
        /([A-Za-z][A-Za-z\s\-']+?)\s*\n\s*(?:_{3,}|\.{3,}|-{3,})/gi,
        
        // Pattern 6: Common form fields without indicators
        /\b(Name|First Name|Last Name|Middle Name|Address|Street|City|State|Zip|ZIP Code|Phone|Phone Number|Mobile|Cell|Email|Email Address|Date|Date of Birth|DOB|SSN|Social Security|License|Driver's License|Signature|Sign|Initial|Company|Business|Employer|Position|Title|Emergency Contact|Reference)\b(?:\s*:)?\s*$/gim,
        
        // Pattern 7: Fields with colons but no blanks (Name:)
        /([A-Za-z][A-Za-z\s\-']+?):\s*$/gm,
        
        // Pattern 8: Checkbox patterns (□ Option or ☐ Option)
        /[□☐]\s*([A-Za-z][A-Za-z\s\-']+)/gi,
        
        // Pattern 9: Radio button patterns (○ Option or ◯ Option)
        /[○◯]\s*([A-Za-z][A-Za-z\s\-']+)/gi
      ];

      // Apply all patterns
      patterns.forEach(regex => {
        let match;
        while ((match = regex.exec(fullText))) {
          const fieldName = match[1].trim();
          
          // Clean up field name
          const cleanedName = fieldName
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '')
            .replace(/\s*:$/, '');
          
          // Skip if too short or too long
          if (cleanedName.length < 2 || cleanedName.length > 50) continue;
          
          // Skip if it's all caps and longer than 10 chars (likely a heading)
          if (cleanedName === cleanedName.toUpperCase() && cleanedName.length > 10) continue;
          
          // Add to set to avoid duplicates
          fieldSet.add(cleanedName);
        }
      });

      // Convert set to array and determine field types
      fieldSet.forEach(fieldName => {
        let fieldType = "text";
        
        // Determine field type based on name
        const lowerName = fieldName.toLowerCase();
        if (lowerName.includes("date") || lowerName.includes("dob")) {
          fieldType = "date";
        } else if (lowerName.includes("signature") || lowerName.includes("sign") || lowerName.includes("initial")) {
          fieldType = "signature";
        } else if (lowerName.includes("phone") || lowerName.includes("mobile") || lowerName.includes("cell")) {
          fieldType = "phone";
        } else if (lowerName.includes("email")) {
          fieldType = "email";
        } else if (lowerName.includes("checkbox") || lowerName.includes("check")) {
          fieldType = "checkbox";
        } else if (fullText.includes(`□ ${fieldName}`) || fullText.includes(`☐ ${fieldName}`)) {
          fieldType = "checkbox";
        } else if (fullText.includes(`○ ${fieldName}`) || fullText.includes(`◯ ${fieldName}`)) {
          fieldType = "radio";
        }
        
        fields.push({ fieldName, fieldType });
      });
    }

    // ─────────────────────────────────────────
    // 5. Enhanced GPT-4 Analysis
    // ─────────────────────────────────────────
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_API_KEY) {
      try {
        console.log("Starting enhanced GPT-4 analysis...");
        
        // For GPT-4 Vision, we need to convert PDF to images
        // However, since PDF-to-image conversion requires external services
        // and can be complex in Deno, we'll use an enhanced text-based approach
        // that preserves document structure better
        
        // Extract comprehensive document structure
        const pdf = await getDocument({ data: pdfBytes }).promise;
        let documentPages: any[] = [];
        
        for (let i = 1; i <= Math.min(2, pdf.numPages); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1.0 });
          
          // Create a visual representation of the page
          let pageMap: string[] = new Array(Math.ceil(viewport.height / 10)).fill('');
          
          textContent.items.forEach((item: any) => {
            const x = Math.round(item.transform[4] / 10);
            const y = Math.round(item.transform[5] / 10);
            const row = Math.floor(viewport.height / 10) - y;
            
            if (row >= 0 && row < pageMap.length) {
              // Pad the string to the x position
              while (pageMap[row].length < x) {
                pageMap[row] += ' ';
              }
              pageMap[row] += item.str;
            }
          });
          
          documentPages.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
            textMap: pageMap.join('\n'),
            items: textContent.items
          });
        }
        
        // Create a comprehensive prompt for GPT-4
        const analysisPrompt = `You are analyzing a PDF form. I'll provide you with the text layout from the document.

DOCUMENT STRUCTURE:
${documentPages.map(p => `
=== PAGE ${p.pageNumber} (${Math.round(p.width)}x${Math.round(p.height)}px) ===
${p.textMap}
`).join('\n')}

INSTRUCTIONS:
Identify ALL fillable fields in this form. Look for:
1. Text followed by lines, underscores, dots: "Name: _____" or "Address: ....."
2. Empty spaces after labels where users would write
3. Checkbox indicators: □, ☐, [ ], ( ) 
4. Fields in tables or structured layouts
5. Common form fields: Name, Address, Phone, Email, Date, Signature, SSN, etc.
6. Any label followed by blank space or lines

For each field found, provide:
- fieldName: exact label from the form
- fieldType: text, checkbox, radio, signature, date, phone, email, number, etc.
- required: true if marked with * or "required"
- location: which page and approximate position

Be thorough - identify EVERY possible field, even if uncertain.

Return ONLY valid JSON: { "fields": [...] }`;

        // Send to GPT-4 for analysis
        const gptResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.1,
            max_tokens: 4000
          })
        });

        if (gptResp.ok) {
          const { choices } = await gptResp.json();
          const gptResponse = choices[0].message.content;
          console.log("GPT-4 analysis complete");
          
          try {
            const gpt = JSON.parse(gptResponse);
            if (Array.isArray(gpt.fields) && gpt.fields.length > 0) {
              // Use GPT's enhanced analysis
              fields = gpt.fields.map((f: any) => ({
                fieldName: f.fieldName,
                fieldType: f.fieldType || "text",
                suggestedValue: generateSuggestedValue(f.fieldName, f.fieldType || "text"),
                confidence: f.confidence || 90,
                required: f.required || false,
                location: f.location || "",
                pageNumber: f.pageNumber || 1
              }));
              console.log(`GPT-4 identified ${fields.length} fields`);
            }
          } catch (parseError) {
            console.error("GPT response parse error:", parseError);
            console.log("GPT response:", gptResponse);
          }
        } else {
          console.error("GPT-4 API error:", await gptResp.text());
        }
      } catch (gptError: any) {
        console.error("GPT analysis error:", gptError);
        // Keep regex-detected fields as fallback
      }
    }

    // ─────────────────────────────────────────
    // 6. Respond
    // ─────────────────────────────────────────
    return new Response(
      JSON.stringify({ success: true, bucket, path, documentName, fields }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
