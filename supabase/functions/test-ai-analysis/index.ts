// Simple test function for AI analysis debugging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  console.log('🚀 Test AI Analysis function called');
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') { 
    console.log('✅ Handling OPTIONS request');
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    }); 
  }
  
  try {
    console.log('📋 Processing POST request');
    
    const requestBody = await req.json();
    console.log('📦 Request body received:', requestBody);

    // Check environment variables
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    console.log('🔧 Environment check:', {
      hasOpenAiKey: !!openAiKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Test function working correctly',
      requestData: requestBody,
      environment: {
        hasOpenAiKey: !!openAiKey,
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseKey
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Error in test function:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});