// supabase/functions/test-simple-ai/index.ts
//
// Simple test to verify Edge Function deployment and environment
//

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    
    // Return all environment variables that start with SIGNALWIRE
    const envVars: Record<string, string> = {}
    for (const [key, value] of Object.entries(Deno.env.toObject())) {
      if (key.startsWith('SIGNALWIRE')) {
        // Mask sensitive values
        if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
          envVars[key] = value ? '***SET***' : 'NOT_SET'
        } else {
          envVars[key] = value || 'NOT_SET'
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test function working',
        environment: envVars,
        requestBody: body,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})