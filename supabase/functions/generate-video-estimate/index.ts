import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EstimateLineItem {
  id: string
  description: string
  sku?: string
  quantity: number
  unit_price: number
  total: number
  notes?: string
  ai_confidence?: number
}

interface GeneratedEstimate {
  id: string
  session_id: string
  line_items: EstimateLineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  notes: string
  created_at: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, vision_results, trade_type } = await req.json()

    if (!session_id || !vision_results || !trade_type) {
      throw new Error('session_id, vision_results, and trade_type are required')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      throw new Error('Session not found')
    }

    // Generate line items based on vision analysis
    const lineItems = await generateLineItemsFromVision(vision_results, trade_type)
    
    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
    const taxRate = 0.08 // 8% default tax rate - should be configurable per tenant
    const taxAmount = subtotal * taxRate
    const totalAmount = subtotal + taxAmount

    // Create generated estimate record
    const estimateId = `gen_${Date.now()}`
    const generatedEstimate: GeneratedEstimate = {
      id: estimateId,
      session_id,
      line_items: lineItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: `AI-generated estimate from ${trade_type} video analysis. Please review and adjust as needed.`,
      created_at: new Date().toISOString()
    }

    // Store in database
    const { error: insertError } = await supabase
      .from('generated_estimates')
      .insert([generatedEstimate])

    if (insertError) {
      console.error('Error storing generated estimate:', insertError)
      throw new Error('Failed to store estimate')
    }

    return new Response(
      JSON.stringify(generatedEstimate),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error generating video estimate:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function generateLineItemsFromVision(visionResults: any[], tradeType: string): Promise<EstimateLineItem[]> {
  // Mock pricing logic - in production this would use AI + price book integration
  const pricingTemplates: Record<string, Record<string, { description: string; unit_price: number; unit: string }>> = {
    ROOFING: {
      'shingle_replacement': { description: 'Asphalt Shingle Replacement', unit_price: 450, unit: 'square' },
      'vent_repair': { description: 'Ridge Vent Repair/Replacement', unit_price: 125, unit: 'linear_foot' },
      'flashing_repair': { description: 'Flashing Repair', unit_price: 85, unit: 'linear_foot' },
      'gutter_cleaning': { description: 'Gutter Cleaning & Inspection', unit_price: 200, unit: 'service' }
    },
    PLUMBING: {
      'pipe_repair': { description: 'Copper Pipe Repair', unit_price: 75, unit: 'foot' },
      'valve_replacement': { description: 'Shutoff Valve Replacement', unit_price: 150, unit: 'unit' },
      'leak_repair': { description: 'Leak Detection & Repair', unit_price: 250, unit: 'service' },
      'water_pressure_fix': { description: 'Water Pressure Diagnostic & Repair', unit_price: 180, unit: 'service' }
    },
    HVAC: {
      'filter_replacement': { description: 'Air Filter Replacement', unit_price: 45, unit: 'unit' },
      'system_tune_up': { description: 'HVAC System Tune-up', unit_price: 275, unit: 'service' },
      'condenser_cleaning': { description: 'Condenser Coil Cleaning', unit_price: 150, unit: 'service' },
      'thermostat_calibration': { description: 'Thermostat Calibration', unit_price: 95, unit: 'service' }
    },
    ELECTRICAL: {
      'outlet_replacement': { description: 'Outlet Replacement', unit_price: 85, unit: 'unit' },
      'breaker_replacement': { description: 'Circuit Breaker Replacement', unit_price: 150, unit: 'unit' },
      'panel_inspection': { description: 'Electrical Panel Inspection', unit_price: 125, unit: 'service' },
      'wiring_repair': { description: 'Electrical Wiring Repair', unit_price: 95, unit: 'foot' }
    }
  }

  const pricing = pricingTemplates[tradeType] || {}
  const lineItems: EstimateLineItem[] = []

  // Analyze vision results and generate line items
  visionResults.forEach((result, index) => {
    if (result.objects) {
      result.objects.forEach((obj: any) => {
        // Determine work needed based on object type and attributes
        const workType = determineWorkType(obj, result.trade_insights)
        const pricingInfo = pricing[workType]
        
        if (pricingInfo) {
          const quantity = estimateQuantity(obj, workType)
          const lineItem: EstimateLineItem = {
            id: `item_${index}_${obj.type}`,
            description: pricingInfo.description,
            sku: `${tradeType}_${workType.toUpperCase()}`,
            quantity,
            unit_price: pricingInfo.unit_price,
            total: quantity * pricingInfo.unit_price,
            notes: `Based on AI analysis: ${obj.type} detected with ${Math.round(obj.confidence * 100)}% confidence`,
            ai_confidence: obj.confidence
          }
          lineItems.push(lineItem)
        }
      })
    }
  })

  // Add service call fee
  lineItems.unshift({
    id: 'service_call',
    description: 'Service Call & Diagnostic',
    sku: `${tradeType}_SERVICE_CALL`,
    quantity: 1,
    unit_price: 95,
    total: 95,
    notes: 'Standard service call fee',
    ai_confidence: 1.0
  })

  return lineItems
}

function determineWorkType(obj: any, insights: any[]): string {
  // Simple logic to determine work type based on object and insights
  const objType = obj.type.toLowerCase()
  const attributes = obj.attributes || {}
  
  // Check insights for severity indicators
  const hasCriticalIssue = insights.some(i => i.severity === 'critical')
  const hasWarningIssue = insights.some(i => i.severity === 'warning')
  
  if (hasCriticalIssue) {
    return `${objType}_replacement`
  } else if (hasWarningIssue || attributes.condition === 'dirty' || attributes.condition === 'fair') {
    return `${objType}_repair`
  } else {
    return `${objType}_inspection`
  }
}

function estimateQuantity(obj: any, workType: string): number {
  // Simple quantity estimation based on object size and work type
  const bbox = obj.bbox || { width: 100, height: 100 }
  const area = bbox.width * bbox.height
  
  if (workType.includes('replacement') || workType.includes('repair')) {
    // For repairs/replacements, base on object size
    if (area > 30000) return 3 // Large area
    if (area > 10000) return 2 // Medium area
    return 1 // Small area
  }
  
  return 1 // Default quantity for services
}