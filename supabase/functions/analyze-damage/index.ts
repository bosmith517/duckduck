import { serve } from "https://deno.land/std@0.202.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface AnalyzeDamageRequest {
  photoUrls: string[]
  photoNotes: Record<string, string>
  jobDetails: {
    title: string
    description?: string
    location?: string
    serviceType: string
  }
  preferredUnits?: string[]
}

interface BasicRepair {
  description: string
  quantity: number
  unit: string
  item_type: 'labor' | 'material' | 'service' | 'other'
}

interface AnalyzeDamageResponse {
  damage_bullets: string[]
  hazard_paragraph: string
  basic_repairs: BasicRepair[]
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
    const { photoUrls, photoNotes, jobDetails, preferredUnits }: AnalyzeDamageRequest = await req.json()

    // Validate input
    if (!photoUrls || photoUrls.length === 0) {
      throw new Error('At least one photo URL is required')
    }

    if (photoUrls.length > 5) {
      throw new Error('Maximum 5 photos allowed')
    }

    // Build photo analysis context
    const photoContext = photoUrls.map((url, index) => {
      const note = photoNotes[url] || ''
      return `Photo ${index + 1}: ${url}${note ? ` (Note: ${note})` : ''}`
    }).join('\n')

    // Build service-specific units guidance
    const getServiceSpecificUnits = (serviceType: string) => {
      const baseUnits = ['hour', 'item', 'sqft', 'linear_ft', 'ft', 'each']
      
      switch (serviceType?.toLowerCase()) {
        case 'electrical':
        case 'electric':
          return [...baseUnits, 'panel', 'outlet', 'circuit', 'amp']
        case 'roofing':
        case 'roof':
          return [...baseUnits, 'bundle', 'roll', 'ridge_ft', 'sheet']
        case 'hvac':
        case 'heating':
        case 'cooling':
          return [...baseUnits, 'ton', 'btu', 'cfm', 'unit']
        case 'plumbing':
          return [...baseUnits, 'fixture', 'connection', 'joint', 'valve']
        default:
          return baseUnits
      }
    }
    
    const defaultUnits = getServiceSpecificUnits(jobDetails.serviceType)
    const allowedUnits = preferredUnits && preferredUnits.length > 0 ? preferredUnits : defaultUnits
    const unitsGuidance = `Preferred units: ${allowedUnits.join(', ')}`

    // Construct GPT-4 Vision prompt
    const systemPrompt = `You are an expert ${jobDetails.serviceType} contractor analyzing damage photos for repair estimates. 
Analyze the provided photos and generate a JSON response with damage assessment and basic repair scope.

IMPORTANT: Use the supplied **photo notes** to focus your attention on specific areas and concerns mentioned by the user.

Focus on:
- Visible damage, wear, or code violations relevant to ${jobDetails.serviceType}
- Safety hazards that need immediate attention
- Basic "Good" tier repairs (essential fixes only)
- Pay special attention to areas highlighted in photo notes

Return ONLY a JSON object with this exact structure:
{
  "damage_bullets": ["bullet point 1", "bullet point 2", ...],
  "hazard_paragraph": "concise safety assessment paragraph (~70 words)",
  "basic_repairs": [
    {
      "description": "repair description",
      "quantity": number,
      "unit": "preferred_unit_from_list",
      "item_type": "labor|material|service|other"
    }
  ]
}

Rules:
- Maximum 8 damage bullets
- Keep hazard paragraph concise (≤120 words, target ~70)
- Basic repairs should be essential fixes only (Good tier)
- No pricing information
- Be specific about quantities and units
- ${unitsGuidance}
- Use photo notes to guide your analysis focus`

    const userPrompt = `Service Type: ${jobDetails.serviceType}
Job Title: ${jobDetails.title}
Job Description: ${jobDetails.description || 'Not provided'}
Location: ${jobDetails.location || 'Not provided'}

Photos to analyze:
${photoContext}

Please analyze these photos and provide damage assessment with basic repair scope.`

    // Prepare messages for GPT-4 Vision
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt
          },
          ...photoUrls.map(url => ({
            type: 'image_url',
            image_url: {
              url: url,
              detail: 'high'
            }
          }))
        ]
      }
    ]

    // Call OpenAI GPT-4 Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.3,
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
    let analysisResult: AnalyzeDamageResponse
    try {
      analysisResult = JSON.parse(content)
    } catch (error) {
      // Log truncated content to avoid overwhelming logs
      const truncatedContent = content.length > 200 ? content.substring(0, 200) + '...' : content
      console.error('Failed to parse OpenAI response as JSON:', truncatedContent)
      throw new Error('Invalid JSON response from AI analysis')
    }

    // Validate response structure
    if (!analysisResult.damage_bullets || !Array.isArray(analysisResult.damage_bullets)) {
      throw new Error('Invalid response: missing or invalid damage_bullets')
    }
    if (!analysisResult.hazard_paragraph || typeof analysisResult.hazard_paragraph !== 'string') {
      throw new Error('Invalid response: missing or invalid hazard_paragraph')
    }
    if (!analysisResult.basic_repairs || !Array.isArray(analysisResult.basic_repairs)) {
      throw new Error('Invalid response: missing or invalid basic_repairs')
    }

    // Log successful analysis
    console.log('Successfully analyzed', photoUrls.length, 'photos for job:', jobDetails.title)
    console.log('Generated', analysisResult.damage_bullets.length, 'damage bullets')
    console.log('Generated', analysisResult.basic_repairs.length, 'basic repairs')

    return new Response(
      JSON.stringify(analysisResult),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in analyze-damage function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to analyze damage photos'
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