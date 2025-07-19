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
    const { testimonialId, roomName } = await req.json()

    if (!roomName) {
      throw new Error('Missing required parameter: roomName')
    }

    // Get SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')

    if (!projectId || !apiToken || !spaceUrl) {
      throw new Error('SignalWire credentials not configured')
    }

    // Use SignalWire REST API to start recording
    const recordingEndpoint = `https://${spaceUrl}/api/video/rooms/${roomName}/recordings`
    
    console.log('Starting recording for room:', roomName)
    
    const response = await fetch(recordingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${projectId}:${apiToken}`)}`
      },
      body: JSON.stringify({
        format: 'mp4'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SignalWire API error:', errorText)
      throw new Error(`Failed to start recording: ${response.status} - ${errorText}`)
    }

    const recordingData = await response.json()

    return new Response(
      JSON.stringify({
        success: true,
        recordingId: recordingData.id || 'recording-started',
        message: 'Recording started successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error starting recording:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})