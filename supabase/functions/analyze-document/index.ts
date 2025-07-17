// /supabase/functions/document-analyzer/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6?dts";
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib?dts";
import { getDocument } from "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.mjs";

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
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

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
    // 5. Optional GPT enrichment with full text context
    // ─────────────────────────────────────────
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_API_KEY) {
      // If we have few or no fields, or if we want to enhance existing fields
      if (fields.length < 5 || fields.some(f => !f.suggestedValue)) {
        // Get full text for context
        const pdf = await getDocument({ data: pdfBytes }).promise;
        let fullText = "";
        
        for (let i = 1; i <= Math.min(3, pdf.numPages); i++) { // First 3 pages for context
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          fullText += tc.items.map((it: any) => it.str).join(" ") + "\n";
        }
        
        const prompt = `Analyze this PDF form text and identify ALL fillable fields. 
Look for:
1. Fields with blanks (____), dots (....), or dashes (----)
2. Fields ending with colons (:)
3. Common form fields (name, address, phone, email, date, etc.)
4. Checkbox or radio button options
5. Signature lines
6. Any other fillable areas

PDF Text (first 3 pages):
${fullText.substring(0, 3000)}

Current detected fields:
${JSON.stringify(fields, null, 2)}

Please identify any additional fields I missed and enhance the existing ones.
For each field, provide:
- fieldName: clear, concise field name
- fieldType: text, date, phone, email, checkbox, radio, signature, etc.
- suggestedValue: a reasonable example value (leave empty for signatures)
- confidence: 0-100 how confident you are this is a fillable field

Return ONLY valid JSON in format: { "fields": [...] }`;

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method : "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 2000
          })
        });

        if (resp.ok) {
          try {
            const { choices } = await resp.json();
            const gptResponse = choices[0].message.content;
            const gpt = JSON.parse(gptResponse);
            if (Array.isArray(gpt.fields) && gpt.fields.length > 0) {
              fields = gpt.fields;
            }
          } catch (e) { 
            console.error("GPT JSON parse error:", e);
          }
        }
      }
    }

    // ─────────────────────────────────────────
    // 6. Respond
    // ─────────────────────────────────────────
    return new Response(
      JSON.stringify({ success: true, bucket, path, documentName, fields }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
