import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VisionResult {
  objects: Array<{
    type: string
    confidence: number
    bbox: { x: number; y: number; width: number; height: number }
    attributes?: Record<string, any>
  }>
  trade_insights: Array<{
    category: string
    finding: string
    severity: 'info' | 'warning' | 'critical'
  }>
  next_prompt?: string
  confidence: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, frame_data, trade_type } = await req.json()

    if (!session_id || !frame_data || !trade_type) {
      throw new Error('session_id, frame_data, and trade_type are required')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // For now, simulate AI processing with trade-specific mock results
    // In production, this would send the frame to a GPU worker pod via NATS
    const visionResult = await processFrameForTrade(frame_data, trade_type)

    // Store vision result
    const { error: insertError } = await supabase
      .from('vision_results')
      .insert({
        session_id,
        timestamp: new Date().toISOString(),
        objects: visionResult.objects,
        trade_insights: visionResult.trade_insights,
        confidence: visionResult.confidence,
        trade_type
      })

    if (insertError) {
      console.error('Error storing vision result:', insertError)
    }

    // Update session with latest vision results
    const { error: updateError } = await supabase
      .from('video_sessions')
      .update({
        vision_results: supabase.rpc('array_append', {
          arr: 'vision_results',
          elem: visionResult
        })
      })
      .eq('id', session_id)

    if (updateError) {
      console.error('Error updating session:', updateError)
    }

    return new Response(
      JSON.stringify(visionResult),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error processing vision frame:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function processFrameForTrade(frameData: string, tradeType: string): Promise<VisionResult> {
  // Mock AI processing - in production this would use YOLO v8 + trade-specific models
  const mockResults: Record<string, VisionResult> = {
    ROOFING: {
      objects: [
        {
          type: 'shingle',
          confidence: 0.92,
          bbox: { x: 100, y: 50, width: 200, height: 150 },
          attributes: { material: 'asphalt', condition: 'good' }
        },
        {
          type: 'vent',
          confidence: 0.87,
          bbox: { x: 300, y: 80, width: 50, height: 60 },
          attributes: { type: 'ridge_vent', condition: 'fair' }
        }
      ],
      trade_insights: [
        {
          category: 'Material Assessment',
          finding: 'Asphalt shingles in good condition detected',
          severity: 'info'
        },
        {
          category: 'Ventilation',
          finding: 'Ridge vent present but may need maintenance',
          severity: 'warning'
        }
      ],
      next_prompt: 'Can you show me the gutters and any edge areas of the roof?',
      confidence: 0.89
    },
    PLUMBING: {
      objects: [
        {
          type: 'pipe',
          confidence: 0.94,
          bbox: { x: 120, y: 100, width: 80, height: 200 },
          attributes: { material: 'copper', diameter: '3/4_inch' }
        },
        {
          type: 'valve',
          confidence: 0.81,
          bbox: { x: 150, y: 280, width: 30, height: 40 },
          attributes: { type: 'shutoff', condition: 'good' }
        }
      ],
      trade_insights: [
        {
          category: 'Pipe Material',
          finding: 'Copper piping detected - good quality material',
          severity: 'info'
        },
        {
          category: 'Valve Condition',
          finding: 'Shutoff valve accessible and functional',
          severity: 'info'
        }
      ],
      next_prompt: 'Now show me the water pressure by turning on the nearest faucet',
      confidence: 0.87
    },
    HVAC: {
      objects: [
        {
          type: 'filter',
          confidence: 0.88,
          bbox: { x: 50, y: 150, width: 150, height: 100 },
          attributes: { size: '16x20x1', condition: 'dirty' }
        },
        {
          type: 'condenser',
          confidence: 0.93,
          bbox: { x: 200, y: 50, width: 300, height: 250 },
          attributes: { brand: 'carrier', tonnage: '3_ton' }
        }
      ],
      trade_insights: [
        {
          category: 'Filter Maintenance',
          finding: 'Air filter appears dirty and needs replacement',
          severity: 'warning'
        },
        {
          category: 'Unit Assessment',
          finding: '3-ton Carrier unit detected, appears to be in good condition',
          severity: 'info'
        }
      ],
      next_prompt: 'Can you show me the thermostat and its current settings?',
      confidence: 0.91
    },
    ELECTRICAL: {
      objects: [
        {
          type: 'panel',
          confidence: 0.95,
          bbox: { x: 80, y: 40, width: 200, height: 300 },
          attributes: { amperage: '200_amp', breakers: 24 }
        },
        {
          type: 'breaker',
          confidence: 0.89,
          bbox: { x: 120, y: 180, width: 20, height: 30 },
          attributes: { amperage: '20_amp', position: 'on' }
        }
      ],
      trade_insights: [
        {
          category: 'Panel Capacity',
          finding: '200-amp panel with adequate capacity',
          severity: 'info'
        },
        {
          category: 'Circuit Status',
          finding: 'All visible breakers appear to be functioning normally',
          severity: 'info'
        }
      ],
      next_prompt: 'Show me the specific outlet or switch that needs work',
      confidence: 0.92
    }
  }

  return mockResults[tradeType] || {
    objects: [],
    trade_insights: [],
    next_prompt: 'Please show me the area that needs attention',
    confidence: 0.5
  }
}