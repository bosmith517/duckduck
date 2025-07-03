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
    // 4. Heuristic blanks ( “_____” / “….” ) if needed
    // ─────────────────────────────────────────
    if (fields.length === 0) {
      const pdf = await getDocument({ data: pdfBytes }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc   = await page.getTextContent();
        fullText  += tc.items.map((it: any) => it.str).join(" ") + "\n";
      }

      const blankRegex =
        /([A-Z][\w\s]+?):?\s*(?:_{4,}|\.{4,}|—{2,})/gi;
      let m;
      while ((m = blankRegex.exec(fullText))) {
        fields.push({ fieldName: m[1].trim(), fieldType: "text" });
      }
    }

    // ─────────────────────────────────────────
    // 5. Optional GPT enrichment
    // ─────────────────────────────────────────
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_API_KEY && fields.some(f => !f.suggestedValue)) {
      const prompt = `Given this JSON array of form-like fields, add a sensible
suggestedValue, fieldType (text, date, checkbox, etc.) and confidence 0-100
for each.  Return ONLY valid JSON { "fields": [...] }.

${JSON.stringify(fields, null, 2)}`;

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method : "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      });

      if (resp.ok) {
        try {
          const { choices } = await resp.json();
          const gpt = JSON.parse(choices[0].message.content);
          if (Array.isArray(gpt.fields)) fields = gpt.fields;
        } catch { /* ignore bad JSON */ }
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
