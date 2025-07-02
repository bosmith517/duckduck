import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface PropertyData {
  address: string
  normalizedAddress: string
  city?: string
  state?: string
  zipCode?: string
  propertyType?: string
  yearBuilt?: number
  squareFootage?: number
  lotSize?: string
  bedrooms?: number
  bathrooms?: number
  estimatedValue?: number
  lastSoldPrice?: number
  lastSoldDate?: string
  taxAssessment?: number
  streetViewUrl?: string
  propertyImageUrl?: string
  redfinUrl?: string
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
}

async function scrapePropertyFromAnySource(address: string): Promise<PropertyData | null> {
  try {
    console.log('🔍 Finding property via Google search for:', address)
    
    // Search Google for the property on any real estate site
    const googleQuery = `"${address}" (site:redfin.com OR site:zillow.com OR site:realtor.com OR site:trulia.com OR site:homes.com)`
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`
    
    console.log('🔎 Google search URL:', googleUrl)
    
    const googleResponse = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    })

    if (!googleResponse.ok) {
      console.log('❌ Google search failed:', googleResponse.status)
      return null
    }

    const googleHtml = await googleResponse.text()
    console.log('📄 Got Google results, length:', googleHtml.length)

    // Extract property URL from Google search results - try any real estate site
    let propertyUrl = null
    let dataSource = 'unknown'
    
    // Look for property URLs from major real estate sites
    const sitePatterns = [
      { name: 'redfin', pattern: /https:\/\/www\.redfin\.com\/[^"'\s>]+/ },
      { name: 'zillow', pattern: /https:\/\/www\.zillow\.com\/homedetails\/[^"'\s>]+/ },
      { name: 'realtor', pattern: /https:\/\/www\.realtor\.com\/realestateandhomes-detail\/[^"'\s>]+/ },
      { name: 'trulia', pattern: /https:\/\/www\.trulia\.com\/p\/[^"'\s>]+/ },
      { name: 'homes', pattern: /https:\/\/www\.homes\.com\/property\/[^"'\s>]+/ }
    ]
    
    for (const site of sitePatterns) {
      const match = googleHtml.match(site.pattern)
      if (match) {
        propertyUrl = match[0].split('"')[0].split("'")[0] // Clean up any trailing quotes
        dataSource = site.name
        console.log(`🏠 Found ${site.name} property URL:`, propertyUrl)
        break
      }
    }
    
    // If no direct match, try URL-encoded versions
    if (!propertyUrl) {
      const encodedPatterns = [
        { name: 'redfin', pattern: /redfin\.com%2F[^"'\s>]+/ },
        { name: 'zillow', pattern: /zillow\.com%2Fhomedetails%2F[^"'\s>]+/ },
        { name: 'realtor', pattern: /realtor\.com%2Frealestateandhomes-detail%2F[^"'\s>]+/ }
      ]
      
      for (const site of encodedPatterns) {
        const match = googleHtml.match(site.pattern)
        if (match) {
          propertyUrl = 'https://www.' + decodeURIComponent(match[0].replace(/%2F/g, '/'))
          dataSource = site.name
          console.log(`🏠 Found encoded ${site.name} URL:`, propertyUrl)
          break
        }
      }
    }
    
    // Debug: Show what real estate sites we found and extract sample URLs
    if (!propertyUrl) {
      const allSites = ['redfin.com', 'zillow.com', 'realtor.com', 'trulia.com', 'homes.com']
      const foundSites = allSites.filter(site => googleHtml.includes(site))
      console.log('🔍 Found real estate sites in results:', foundSites)
      
      if (foundSites.length === 0) {
        console.log('❌ No real estate sites found in Google results')
      } else {
        console.log('❌ Found sites but could not extract property URLs')
        
        // Show sample URL patterns for debugging
        for (const site of foundSites) {
          const siteMatches = googleHtml.match(new RegExp(`[^"'\\s>]{0,100}${site.replace('.', '\\.')}[^"'\\s>]{0,100}`, 'gi')) || []
          console.log(`🔍 Sample ${site} patterns:`, siteMatches.slice(0, 2))
        }
        
        // Try to find any URLs that might be property pages
        const urlPatterns = [
          /https?:\/\/[^"'\s>]*(?:redfin|zillow|realtor|trulia|homes)\.com[^"'\s>]*/gi,
          /\/url\?q=([^&]+)/gi  // Google's redirect pattern
        ]
        
        for (const pattern of urlPatterns) {
          const matches = googleHtml.match(pattern) || []
          if (matches.length > 0) {
            console.log('🔍 Found URL patterns:', matches.slice(0, 3))
          }
        }
      }
      return null
    }

    // Wait a bit to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Fetch the property page with Google as referer
    const propertyResponse = await fetch(propertyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'max-age=0',
      }
    })

    if (!propertyResponse.ok) {
      console.log('❌ Property page fetch failed:', propertyResponse.status)
      return null
    }

    const propertyHtml = await propertyResponse.text()
    console.log('📄 Got property page, length:', propertyHtml.length)

    // Extract property data using regex patterns
    const propertyData: PropertyData = {
      address: address,
      normalizedAddress: normalizeAddress(address),
      redfinUrl: propertyUrl
    }

    // Extract price/value
    const priceMatch = propertyHtml.match(/\$([0-9,]+)/)
    if (priceMatch) {
      propertyData.estimatedValue = parseInt(priceMatch[1].replace(/,/g, ''))
    }

    // Extract beds/baths
    const bedsMatch = propertyHtml.match(/(\d+)\s*bed/i)
    if (bedsMatch) {
      propertyData.bedrooms = parseInt(bedsMatch[1])
    }

    const bathsMatch = propertyHtml.match(/(\d+(?:\.\d+)?)\s*bath/i)
    if (bathsMatch) {
      propertyData.bathrooms = parseFloat(bathsMatch[1])
    }

    // Extract square footage
    const sqftMatch = propertyHtml.match(/([0-9,]+)\s*sq\.?\s*ft/i)
    if (sqftMatch) {
      propertyData.squareFootage = parseInt(sqftMatch[1].replace(/,/g, ''))
    }

    // Extract year built
    const yearMatch = propertyHtml.match(/built\s+in\s+(\d{4})/i)
    if (yearMatch) {
      propertyData.yearBuilt = parseInt(yearMatch[1])
    }

    // Extract lot size
    const lotMatch = propertyHtml.match(/lot:\s*([0-9,]+(?:\.\d+)?)\s*(acres?|sq\.?\s*ft)/i)
    if (lotMatch) {
      propertyData.lotSize = `${lotMatch[1]} ${lotMatch[2]}`
    }

    // Extract property type
    if (propertyHtml.includes('Single Family') || propertyHtml.includes('single-family')) {
      propertyData.propertyType = 'Single Family Home'
    } else if (propertyHtml.includes('Condo') || propertyHtml.includes('condo')) {
      propertyData.propertyType = 'Condominium'
    } else if (propertyHtml.includes('Townhouse') || propertyHtml.includes('townhome')) {
      propertyData.propertyType = 'Townhouse'
    }

    // Add Google Street View URL
    propertyData.streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(address)}&key=${Deno.env.get('GOOGLE_PLACES_API_KEY')}`

    // Try to extract property image
    const imageMatch = propertyHtml.match(/"(https:\/\/ssl\.cdn-redfin\.com\/photo\/[^"]+)"/i)
    if (imageMatch) {
      propertyData.propertyImageUrl = imageMatch[1]
    }

    console.log('✅ Successfully scraped property data:', propertyData)
    return propertyData

  } catch (error) {
    console.error('❌ Error scraping Redfin property:', error)
    return null
  }
}

async function savePropertyData(propertyData: PropertyData, tenantId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('property_data')
      .upsert({
        tenant_id: tenantId,
        address: propertyData.address,
        normalized_address: propertyData.normalizedAddress,
        city: propertyData.city,
        state: propertyData.state,
        zip_code: propertyData.zipCode,
        property_type: propertyData.propertyType,
        year_built: propertyData.yearBuilt,
        square_footage: propertyData.squareFootage,
        lot_size: propertyData.lotSize,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        estimated_value: propertyData.estimatedValue,
        last_sold_price: propertyData.lastSoldPrice,
        last_sold_date: propertyData.lastSoldDate,
        tax_assessment: propertyData.taxAssessment,
        street_view_url: propertyData.streetViewUrl,
        property_image_url: propertyData.propertyImageUrl,
        redfin_url: propertyData.redfinUrl,
        scraped_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Error saving property data:', error)
      return false
    }

    console.log('✅ Property data saved to database')
    return true
  } catch (error) {
    console.error('❌ Error in savePropertyData:', error)
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address, tenantId } = await req.json()

    if (!address || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Address and tenantId are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🔍 Scraping property data for:', address, 'tenant:', tenantId)

    // Check if we already have recent data for this property
    const normalizedAddr = normalizeAddress(address)
    const { data: existingData } = await supabase
      .from('property_data')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('normalized_address', normalizedAddr)
      .gte('scraped_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Within 7 days
      .single()

    if (existingData) {
      console.log('📋 Using existing property data from database')
      return new Response(
        JSON.stringify({ 
          success: true, 
          property: existingData,
          cached: true 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Scrape fresh data
    const propertyData = await scrapePropertyFromAnySource(address)

    if (!propertyData) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not scrape property data from Redfin',
          success: false 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Save to database
    const saved = await savePropertyData(propertyData, tenantId)
    if (!saved) {
      console.warn('⚠️ Could not save property data to database, but returning scraped data')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        property: propertyData,
        cached: false 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in scrape-property-data function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to scrape property data',
        details: error.message,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})