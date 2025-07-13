// supabase/functions/swaig-default-handler/index.ts
//
// Default handler for SWAIG function calls from SignalWire
// Processes various AI assistant actions during video estimating sessions
//

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('SWAIG default handler received:', JSON.stringify(payload, null, 2))

    const {
      function: functionName,
      argument,
      session_id,
      room_id,
      call_id,
      from,
      to,
      direction,
      variables
    } = payload

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Log the SWAIG function call
    await supabaseAdmin
      .from('swaig_function_logs')
      .insert({
        session_id: variables?.session?.id || session_id,
        function_name: functionName,
        arguments: argument,
        metadata: {
          room_id,
          call_id,
          from,
          to,
          direction,
          timestamp: new Date().toISOString()
        }
      })

    // Handle different function types
    let response
    switch (functionName) {
      case 'log_interaction':
        response = await handleLogInteraction(supabaseAdmin, argument, variables)
        break
      
      case 'update_context':
        response = await handleUpdateContext(supabaseAdmin, argument, variables)
        break
      
      case 'get_trade_info':
        response = await handleGetTradeInfo(supabaseAdmin, argument, variables)
        break
      
      default:
        console.log(`Unhandled SWAIG function: ${functionName}`)
        response = {
          response: "Function processed successfully",
          action: []
        }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in SWAIG default handler:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Handler functions

async function handleLogInteraction(supabase: any, args: any, variables: any) {
  const { type, content, metadata } = args
  
  // Store interaction in database
  await supabase
    .from('ai_interactions')
    .insert({
      session_id: variables?.session?.id,
      interaction_type: type,
      content,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    })

  return {
    response: "Interaction logged",
    action: []
  }
}

async function handleUpdateContext(supabase: any, args: any, variables: any) {
  const sessionId = variables?.session?.id
  if (!sessionId) {
    return {
      response: "No active session",
      action: []
    }
  }

  // Update session context
  const { data: session } = await supabase
    .from('video_sessions')
    .select('metadata')
    .eq('id', sessionId)
    .single()

  const updatedMetadata = {
    ...session?.metadata,
    context: {
      ...session?.metadata?.context,
      ...args
    }
  }

  await supabase
    .from('video_sessions')
    .update({ metadata: updatedMetadata })
    .eq('id', sessionId)

  return {
    response: "Context updated",
    action: []
  }
}

async function handleGetTradeInfo(supabase: any, args: any, variables: any) {
  const { trade_type, info_type } = args
  
  // Mock trade-specific information
  const tradeInfo = {
    ROOFING: {
      common_issues: [
        "Missing or damaged shingles",
        "Flashing deterioration",
        "Gutter damage",
        "Ice dam formation areas"
      ],
      inspection_tips: [
        "Check all roof slopes",
        "Look for granule loss",
        "Inspect valleys and ridges",
        "Check around penetrations"
      ],
      pricing_factors: [
        "Roof size and pitch",
        "Number of layers to remove",
        "Type of shingles",
        "Accessibility"
      ]
    },
    PLUMBING: {
      common_issues: [
        "Pipe corrosion",
        "Slow drains",
        "Water pressure problems",
        "Leaking fixtures"
      ],
      inspection_tips: [
        "Check under sinks",
        "Test all fixtures",
        "Look for water stains",
        "Check water heater age"
      ],
      pricing_factors: [
        "Pipe material and age",
        "Accessibility of repairs",
        "Number of fixtures",
        "Local code requirements"
      ]
    },
    HVAC: {
      common_issues: [
        "Poor efficiency",
        "Uneven heating/cooling",
        "Strange noises",
        "Frequent cycling"
      ],
      inspection_tips: [
        "Check filter condition",
        "Look for rust or corrosion",
        "Check refrigerant lines",
        "Test thermostat operation"
      ],
      pricing_factors: [
        "System age and type",
        "Tonnage requirements",
        "Ductwork condition",
        "Energy efficiency goals"
      ]
    },
    ELECTRICAL: {
      common_issues: [
        "Outdated panels",
        "Insufficient capacity",
        "Code violations",
        "Faulty wiring"
      ],
      inspection_tips: [
        "Check panel labeling",
        "Look for burn marks",
        "Test GFCI outlets",
        "Check grounding"
      ],
      pricing_factors: [
        "Panel size needed",
        "Number of circuits",
        "Code compliance updates",
        "Permit requirements"
      ]
    }
  }

  const info = tradeInfo[trade_type]?.[info_type] || []

  return {
    response: info.join(", "),
    action: [
      {
        say: {
          text: `Here are the ${info_type.replace('_', ' ')} for ${trade_type.toLowerCase()} work: ${info.join(", ")}`
        }
      }
    ]
  }
}