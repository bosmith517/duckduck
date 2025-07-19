// supabase/functions/ai-video-laml/index.ts
//
// LaML endpoint that handles AI agent calls to join video rooms
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
    const formData = await req.formData()
    
    // SignalWire sends call data as form parameters
    const callSid = formData.get('CallSid')
    const from = formData.get('From')
    const to = formData.get('To')
    const direction = formData.get('Direction')
    
    console.log('AI Video LaML called:', { callSid, from, to, direction })
    
    // Extract room name from the To field (e.g., sip:room-name@domain)
    let roomName = ''
    if (to && to.includes('sip:')) {
      const match = to.match(/sip:([^@]+)@/)
      if (match) {
        roomName = match[1]
      }
    }
    
    // If no room name in To field, check custom parameters
    roomName = roomName || formData.get('RoomName') || formData.get('room_name') || ''
    
    console.log('Extracted room name:', roomName)
    
    if (!roomName) {
      // Return error LaML
      const errorLaml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Error: No room name provided for AI to join.</Say>
  <Hangup/>
</Response>`
      
      return new Response(errorLaml, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/xml' 
        },
      })
    }
    
    // Generate LaML to connect the AI to the video room
    const laml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting AI estimator to video session.</Say>
  <Connect>
    <Video room="${roomName}" />
    <AI>
      <Prompt>
        You are Alex, an AI estimation assistant for a home services company.
        You are joining a video estimation session to help analyze and document issues.
        
        Your role is to:
        1. Greet the customer warmly
        2. Guide them through showing different areas that need service
        3. Point out any issues you observe
        4. Ask for closer views when needed
        5. Document everything for the estimate
        
        Be professional, friendly, and thorough.
      </Prompt>
    </AI>
  </Connect>
</Response>`
    
    console.log('Returning LaML for room:', roomName)
    
    return new Response(laml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      },
    })
  } catch (error: any) {
    console.error('Error in AI Video LaML:', error)
    
    // Return error LaML
    const errorLaml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred connecting the AI assistant. Please try again.</Say>
  <Hangup/>
</Response>`
    
    return new Response(errorLaml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      },
    })
  }
})