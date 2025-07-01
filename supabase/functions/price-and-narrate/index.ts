import { serve } from "https://deno.land/std@0.202.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface LineItem {
  description: string
  quantity: number
  unit: string
  item_type: 'labor' | 'material' | 'service' | 'other'
  unit_price?: number
  total_price?: number
}

interface Tier {
  tier_name: string
  line_items: LineItem[]
}

interface PricedTier {
  tier_name: string
  description: string
  total_amount: number
  line_items: LineItem[]
}

interface PriceAndNarrateRequest {
  tiers: Tier[]
  priceBook: Record<string, number>
  targetPrices?: {
    Good?: number
    Better?: number
    Best?: number
  }
  jobMeta?: {
    serviceType?: string
    location?: string
    complexity?: string
  }
}

interface PriceAndNarrateResponse {
  narrative: string
  priced_tiers: PricedTier[]
}

// Dynamic price book generation based on service type
function getDefaultPriceBook(serviceType: string): Record<string, number> {
  const baseRates = {
    // General labor rates (per hour)
    'labor_standard': 85,
    'labor_emergency': 125,
    'labor_apprentice': 65,
    'permit_standard': 150.00,
    'disposal_fee': 75.00,
  }

  // Service-specific price books
  switch (serviceType?.toLowerCase()) {
    case 'electrical':
    case 'electric':
      return {
        ...baseRates,
        'electrical_labor_standard': 85,
        'outlet_standard': 3.50,
        'outlet_gfci': 12.00,
        'breaker_single_pole_20a': 9.25,
        'wire_12awg_romex_per_ft': 0.85,
        'panel_200a_main': 285.00,
        'surge_protector_whole_house': 185.00,
      }
    
    case 'roofing':
    case 'roof':
      return {
        ...baseRates,
        'roofing_labor_standard': 75,
        'shingle_bundle': 35.00,
        'underlayment_roll': 45.00,
        'ridge_cap_bundle': 55.00,
        'flashing_linear_ft': 8.50,
        'roof_vent': 65.00,
        'drip_edge_linear_ft': 5.50,
      }
    
    case 'hvac':
    case 'heating':
    case 'cooling':
      return {
        ...baseRates,
        'hvac_labor_standard': 95,
        'filter_standard': 25.00,
        'thermostat_basic': 85.00,
        'refrigerant_per_lb': 75.00,
        'ductwork_linear_ft': 12.50,
        'capacitor': 125.00,
      }
    
    case 'plumbing':
      return {
        ...baseRates,
        'plumbing_labor_standard': 90,
        'pipe_copper_per_ft': 8.50,
        'pipe_pvc_per_ft': 3.25,
        'faucet_standard': 125.00,
        'valve_shutoff': 35.00,
        'drain_cleanout': 185.00,
      }
    
    default:
      // General construction/repair rates
      return {
        ...baseRates,
        'material_standard': 50.00,
        'equipment_rental': 150.00,
        'specialty_item': 100.00,
      }
  }
}

function findBestPriceMatch(description: string, priceBook: Record<string, number>): number {
  const desc = description.toLowerCase()
  
  // Try exact matches first
  for (const [key, price] of Object.entries(priceBook)) {
    if (desc.includes(key.replace(/_/g, ' '))) {
      return price
    }
  }
  
  // Try partial matches for common items
  if (desc.includes('outlet') && desc.includes('gfci')) return priceBook['outlet_gfci'] || 12.00
  if (desc.includes('outlet') && desc.includes('afci')) return priceBook['outlet_afci'] || 15.00
  if (desc.includes('outlet')) return priceBook['outlet_standard'] || 3.50
  
  if (desc.includes('breaker') && desc.includes('afci')) return priceBook['breaker_afci_20a'] || 38.00
  if (desc.includes('breaker') && desc.includes('gfci')) return priceBook['breaker_gfci_20a'] || 42.00
  if (desc.includes('breaker')) return priceBook['breaker_single_pole_20a'] || 9.25
  
  if (desc.includes('wire') && desc.includes('12')) return priceBook['wire_12awg_romex_per_ft'] || 0.85
  if (desc.includes('wire') && desc.includes('14')) return priceBook['wire_14awg_romex_per_ft'] || 0.65
  if (desc.includes('wire')) return priceBook['wire_12awg_romex_per_ft'] || 0.85
  
  if (desc.includes('panel') && desc.includes('200')) return priceBook['panel_200a_main'] || 285.00
  if (desc.includes('panel')) return priceBook['panel_100a_main'] || 185.00
  
  if (desc.includes('permit')) return priceBook['electrical_permit'] || 150.00
  if (desc.includes('disposal')) return priceBook['disposal_fee'] || 75.00
  if (desc.includes('surge')) return priceBook['surge_protector_whole_house'] || 185.00
  
  // Labor fallbacks
  if (desc.includes('install') || desc.includes('labor') || desc.includes('hour')) {
    return priceBook['labor_standard'] || priceBook[Object.keys(priceBook).find(k => k.includes('labor')) || ''] || 85.00
  }
  
  // Default pricing based on item type and complexity
  if (desc.includes('upgrade') || desc.includes('replace')) return 125.00
  if (desc.includes('repair')) return 45.00
  return 25.00 // Basic fallback
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        ...corsHeaders, 
        'Access-Control-Max-Age': '86400' 
      } 
    })
  }

  try {
    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }

    // Parse request body
    const { tiers, priceBook, targetPrices, jobMeta }: PriceAndNarrateRequest = await req.json()

    // Validate input
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      throw new Error('tiers array is required and must not be empty')
    }

    // Validate tier structure
    for (const tier of tiers) {
      if (!tier.line_items || !Array.isArray(tier.line_items)) {
        throw new Error(`Invalid tier structure: ${tier.tier_name} missing line_items array`)
      }
    }

    // Get service-specific default price book and merge with provided prices
    const serviceType = jobMeta?.serviceType || 'general'
    const defaultPriceBook = getDefaultPriceBook(serviceType)
    const combinedPriceBook = { ...defaultPriceBook, ...priceBook }

    // Price each tier
    const pricedTiers: PricedTier[] = tiers.map(tier => {
      const pricedLineItems = tier.line_items.map(item => {
        const unitPrice = findBestPriceMatch(item.description, combinedPriceBook)
        const totalPrice = +(unitPrice * item.quantity).toFixed(2)
        
        return {
          ...item,
          unit_price: +unitPrice.toFixed(2),
          total_price: totalPrice
        }
      })

      let totalAmount = pricedLineItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
      
      // Override with target price if provided
      const tierKey = tier.tier_name as keyof typeof targetPrices
      if (targetPrices && targetPrices[tierKey]) {
        totalAmount = targetPrices[tierKey]!
        
        // Redistribute the target price across line items proportionally
        const originalTotal = pricedLineItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
        if (originalTotal > 0) {
          const adjustmentFactor = totalAmount / originalTotal
          pricedLineItems.forEach(item => {
            if (item.unit_price) item.unit_price = +(item.unit_price * adjustmentFactor).toFixed(2)
            if (item.total_price) item.total_price = +(item.total_price * adjustmentFactor).toFixed(2)
          })
        }
      }
      
      // Generate tier description
      let description = ''
      switch (tier.tier_name.toLowerCase()) {
        case 'good':
          description = 'Essential repairs and code compliance'
          break
        case 'better':
          description = 'Enhanced safety with modern upgrades'
          break
        case 'best':
          description = 'Premium solution with comprehensive improvements'
          break
        default:
          description = `Professional ${jobMeta?.serviceType || 'repair'} service`
      }

      return {
        tier_name: tier.tier_name,
        description,
        total_amount: Math.round(totalAmount * 100) / 100,
        line_items: pricedLineItems
      }
    })

    // Apply proportional pricing ONLY if custom target prices were NOT provided
    // This prevents overriding user's custom pricing with hardcoded defaults
    const hasCustomPrices = targetPrices && Object.values(targetPrices).some(price => price !== undefined)
    
    if (!hasCustomPrices) {
      console.log('No custom target prices provided, applying default proportional pricing')
      
      const goodTier = pricedTiers.find(t => t.tier_name.toLowerCase() === 'good')
      const betterTier = pricedTiers.find(t => t.tier_name.toLowerCase() === 'better')
      const bestTier = pricedTiers.find(t => t.tier_name.toLowerCase() === 'best')

      let goodTotal = goodTier?.total_amount || 0

      // Apply realistic baseline only if AI pricing is extremely unrealistic
      if (goodTotal < 200 || goodTotal > 5000) {
        const adjustmentFactor = 800 / goodTotal
        if (goodTier && goodTotal > 0) {
          goodTier.total_amount = 800
          goodTier.line_items.forEach(item => {
            if (item.unit_price) item.unit_price = +(item.unit_price * adjustmentFactor).toFixed(2)
            if (item.total_price) item.total_price = +(item.total_price * adjustmentFactor).toFixed(2)
          })
          goodTotal = 800
        }
      }

      // Set Better to +30% of Good, Best to +60% of Good (matching frontend logic)
      if (betterTier && goodTotal > 0) {
        const targetBetter = +(goodTotal * 1.3).toFixed(2)
        const adjustmentFactor = targetBetter / (betterTier.total_amount || 1)
        betterTier.total_amount = targetBetter
        betterTier.line_items.forEach(item => {
          if (item.unit_price) item.unit_price = +(item.unit_price * adjustmentFactor).toFixed(2)
          if (item.total_price) item.total_price = +(item.total_price * adjustmentFactor).toFixed(2)
        })
      }

      if (bestTier && goodTotal > 0) {
        const targetBest = +(goodTotal * 1.6).toFixed(2)
        const adjustmentFactor = targetBest / (bestTier.total_amount || 1)
        bestTier.total_amount = targetBest
        bestTier.line_items.forEach(item => {
          if (item.unit_price) item.unit_price = +(item.unit_price * adjustmentFactor).toFixed(2)
          if (item.total_price) item.total_price = +(item.total_price * adjustmentFactor).toFixed(2)
        })
      }
    } else {
      console.log('Custom target prices provided:', targetPrices, '- preserving user pricing, skipping default adjustments')
    }

    // Generate narrative with GPT-4 AFTER all pricing adjustments are complete
    // This ensures the narrative reflects the actual final prices (including custom targets)
    const tiersText = pricedTiers.map(tier => 
      `${tier.tier_name}: $${tier.total_amount.toLocaleString()} - ${tier.description}\n` +
      tier.line_items.map(item => 
        `  • ${item.description} (${item.quantity} ${item.unit}) - $${item.total_price?.toFixed(2)}`
      ).join('\n')
    ).join('\n\n')

    console.log('Final pricing for narrative generation:', tiersText)

    // Generate narrative with GPT-4
    const narrativePrompt = `Create a 150-200 word professional Markdown narrative for a ${jobMeta?.serviceType || 'repair service'} estimate with these tiers:

${tiersText}

Service Type: ${jobMeta?.serviceType || 'General Repair'}
Location: ${jobMeta?.location || 'Midwest US'}
Complexity: ${jobMeta?.complexity || 'Standard'}

Write a compelling narrative that:
- Explains the value proposition of each tier
- Highlights safety and code compliance benefits  
- Uses professional terminology appropriate for ${jobMeta?.serviceType || 'the service type'}
- Includes 2-3 relevant emojis
- Emphasizes quality workmanship and materials
- Mentions warranty/guarantee briefly
- Uses Markdown formatting (headers, bullets, emphasis)

Make it sound professional but approachable, suitable for homeowners.`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional ${jobMeta?.serviceType || 'service'} contractor writing estimate narratives. Create compelling, informative content in Markdown format appropriate for ${jobMeta?.serviceType || 'the specific trade'}.`
          },
          {
            role: 'user',
            content: narrativePrompt
          }
        ],
        max_tokens: 600,
        temperature: 0.6
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
    }

    const openaiData = await openaiResponse.json()
    const narrative = openaiData.choices[0]?.message?.content || `Professional ${jobMeta?.serviceType || 'service'} estimate with tiered pricing options.`

    const result: PriceAndNarrateResponse = {
      narrative,
      priced_tiers: pricedTiers
    }

    // Log successful pricing and token usage
    console.log('Successfully priced', pricedTiers.length, 'tiers')
    console.log('Total amounts:', pricedTiers.map(t => `${t.tier_name}: $${t.total_amount}`).join(', '))
    console.log('GPT usage:', openaiData.usage)

    return new Response(
      JSON.stringify(result),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in price-and-narrate function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to price repairs and generate narrative'
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    )
  }
})