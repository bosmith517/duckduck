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

    // First, get the list of recordings for this room
    const listEndpoint = `https://${spaceUrl}/api/video/rooms/${roomName}/recordings`
    
    console.log('Getting recordings for room:', roomName)
    
    const listResponse = await fetch(listEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`${projectId}:${apiToken}`)}`
      }
    })

    if (!listResponse.ok) {
      const errorText = await listResponse.text()
      console.error('SignalWire API error:', errorText)
      throw new Error(`Failed to list recordings: ${listResponse.status} - ${errorText}`)
    }

    const recordings = await listResponse.json()
    
    // Find the active recording
    const activeRecording = recordings.data?.find((r: any) => r.state === 'recording')
    
    if (!activeRecording) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active recording found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Stop the active recording
    const stopEndpoint = `https://${spaceUrl}/api/video/recordings/${activeRecording.id}`
    
    const stopResponse = await fetch(stopEndpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${btoa(`${projectId}:${apiToken}`)}`
      }
    })

    if (!stopResponse.ok) {
      const errorText = await stopResponse.text()
      console.error('SignalWire API error:', errorText)
      throw new Error(`Failed to stop recording: ${stopResponse.status} - ${errorText}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        recordingId: activeRecording.id,
        videoUrl: activeRecording.url || '',
        message: 'Recording stopped successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error stopping recording:', error)
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