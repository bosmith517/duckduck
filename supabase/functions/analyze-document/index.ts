import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib";
import { getDocument } from "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = req.headers.get("content-type")?.includes("application/json")
      ? await req.json()
      : {};

    const { bucket = "business-documents", path, documentUrl } = body;

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get PDF bytes
    let pdfBytes: Uint8Array;
    if (documentUrl) {
      const res = await fetch(documentUrl);
      if (!res.ok) throw new Error(`Failed to fetch document: ${res.statusText}`);
      pdfBytes = new Uint8Array(await res.arrayBuffer());
    } else if (path) {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw new Error(`Storage error: ${error.message}`);
      pdfBytes = new Uint8Array(await data.arrayBuffer());
    } else {
      throw new Error("Either documentUrl or path must be provided");
    }

    // Analyze PDF
    let fields: any[] = [];

    // Try to extract form fields
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, { throwOnInvalidObject: false });
      const form = pdfDoc.getForm();
      
      for (const field of form.getFields()) {
        fields.push({
          fieldName: field.getName(),
          fieldType: field.constructor.name.replace(/^PDF|Field$/g, "").toLowerCase(),
          currentValue: (field as any).getText?.() || (field as any).isChecked?.() || ""
        });
      }
    } catch (e) {
      console.log("No AcroForm fields found, using text analysis");
    }

    // If no form fields, analyze text
    if (fields.length === 0) {
      const pdf = await getDocument({ data: pdfBytes }).promise;
      
      for (let i = 1; i <= Math.min(2, pdf.numPages); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        
        // Look for common field patterns
        const patterns = [
          /([A-Za-z\s]+):\s*_{3,}/g,
          /([A-Za-z\s]+):\s*\.{3,}/g,
          /\b(Name|Address|Phone|Email|Date|Signature)\b/gi
        ];
        
        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(pageText))) {
            const fieldName = match[1].trim();
            if (!fields.find(f => f.fieldName === fieldName)) {
              fields.push({
                fieldName,
                fieldType: guessFieldType(fieldName),
                suggestedValue: ""
              });
            }
          }
        });
      }
    }

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        documentName: path || "document.pdf",
        fields: fields.length > 0 ? fields : getDefaultFields()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

function guessFieldType(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  if (lower.includes("email")) return "email";
  if (lower.includes("phone")) return "phone";
  if (lower.includes("date")) return "date";
  if (lower.includes("signature")) return "signature";
  return "text";
}

function getDefaultFields() {
  return [
    { fieldName: "Customer Name", fieldType: "text", suggestedValue: "John Smith" },
    { fieldName: "Address", fieldType: "text", suggestedValue: "123 Main St" },
    { fieldName: "Phone", fieldType: "phone", suggestedValue: "(555) 123-4567" },
    { fieldName: "Email", fieldType: "email", suggestedValue: "john@example.com" }
  ];
}