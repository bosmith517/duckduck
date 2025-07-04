import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { address, city, state } = await req.json()

    if (!address || !city || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: address, city, state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Attom API key
    const attomApiKey = Deno.env.get('ATTOM_API_KEY')
    if (!attomApiKey) {
      return new Response(
        JSON.stringify({ error: 'Attom API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Attom Photos API
    // Documentation: https://cloud-help.attomdata.com/article/518-photos
    const attomUrl = new URL('https://search.onboard-apis.com/propertyapi/v1.0.0/photos/detail')
    attomUrl.searchParams.set('address1', address)
    attomUrl.searchParams.set('address2', `${city}, ${state}`)

    console.log('🔍 Calling Attom Photos API:', attomUrl.toString())

    const attomResponse = await fetch(attomUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'apikey': attomApiKey
      }
    })

    if (!attomResponse.ok) {
      const errorText = await attomResponse.text()
      console.error('❌ Attom API error:', attomResponse.status, errorText)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Attom API error: ${attomResponse.status}`,
          photos: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const attomData = await attomResponse.json()
    console.log('📸 Attom Photos API response:', JSON.stringify(attomData, null, 2))

    // Extract photo URLs from Attom response
    const photos: string[] = []
    
    if (attomData?.property && Array.isArray(attomData.property)) {
      for (const property of attomData.property) {
        if (property?.identifier && property?.location && property?.photos) {
          for (const photo of property.photos) {
            if (photo?.url) {
              photos.push(photo.url)
            }
          }
        }
      }
    }

    console.log(`✅ Found ${photos.length} photos for ${address}`)

    return new Response(
      JSON.stringify({
        success: true,
        photos,
        address: `${address}, ${city}, ${state}`,
        count: photos.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Error in get-attom-property-photos function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error', 
        details: error.message,
        photos: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})