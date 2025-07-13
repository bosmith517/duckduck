import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the token
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { config } = await req.json()

    // SignalWire AI configuration
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireToken = Deno.env.get('SIGNALWIRE_TOKEN')
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')

    // Create SWML (SignalWire Markup Language) for AI assistant
    const swml = {
      version: '1.0.0',
      sections: {
        main: [
          {
            ai: {
              voice: config.voice,
              prompt: {
                temperature: 0.7,
                top_p: 0.9,
                text: generateAIPrompt(config)
              },
              post_prompt: {
                text: "Summarize the conversation and any action items."
              },
              params: {
                language: "en-US",
                direction: "inbound",
                wait_for_user: true,
                end_of_speech_timeout: 2000,
                attention_timeout: 15000,
                background_file: "https://cdn.signalwire.com/default-music/office.mp3",
                background_file_volume: 10,
                ai_volume: 0,
                local_tz: "America/Chicago",
                conscience: true,
                save_conversation: true,
                conversation_id: "${uuid()}"
              },
              SWAIG: {
                defaults: {
                  web_hook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-ai-webhook`,
                  web_hook_auth_user: user.id,
                  web_hook_auth_password: Deno.env.get('WEBHOOK_SECRET')
                },
                functions: generateAIFunctions(config)
              }
            }
          }
        ]
      }
    }

    // Deploy to SignalWire
    const response = await fetch(
      `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers/${config.phoneNumber}/update`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireToken}`)}`,
        },
        body: JSON.stringify({
          call_handler: 'laml_webhooks',
          call_request_url: Deno.env.get('SIGNALWIRE_AI_RELAY_BIN_URL') || 'https://taurustech.signalwire.com/relay-bins/2806d214-e1a6-4e2a-a51a-8e73f5c8052f',
          call_request_method: 'POST'
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SignalWire API error: ${error}`)
    }

    // Save configuration to database
    const { error: dbError } = await supabaseClient
      .from('ai_assistant_deployments')
      .insert({
        tenant_id: config.tenantId,
        phone_number: config.phoneNumber,
        swml_config: swml,
        config: config,
        deployed_at: new Date().toISOString(),
        status: 'active'
      })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'AI Assistant deployed successfully',
        swml: swml
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function generateAIPrompt(config: any): string {
  let prompt = `You are an AI assistant for ${config.companyName || 'a home services company'}. `
  
  switch (config.personality) {
    case 'professional':
      prompt += 'Be professional, courteous, and business-focused. Use formal language. '
      break
    case 'friendly':
      prompt += 'Be warm, friendly, and conversational. Make customers feel welcome. '
      break
    case 'concise':
      prompt += 'Be brief and to-the-point. Provide only essential information. '
      break
  }

  prompt += '\n\n' + config.customGreeting + '\n\n'

  if (config.features.appointmentScheduling) {
    prompt += 'You can schedule appointments. Check availability and book appointments for customers. '
  }
  
  if (config.features.questionAnswering) {
    prompt += 'Answer questions about our services, pricing, and business hours. '
  }
  
  if (config.features.callRouting) {
    prompt += 'Route calls to the appropriate department when needed. '
  }
  
  if (config.features.leadCapture) {
    prompt += 'Collect customer contact information including name, phone, email, and service needs. '
  }
  
  if (config.features.emergencyDetection) {
    prompt += 'If a customer mentions an emergency (water leak, no heat, electrical issue), immediately offer to connect them to emergency services. '
  }

  if (config.businessHours.enabled) {
    prompt += '\n\nBusiness hours:\n'
    Object.entries(config.businessHours.schedule).forEach(([day, hours]: [string, any]) => {
      if (hours.enabled) {
        prompt += `${day}: ${hours.start} - ${hours.end}\n`
      }
    })
  }

  return prompt
}

function generateAIFunctions(config: any): any[] {
  const functions = []

  if (config.features.appointmentScheduling) {
    functions.push({
      function: 'schedule_appointment',
      purpose: 'Schedule an appointment for the customer',
      argument: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Requested appointment date' },
          time: { type: 'string', description: 'Requested appointment time' },
          service: { type: 'string', description: 'Type of service needed' },
          customer_name: { type: 'string', description: 'Customer name' },
          customer_phone: { type: 'string', description: 'Customer phone number' }
        }
      }
    })
  }

  if (config.features.callRouting && config.transferNumbers.length > 0) {
    functions.push({
      function: 'transfer_call',
      purpose: 'Transfer the call to a specific department or person',
      argument: {
        type: 'object',
        properties: {
          department: { 
            type: 'string', 
            description: 'Department to transfer to',
            enum: config.transferNumbers.map(t => t.department)
          },
          reason: { type: 'string', description: 'Reason for transfer' }
        }
      }
    })
  }

  if (config.features.leadCapture) {
    functions.push({
      function: 'capture_lead',
      purpose: 'Save customer information as a new lead',
      argument: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer name' },
          phone: { type: 'string', description: 'Customer phone number' },
          email: { type: 'string', description: 'Customer email' },
          service_interest: { type: 'string', description: 'Service they are interested in' },
          notes: { type: 'string', description: 'Additional notes' }
        }
      }
    })
  }

  return functions
}