import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Attom Data API Configuration
const ATTOM_API_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'

interface AttomPropertyDetails {
  identifier: {
    Id: string
    fips: string
    apn: string
    attomId: string
  }
  location: {
    address: string
    city: string
    state: string
    zipCode: string
    county: string
    countrySecSubd: string
    geoIdV4: string
  }
  summary: {
    propclass: string
    propsubtype: string
    proptype: string
    yearbuilt: number
    effectiveyearbuilt: number
    stories: number
    rooms: number
    baths: number
    partialBaths: number
    bedrooms: number
    lotsize: number
    sqft: number
    sqftlot: number
  }
  building: {
    construction: {
      foundationtype: string
      frametype: string
      rooftype: string
      walltype: string
      quality: string
      condition: string
    }
    interior: {
      bsmttype: string
      fireplaces: number
      fueltype: string
      heatingtype: string
      ac: string
      flooring: string
    }
    parking: {
      garagetype: string
      garagespaces: number
      parkingspaces: number
    }
    rooms: {
      bathsfull: number
      bathspartial: number
      bathstotal: number
      bedroomstotal: number
      roomstotal: number
    }
  }
  vintage: {
    lastModified: string
    pubDate: string
  }
}

interface AttomPropertyValuation {
  identifier: {
    Id: string
    fips: string
    apn: string
  }
  valuation: {
    avm: {
      amount: {
        value: number
        high: number
        low: number
      }
      eventDate: string
      source: string
    }
    tax: {
      marketValue: number
      taxValue: number
      taxYear: number
    }
  }
}

interface AttomPropertySales {
  identifier: {
    Id: string
    fips: string
    apn: string
  }
  sale: {
    amount: {
      saleamt: number
      saleprice: number
    }
    calculation: {
      pricepersqft: number
    }
    saleTransactionType: {
      saleTransactionTypeDesc: string
    }
    transactionDetail: {
      saleDate: string
      deedDate: string
      deedType: string
      multiApnFlag: string
    }
  }
}

async function makeAttomRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
  const apiKey = Deno.env.get('ATTOM_API_KEY')
  
  if (!apiKey) {
    throw new Error('Attom Data API key not configured')
  }
  
  console.log('🔑 API Key status:', {
    hasApiKey: !!apiKey,
    keyLength: apiKey?.length || 0,
    keyPrefix: apiKey?.substring(0, 8) + '...'
  })

  const url = new URL(`${ATTOM_API_BASE_URL}${endpoint}`)
  
  // Add common parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.append(key, value.toString())
    }
  })

  console.log(`Making Attom API request to: ${url.toString()}`)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'apikey': apiKey
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Attom API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data
}

async function getPropertyDetails(address: string, city?: string, state?: string): Promise<AttomPropertyDetails | null> {
  try {
    // Attom API uses address1 and address2 parameters
    const params: Record<string, any> = {
      address1: address
    }
    
    // Build address2 as "city, state"
    if (city && state) {
      params.address2 = `${city}, ${state}`
    } else if (city) {
      params.address2 = city
    }

    console.log('🌐 Attom API Property Detail request:', {
      endpoint: '/property/expandedprofile',
      params: params,
      fullUrl: `${ATTOM_API_BASE_URL}/property/expandedprofile?${new URLSearchParams(params).toString()}`
    })

    const response = await makeAttomRequest<{ property: AttomPropertyDetails[] }>('/property/expandedprofile', params)
    
    console.log('📊 Property details response:', {
      hasProperty: !!response?.property,
      propertyCount: response?.property?.length || 0,
      firstProperty: response?.property?.[0] ? 'Found' : 'Not found',
      rawResponse: response
    })
    
    if (response.property && response.property.length > 0) {
      return response.property[0]
    }
    
    return null
  } catch (error) {
    console.error('Error fetching property details from Attom:', error)
    throw error
  }
}

async function getPropertyValuation(address: string, city?: string, state?: string): Promise<AttomPropertyValuation | null> {
  try {
    // Attom API uses address1 and address2 parameters
    const params: Record<string, any> = {
      address1: address
    }
    
    // Build address2 as "city, state"
    if (city && state) {
      params.address2 = `${city}, ${state}`
    } else if (city) {
      params.address2 = city
    }

    console.log('🌐 Attom API AVM request:', {
      endpoint: '/attomavm/detail',
      params: params
    })

    const response = await makeAttomRequest<{ property: AttomPropertyValuation[] }>('/attomavm/detail', params)
    
    if (response.property && response.property.length > 0) {
      return response.property[0]
    }
    
    return null
  } catch (error) {
    console.error('Error fetching property valuation from Attom:', error)
    throw error
  }
}

async function getPropertySalesHistory(address: string, city?: string, state?: string): Promise<AttomPropertySales[]> {
  try {
    // Attom API uses address1 and address2 parameters
    const params: Record<string, any> = {
      address1: address,
      pagesize: 10
    }
    
    // Build address2 as "city, state"
    if (city && state) {
      params.address2 = `${city}, ${state}`
    } else if (city) {
      params.address2 = city
    }

    console.log('🌐 Attom API Sales History request:', {
      endpoint: '/saleshistory/detail',
      params: params
    })

    const response = await makeAttomRequest<{ property: AttomPropertySales[] }>('/saleshistory/detail', params)
    
    return response.property || []
  } catch (error) {
    console.error('Error fetching property sales history from Attom:', error)
    throw error
  }
}

async function getComparableSales(
  address: string, 
  city?: string, 
  state?: string,
  radius: number = 0.5,
  saleDate: string = '2020-01-01'
): Promise<any> {
  try {
    // Temporarily disable comparable sales as the endpoint needs investigation
    console.log('Comparable sales temporarily disabled - focusing on core property data')
    return { property: [] }
    
    /* Commented out until we can verify the correct endpoint
    const params: Record<string, any> = {
      address1: address,
      radius,
      minSaleDate: saleDate,
      orderby: 'saleDate',
      pagesize: 10
    }

    // Attom API uses address2 for "city, state zip" format
    if (city && state) {
      params.address2 = `${city}, ${state}`
    } else if (city) {
      params.address2 = city
    }

    const response = await makeAttomRequest<any>('/property/sales', params)
    
    return response
    */
  } catch (error) {
    console.error('Error fetching comparable sales from Attom:', error)
    return { property: [] }
  }
}

function normalizeAddress(address: string): string {
  return address
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bCIRCLE\b/g, 'CIR')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
}

async function savePropertyData(propertyData: any, tenantId: string, supabase: any): Promise<void> {
  try {
    const { error } = await supabase
      .from('property_data')
      .upsert({
        ...propertyData,
        tenant_id: tenantId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,normalized_address'
      })

    if (error) {
      console.error('Error saving property data:', error)
      throw error
    }
  } catch (error) {
    console.error('Failed to save property data to database:', error)
    throw error
  }
}

async function savePropertyDataError(address: string, tenantId: string, error: any, supabase: any): Promise<void> {
  try {
    const normalizedAddress = normalizeAddress(address)
    
    await supabase
      .from('property_data')
      .upsert({
        address: normalizedAddress,
        normalized_address: normalizedAddress,
        tenant_id: tenantId,
        data_source: 'attom',
        attom_sync_status: 'error',
        attom_error_message: error.message,
        last_attom_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,normalized_address'
      })
  } catch (saveError) {
    console.error('Failed to save property data error:', saveError)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address, city, state, tenantId } = await req.json()

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Starting comprehensive property lookup for: ${address}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
      // Start with just property details to debug API issues
      console.log(`🔍 Attempting property lookup for: ${address}, ${city}, ${state}`)
      
      // Execute core API calls - start with just property details
      const [propertyDetails] = await Promise.allSettled([
        getPropertyDetails(address, city, state)
      ])
      
      // Try other endpoints only if property details works
      let valuation, salesHistory, comparableSales
      if (propertyDetails.status === 'fulfilled' && propertyDetails.value) {
        console.log('✅ Property details successful, trying other endpoints...')
        const [valuationResult, salesResult, compsResult] = await Promise.allSettled([
          getPropertyValuation(address, city, state),
          getPropertySalesHistory(address, city, state),
          getComparableSales(address, city, state)
        ])
        valuation = valuationResult
        salesHistory = salesResult  
        comparableSales = compsResult
      } else {
        console.log('❌ Property details failed, skipping other endpoints')
        valuation = { status: 'rejected', reason: 'Skipped due to property details failure' }
        salesHistory = { status: 'rejected', reason: 'Skipped due to property details failure' }
        comparableSales = { status: 'rejected', reason: 'Skipped due to property details failure' }
      }

      // Process results
      const details = propertyDetails.status === 'fulfilled' ? propertyDetails.value : null
      const valuationData = valuation.status === 'fulfilled' ? valuation.value : null
      const salesData = salesHistory.status === 'fulfilled' ? salesHistory.value : []
      const compsData = comparableSales.status === 'fulfilled' ? comparableSales.value : null

      // Normalize address for consistent lookups
      const normalizedAddress = normalizeAddress(address)

      // Combine all data into our property data format
      const propertyData = {
        // Basic info
        address: normalizedAddress,
        normalized_address: normalizedAddress,
        city: details?.address?.locality || city,
        state: details?.address?.countrySubd || state,
        zip_code: details?.address?.postal1,
        
        // Attom identifiers
        attom_id: details?.identifier?.attomId,
        attom_onboard: details?.identifier?.Id,
        attom_fips_code: details?.identifier?.fips,
        parcel_number: details?.identifier?.apn,
        
        // Property details - map from actual Attom structure
        property_type: details?.summary?.propClass,
        year_built: details?.summary?.yearBuilt,
        square_footage: details?.building?.size?.bldgSize,
        lot_size: details?.lot?.lotSize2?.toString(),
        bedrooms: details?.building?.rooms?.beds,
        bathrooms: details?.building?.rooms?.bathsTotal,
        stories: details?.building?.summary?.levels,
        total_rooms: details?.building?.rooms?.beds + details?.building?.rooms?.bathsTotal || null,
        garage_spaces: details?.building?.parking?.prkgSpaces ? parseInt(details.building.parking.prkgSpaces) : null,
        
        // Amenities - map from actual Attom structure
        pool: details?.lot?.poolType !== 'NO POOL',
        fireplace: false, // Not available in current data
        central_air: details?.utilities?.coolingType === 'CENTRAL',
        heating_type: null, // Not available in current response
        cooling_type: details?.utilities?.coolingType,
        roof_material: details?.building?.construction?.roofCover,
        exterior_walls: details?.building?.construction?.wallType,
        construction_quality: null, // Not directly available
        condition_rating: details?.building?.construction?.condition,
        
        // Financial data - map from valuation response
        market_value_estimate: valuationData?.avm?.amount?.value,
        market_value_date: valuationData?.avm?.eventDate ? new Date(valuationData.avm.eventDate) : null,
        tax_assessment: details?.assessment?.assessed?.assdTtlValue,
        tax_year: details?.assessment?.tax?.taxYear,
        
        // Sales data - map from sales history or property details
        last_sold_price: details?.sale?.amount?.saleAmt,
        last_sold_date: details?.sale?.saleTransDate ? new Date(details.sale.saleTransDate) : null,
        
        // Enhanced data arrays
        comparable_sales: compsData?.property?.map((comp: any) => ({
          address: comp.location?.address,
          sale_price: comp.sale?.amount?.saleamt,
          price_per_sqft: comp.sale?.calculation?.pricepersqft,
          sale_date: comp.sale?.transactionDetail?.saleDate,
          bedrooms: comp.summary?.bedrooms,
          bathrooms: comp.summary?.baths,
          sqft: comp.summary?.sqft,
          year_built: comp.summary?.yearbuilt
        })) || [],
        
        price_history: salesData.map((sale: any) => ({
          sale_price: sale.sale?.amount?.saleamt,
          sale_date: sale.sale?.transactionDetail?.saleDate,
          deed_date: sale.sale?.transactionDetail?.deedDate,
          deed_type: sale.sale?.transactionDetail?.deedType,
          transaction_type: sale.sale?.saleTransactionType?.saleTransactionTypeDesc,
          price_per_sqft: sale.sale?.calculation?.pricepersqft
        })),
        
        // Metadata
        data_source: 'attom',
        last_attom_sync: new Date().toISOString(),
        attom_sync_status: 'success',
        attom_raw_data: {
          details,
          valuation: valuationData,
          salesHistory: salesData,
          comparableSales: compsData
        }
      }

      // Save to database
      await savePropertyData(propertyData, tenantId, supabase)

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
      console.error('Error in comprehensive property lookup:', error)
      
      // Save error status
      await savePropertyDataError(address, tenantId, error, supabase)
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch property data from Attom API',
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Error in get-attom-property-data function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})