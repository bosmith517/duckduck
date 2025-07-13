// supabase/functions/ai-estimating-webhook/index.ts
//
// SWML webhook for AI estimating agent SWAIG functions
// Handles callbacks from SignalWire AI when it detects issues or needs to add estimate items
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
    // Authenticate SWML webhook request
    const authUser = req.headers.get('authorization')?.split(' ')[1]
    const expectedAuth = btoa(`signalwire:${Deno.env.get('SWML_WEBHOOK_PASSWORD') || 'secure123'}`)
    
    if (authUser !== expectedAuth) {
      throw new Error('Invalid webhook authentication')
    }

    const body = await req.json()
    console.log('SWML Webhook called:', JSON.stringify(body, null, 2))

    const { function: functionName, argument, meta_data } = body
    
    // Create Supabase admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let response = {}

    switch (functionName) {
      case 'capture_critical_frame':
        // AI wants to capture and analyze a critical frame
        response = await handleCaptureFrame(supabase, argument, meta_data)
        break
        
      case 'add_estimate_item':
        // AI detected something that should be added to the estimate
        response = await handleAddEstimateItem(supabase, argument, meta_data)
        break
        
      case 'request_closer_look':
        // AI wants customer to show a specific area in more detail
        response = await handleRequestCloserLook(supabase, argument, meta_data)
        break
        
      default:
        response = {
          response: `Unknown function: ${functionName}`,
          directive: ["continue"]
        }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in ai-estimating-webhook:', error.message)
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "I encountered an error processing that request. Let me continue with the inspection.",
      directive: ["continue"]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 so SWML continues
    })
  }
})

async function handleCaptureFrame(supabase: any, argument: any, meta_data: any) {
  // Extract the current video frame and store analysis
  const { reason, confidence } = argument
  
  // Store frame analysis in database
  try {
    await supabase
      .from('ai_frame_analysis')
      .insert({
        session_id: meta_data.room_session_id,
        timestamp: new Date().toISOString(),
        analysis_reason: reason,
        confidence_score: confidence,
        frame_metadata: meta_data
      })
  } catch (dbError) {
    console.warn('Could not store frame analysis:', dbError)
  }

  return {
    response: `I've captured this frame for analysis. ${reason}. What would you like me to examine next?`,
    directive: ["continue"]
  }
}

async function handleAddEstimateItem(supabase: any, argument: any, meta_data: any) {
  // AI detected an issue that should be added to the estimate
  const { 
    item_description, 
    severity_level, 
    estimated_cost_range, 
    trade_category,
    recommendation 
  } = argument
  
  // Store estimate item in database
  try {
    const estimateItem = {
      session_id: meta_data.room_session_id,
      description: item_description,
      category: trade_category,
      severity: severity_level,
      cost_estimate_min: estimated_cost_range?.min || 0,
      cost_estimate_max: estimated_cost_range?.max || 0,
      ai_recommendation: recommendation,
      detected_at: new Date().toISOString(),
      confidence_score: argument.confidence || 0.8
    }
    
    await supabase
      .from('ai_estimate_items')
      .insert(estimateItem)
      
    console.log('Added AI estimate item:', estimateItem)
  } catch (dbError) {
    console.warn('Could not store estimate item:', dbError)
  }

  return {
    response: `I've identified a ${severity_level} issue: ${item_description}. ${recommendation}. This has been added to your estimate for review.`,
    directive: ["continue"]
  }
}

async function handleRequestCloserLook(supabase: any, argument: any, meta_data: any) {
  // AI wants customer to show a specific area
  const { area_description, reason, specific_instructions } = argument
  
  // Log the request for tracking
  try {
    await supabase
      .from('ai_inspection_requests')
      .insert({
        session_id: meta_data.room_session_id,
        requested_area: area_description,
        reason: reason,
        instructions: specific_instructions,
        requested_at: new Date().toISOString()
      })
  } catch (dbError) {
    console.warn('Could not log inspection request:', dbError)
  }

  return {
    response: `Could you please show me ${area_description}? ${reason}. ${specific_instructions}`,
    directive: ["continue"]
  }
}