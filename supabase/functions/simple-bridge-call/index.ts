// Simple call bridging - when outbound call is answered, it calls back to a specified number
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // This is called by SignalWire when the outbound call is answered
    // We'll create LaML to bridge the call to your phone number
    
    const url = new URL(req.url)
    const bridgeToNumber = url.searchParams.get('bridge_to') || '+1234567890' // Your phone number
    
    // Create LaML to dial your phone when the outbound call is answered
    const laML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Connecting your call, please hold.</Say>
    <Dial timeout="30">
        <Number>${bridgeToNumber}</Number>
    </Dial>
    <Say>The call could not be completed. Goodbye.</Say>
    <Hangup/>
</Response>`

    return new Response(laML, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
      status: 200,
    })

  } catch (error) {
    console.error("Error in simple-bridge-call:", error.message)
    const errorLaML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>We're sorry, an error has occurred.</Say>
    <Hangup/>
</Response>`
    return new Response(errorLaML, { 
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' }, 
      status: 500 
    })
  }
})