import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OpenAI-compatible API for analyzing call transcripts
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

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

    const { call_id, transcript, from_number, duration } = await req.json()

    // Get tenant information for context
    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.tenant_id) {
      throw new Error('User profile not found')
    }

    // Check if caller exists in contacts
    const { data: existingContact } = await supabaseClient
      .from('contacts')
      .select('id, account_id, first_name, last_name, email')
      .eq('phone', from_number)
      .eq('tenant_id', userProfile.tenant_id)
      .single()

    // Get recent jobs for context
    const { data: recentJobs } = await supabaseClient
      .from('jobs')
      .select('id, title, status, service_type')
      .eq('tenant_id', userProfile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Prepare AI prompt for action analysis
    const systemPrompt = `You are an AI assistant that analyzes phone call transcripts and suggests actionable next steps for a home services business. Based on the call transcript, suggest specific actions the business owner should take.

Context:
- Caller number: ${from_number}
- Call duration: ${duration} seconds
- Existing contact: ${existingContact ? `${existingContact.first_name} ${existingContact.last_name}` : 'New caller'}
- Recent company jobs: ${recentJobs?.map(j => `${j.service_type}: ${j.status}`).join(', ') || 'None'}

Analyze the transcript and suggest relevant actions from these categories:
1. create_lead - For new callers who need to be added to the system
2. create_job - When a service request is mentioned
3. schedule_appointment - When caller wants to schedule something
4. update_contact - When caller provides new information (address, email, etc.)
5. add_note - When important information should be documented
6. send_followup - When a follow-up communication is needed

For each action, provide:
- type: one of the categories above
- priority: high, medium, or low
- title: Brief action title
- description: What the action will do
- action_data: Relevant data extracted from the call
- confidence: 0.0 to 1.0 confidence score

Return a JSON object with an "actions" array.`

    const userPrompt = `Call transcript: "${transcript}"`

    let actions = []

    // Try to use OpenAI for intelligent analysis
    if (OPENAI_API_KEY) {
      try {
        const aiResponse = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 1000
          })
        })

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json()
          const aiContent = aiResult.choices[0]?.message?.content
          
          if (aiContent) {
            try {
              const parsedActions = JSON.parse(aiContent)
              actions = parsedActions.actions || []
            } catch (parseError) {
              console.warn('Failed to parse AI response, using fallback')
              actions = generateFallbackActions(transcript, from_number, existingContact)
            }
          }
        } else {
          console.warn('AI API failed, using fallback')
          actions = generateFallbackActions(transcript, from_number, existingContact)
        }
      } catch (aiError) {
        console.warn('AI analysis failed, using fallback:', aiError)
        actions = generateFallbackActions(transcript, from_number, existingContact)
      }
    } else {
      // Use rule-based fallback when no AI API is available
      actions = generateFallbackActions(transcript, from_number, existingContact)
    }

    // Store the actions for tracking
    if (actions.length > 0) {
      await supabaseClient
        .from('ai_call_actions')
        .insert({
          tenant_id: userProfile.tenant_id,
          call_id: call_id,
          from_number: from_number,
          transcript: transcript,
          suggested_actions: actions,
          created_at: new Date().toISOString()
        })
    }

    return new Response(
      JSON.stringify({ actions }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error generating post-call actions:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function generateFallbackActions(transcript: string, fromNumber: string, existingContact: any) {
  const text = transcript.toLowerCase()
  const actions = []

  // Extract potential service types
  const serviceKeywords = {
    'plumbing': ['plumb', 'pipe', 'leak', 'drain', 'faucet', 'toilet', 'sink'],
    'hvac': ['heat', 'air', 'hvac', 'furnace', 'ac', 'air conditioning', 'thermostat'],
    'electrical': ['electric', 'outlet', 'switch', 'wire', 'power', 'breaker'],
    'roofing': ['roof', 'shingle', 'gutter', 'leak']
  }

  let detectedServices = []
  for (const [service, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      detectedServices.push(service)
    }
  }

  // Check for emergency indicators
  const emergencyKeywords = ['emergency', 'urgent', 'flooding', 'no heat', 'no power', 'leak']
  const isEmergency = emergencyKeywords.some(keyword => text.includes(keyword))

  // Check for scheduling requests
  const schedulingKeywords = ['appointment', 'schedule', 'when can', 'available', 'book']
  const needsScheduling = schedulingKeywords.some(keyword => text.includes(keyword))

  // Check for address mentions
  const addressPattern = /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/i
  const mentionedAddress = transcript.match(addressPattern)?.[0]

  // Generate actions based on analysis
  if (!existingContact) {
    actions.push({
      id: `action_${Date.now()}_1`,
      type: 'create_lead',
      priority: 'medium',
      title: 'Create New Lead',
      description: `New caller from ${fromNumber}. Create a lead record to track this prospect.`,
      action_data: {
        phone: fromNumber,
        source: 'Inbound Call',
        notes: transcript.substring(0, 200) + (transcript.length > 200 ? '...' : ''),
        service_interest: detectedServices.join(', ') || 'General Inquiry'
      },
      confidence: 0.9
    })
  }

  if (detectedServices.length > 0) {
    actions.push({
      id: `action_${Date.now()}_2`,
      type: 'create_job',
      priority: isEmergency ? 'high' : 'medium',
      title: `Create ${detectedServices.join('/')} Job`,
      description: `Customer mentioned ${detectedServices.join(' and ')} services. Create a job to track this work.`,
      action_data: {
        phone: fromNumber,
        service_types: detectedServices,
        priority: isEmergency ? 'emergency' : 'normal',
        title: `${detectedServices.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('/')} Service`,
        description: transcript.substring(0, 300),
        is_emergency: isEmergency
      },
      confidence: 0.85
    })
  }

  if (needsScheduling) {
    actions.push({
      id: `action_${Date.now()}_3`,
      type: 'schedule_appointment',
      priority: 'high',
      title: 'Schedule Appointment',
      description: 'Customer requested to schedule an appointment. Set up a service visit.',
      action_data: {
        phone: fromNumber,
        service_type: detectedServices[0] || 'General Service',
        notes: 'Customer called to schedule appointment',
        urgency: isEmergency ? 'emergency' : 'normal'
      },
      confidence: 0.9
    })
  }

  if (mentionedAddress && existingContact) {
    actions.push({
      id: `action_${Date.now()}_4`,
      type: 'update_contact',
      priority: 'medium',
      title: 'Update Contact Address',
      description: `Customer mentioned address: ${mentionedAddress}. Update their contact record.`,
      action_data: {
        contact_id: existingContact.id,
        phone: fromNumber,
        suggested_address: mentionedAddress
      },
      confidence: 0.8
    })
  }

  // Always suggest adding a call note
  actions.push({
    id: `action_${Date.now()}_5`,
    type: 'add_note',
    priority: 'low',
    title: 'Add Call Summary',
    description: 'Document this call conversation for future reference.',
    action_data: {
      phone: fromNumber,
      note: `Call summary: ${transcript.substring(0, 500)}${transcript.length > 500 ? '...' : ''}`,
      type: 'call_summary',
      duration: transcript.length // Rough estimate
    },
    confidence: 1.0
  })

  return actions
}