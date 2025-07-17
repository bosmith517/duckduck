import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

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
    // Parse request body
    const body = await req.json();
    console.log("Analyze document request:", body);

    // Mock response with common form fields
    const fields = [
      { 
        fieldName: "Customer Name", 
        fieldType: "text", 
        suggestedValue: "John Smith",
        confidence: 95
      },
      { 
        fieldName: "Service Address", 
        fieldType: "text", 
        suggestedValue: "123 Main Street, Anytown, USA",
        confidence: 90
      },
      { 
        fieldName: "Phone Number", 
        fieldType: "phone", 
        suggestedValue: "(555) 123-4567",
        confidence: 88
      },
      { 
        fieldName: "Email Address", 
        fieldType: "email", 
        suggestedValue: "customer@example.com",
        confidence: 85
      },
      { 
        fieldName: "Service Date", 
        fieldType: "date", 
        suggestedValue: new Date().toISOString().split('T')[0],
        confidence: 80
      },
      { 
        fieldName: "Service Type", 
        fieldType: "text", 
        suggestedValue: "",
        confidence: 75
      },
      { 
        fieldName: "Customer Signature", 
        fieldType: "signature", 
        suggestedValue: "",
        confidence: 95
      },
      { 
        fieldName: "Date Signed", 
        fieldType: "date", 
        suggestedValue: new Date().toISOString().split('T')[0],
        confidence: 90
      }
    ];

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        fields: fields,
        message: "Document analyzed successfully (using mock data)"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error: any) {
    console.error("Error in analyze-document:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Unknown error occurred"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});