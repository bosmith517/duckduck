import { serve } from "https://deno.land/std@0.202.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface BasicRepair {
  description: string
  quantity: number
  unit: string
  item_type: 'labor' | 'material' | 'service' | 'other'
}

interface ExtendScopeRequest {
  basic_repairs: BasicRepair[]
  damage_bullets: string[]
  jobMeta: {
    serviceType: string
    houseAge?: number
    panelAmp?: number
    location?: string
  }
}

interface ExtendScopeResponse {
  better_repairs: BasicRepair[]
  best_repairs: BasicRepair[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }

    // Parse request body
    const { basic_repairs, damage_bullets, jobMeta }: ExtendScopeRequest = await req.json()

    // Validate input
    if (!basic_repairs || !Array.isArray(basic_repairs)) {
      throw new Error('basic_repairs array is required')
    }
    if (!damage_bullets || !Array.isArray(damage_bullets)) {
      throw new Error('damage_bullets array is required')
    }
    if (!jobMeta || !jobMeta.serviceType) {
      throw new Error('jobMeta with serviceType is required')
    }

    // Build context for scope extension
    const basicRepairsText = basic_repairs.map(repair => 
      `${repair.description} (${repair.quantity} ${repair.unit}, ${repair.item_type})`
    ).join('\n')

    const damageContext = damage_bullets.join('\n')

    // Build service-specific upgrade guidelines
    const getServiceUpgradeGuidelines = (serviceType: string) => {
      switch (serviceType?.toLowerCase()) {
        case 'electrical':
        case 'electric':
          return {
            better: 'Code compliance upgrades, AFCI/GFCI protection, minor improvements',
            best: 'Full modernization, surge protection, premium materials, additional safety features',
            considerations: 'Consider the house age and electrical service capacity.'
          }
        case 'roofing':
        case 'roof':
          return {
            better: 'Enhanced underlayment, improved ventilation, code compliance upgrades',
            best: 'Premium materials, comprehensive weatherproofing, enhanced warranty coverage',
            considerations: 'Consider roof age, weather exposure, and structural integrity.'
          }
        case 'hvac':
        case 'heating':
        case 'cooling':
          return {
            better: 'Energy efficiency upgrades, improved filtration, thermostat improvements',
            best: 'High-efficiency equipment, smart controls, comprehensive system optimization',
            considerations: 'Consider system age, efficiency ratings, and home size.'
          }
        default:
          return {
            better: 'Enhanced materials and methods, code compliance improvements',
            best: 'Premium materials, comprehensive upgrades, extended warranty coverage',
            considerations: 'Consider age, condition, and performance requirements.'
          }
      }
    }

    const upgradeGuidelines = getServiceUpgradeGuidelines(jobMeta.serviceType)

    // Construct GPT-4 prompt for scope extension
    const systemPrompt = `You are an expert ${jobMeta.serviceType} contractor expanding repair scopes from Good to Better and Best tiers.

Given basic repairs (Good tier), create Better and Best tier scopes by adding:
- Better tier: ${upgradeGuidelines.better}
- Best tier: ${upgradeGuidelines.best}

Use the damage bullets to justify additional work. ${upgradeGuidelines.considerations}

Return ONLY a JSON object with this exact structure:
{
  "better_repairs": [
    {
      "description": "repair description",
      "quantity": number,
      "unit": "hour|item|sqft|linear_ft",
      "item_type": "labor|material|service|other"
    }
  ],
  "best_repairs": [
    {
      "description": "repair description", 
      "quantity": number,
      "unit": "hour|item|sqft|linear_ft",
      "item_type": "labor|material|service|other"
    }
  ]
}

Guidelines:
- Better tier should include Good tier repairs PLUS upgrades and safety improvements
- Best tier should include Better tier PLUS premium materials and comprehensive upgrades
- Add permits, disposal, and cleanup as needed
- Include appropriate code compliance upgrades for ${jobMeta.serviceType}
- Be specific about quantities and realistic about scope
- EXTEND scope, don't duplicate Good tier items`

    const userPrompt = `Service Type: ${jobMeta.serviceType}
${jobMeta.houseAge ? `House Age: ${jobMeta.houseAge} years` : ''}
${jobMeta.panelAmp ? `Panel Capacity: ${jobMeta.panelAmp} amps` : ''}
${jobMeta.location ? `Location: ${jobMeta.location}` : ''}

Damage Assessment:
${damageContext}

Current Basic Repairs (Good Tier):
${basicRepairsText}

Please expand this into Better and Best tiers with additional scope items.`

    // Call OpenAI GPT-4 API
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: JSON.stringify({ basic_repairs })
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 900,
        temperature: 0.4,
        response_format: { type: 'json_object' }
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    // Parse the JSON response
    let scopeResult: ExtendScopeResponse
    try {
      scopeResult = JSON.parse(content)
    } catch (error) {
      console.error('Failed to parse OpenAI response as JSON:', content)
      throw new Error('Invalid JSON response from scope extension')
    }

    // Validate response structure
    if (!scopeResult.better_repairs || !Array.isArray(scopeResult.better_repairs)) {
      throw new Error('Invalid response: missing or invalid better_repairs')
    }
    if (!scopeResult.best_repairs || !Array.isArray(scopeResult.best_repairs)) {
      throw new Error('Invalid response: missing or invalid best_repairs')
    }

    // Log successful scope extension
    console.log('Successfully extended scope for', jobMeta.serviceType)
    console.log('Generated Better tier with', scopeResult.better_repairs.length, 'items')
    console.log('Generated Best tier with', scopeResult.best_repairs.length, 'items')

    return new Response(
      JSON.stringify(scopeResult),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in extend-scope function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to extend repair scope'
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