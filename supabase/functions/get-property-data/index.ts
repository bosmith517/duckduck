import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PropertyData {
  address: string
  streetViewUrl: string
  zestimate?: number
  yearBuilt?: number
  squareFootage?: number
  lotSize?: string
  bedrooms?: number
  bathrooms?: number
  propertyType?: string
  lastSoldDate?: string
  lastSoldPrice?: number
  taxAssessment?: number
  photoUrl?: string
}

async function getPropertyFromRedfin(address: string): Promise<PropertyData | null> {
  try {
    // Redfin's public search API endpoint
    const searchUrl = `https://www.redfin.com/stingray/api/gis?al=1&market=socal&min_stories=1&uipt=1,2,3,4,5,6,7,8&v=8&sf=1,2,3,5,6,7&num_homes=1&start=0&region_id=&region_type=&search_location=${encodeURIComponent(address)}`
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.redfin.com/'
      }
    })

    if (!response.ok) {
      console.log('Redfin search failed, trying alternative approach')
      return await getPropertyFromRedfinSearch(address)
    }

    const data = await response.text()
    
    // Redfin returns JSONP, need to extract JSON
    const jsonMatch = data.match(/\{.*\}/)
    if (!jsonMatch) {
      throw new Error('Invalid Redfin response format')
    }

    const propertyData = JSON.parse(jsonMatch[0])
    
    if (propertyData.homes && propertyData.homes.length > 0) {
      const home = propertyData.homes[0]
      
      return {
        address: home.streetLine?.public || address,
        streetViewUrl: `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(address)}&key=${Deno.env.get('GOOGLE_PLACES_API_KEY')}`,
        zestimate: home.price || home.lastSoldPrice,
        yearBuilt: home.yearBuilt,
        squareFootage: home.sqFt?.value,
        lotSize: home.lotSize?.value ? `${home.lotSize.value} ${home.lotSize.units || 'sq ft'}` : undefined,
        bedrooms: home.beds,
        bathrooms: home.baths,
        propertyType: home.propertyType,
        lastSoldDate: home.lastSoldDate,
        lastSoldPrice: home.lastSoldPrice,
        taxAssessment: home.taxRecord?.value,
        photoUrl: home.photos?.[0]?.url
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching from Redfin:', error)
    return null
  }
}

async function getPropertyFromRedfinSearch(address: string): Promise<PropertyData | null> {
  try {
    // Alternative Redfin search approach
    const searchUrl = `https://www.redfin.com/stingray/api/location/search?location=${encodeURIComponent(address)}&v=2`
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.redfin.com/'
      }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.text()
    const jsonMatch = data.match(/\{.*\}/)
    if (!jsonMatch) {
      return null
    }

    const searchResult = JSON.parse(jsonMatch[0])
    
    if (searchResult.exactMatch) {
      const property = searchResult.exactMatch
      
      // Get detailed property info
      if (property.id) {
        const detailUrl = `https://www.redfin.com/stingray/api/home/details/avm?propertyId=${property.id}&accessLevel=1`
        
        const detailResponse = await fetch(detailUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.redfin.com/'
          }
        })

        if (detailResponse.ok) {
          const detailText = await detailResponse.text()
          const detailMatch = detailText.match(/\{.*\}/)
          
          if (detailMatch) {
            const details = JSON.parse(detailMatch[0])
            const home = details.avm
            
            return {
              address: property.name || address,
              streetViewUrl: `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(address)}&key=${Deno.env.get('GOOGLE_PLACES_API_KEY')}`,
              zestimate: home?.estimate?.high,
              yearBuilt: home?.yearBuilt,
              squareFootage: home?.sqFt,
              bedrooms: home?.beds,
              bathrooms: home?.baths,
              propertyType: home?.propertyType || 'Single Family Home',
              taxAssessment: home?.taxRecord?.value
            }
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error in alternative Redfin search:', error)
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address } = await req.json()

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Fetching property data for:', address)

    // Try to get property data from Redfin
    let propertyData = await getPropertyFromRedfin(address)

    // If Redfin fails, return basic data with Google Street View
    if (!propertyData) {
      console.log('Redfin lookup failed, returning basic property data')
      propertyData = {
        address: address,
        streetViewUrl: `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(address)}&key=${Deno.env.get('GOOGLE_PLACES_API_KEY')}`,
        propertyType: 'Residential Property'
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        property: propertyData 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in get-property-data function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch property data',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})