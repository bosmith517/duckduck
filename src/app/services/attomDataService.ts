import { supabase } from '../../supabaseClient'

export interface AttomPropertyDetails {
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

export interface AttomPropertyValuation {
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

export interface AttomPropertySales {
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

export interface AttomComparableSales {
  property: Array<{
    identifier: {
      Id: string
      fips: string
      apn: string
    }
    location: {
      address: string
      city: string
      state: string
      zipCode: string
    }
    summary: {
      proptype: string
      yearbuilt: number
      bedrooms: number
      baths: number
      sqft: number
    }
    sale: {
      amount: {
        saleamt: number
      }
      calculation: {
        pricepersqft: number
      }
      transactionDetail: {
        saleDate: string
      }
    }
    vintage: {
      lastModified: string
    }
  }>
}

class AttomDataService {

  /**
   * Comprehensive property lookup using Supabase Edge Function
   * This replaces the direct API calls and uses the secure Edge Function
   */
  async getComprehensivePropertyData(
    address: string, 
    city?: string, 
    state?: string, 
    tenantId?: string
  ): Promise<any> {
    try {
      console.log(`🌐 Calling Supabase Edge Function for property lookup: ${address}`)

      // Check if we have the required parameters
      if (!address || !tenantId) {
        throw new Error('Address and tenant ID are required for property lookup')
      }

      const { data, error } = await supabase.functions.invoke('get-attom-property-data', {
        body: { 
          address, 
          city, 
          state, 
          tenantId 
        }
      })

      // Log the full response for debugging
      console.log('🔍 Edge Function Response:', { data, error })

      if (error) {
        console.error('❌ Error calling Attom property data function:', error)
        
        // Check if it's a function not found error
        if (error.message?.includes('Function not found') || error.message?.includes('404')) {
          throw new Error('Attom property data function not deployed. Please deploy with: supabase functions deploy get-attom-property-data')
        }
        
        throw new Error(`Edge Function error: ${error.message || 'Unknown error'}`)
      }

      if (data?.success && data?.property) {
        console.log('✅ Successfully got property data from Edge Function')
        return data.property
      }

      if (data?.error) {
        console.error('❌ Edge Function returned error:', data.error)
        throw new Error(`Attom API error: ${data.error}`)
      }

      throw new Error('No property data returned from Edge Function')
    } catch (error) {
      console.error('💥 Error in comprehensive property lookup:', error)
      throw error
    }
  }


  /**
   * Normalize address for consistent storage and lookup
   */
  private normalizeAddress(address: string): string {
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

  /**
   * Get property data from database by address
   */
  async getStoredPropertyData(address: string, tenantId: string): Promise<any> {
    try {
      const normalizedAddress = this.normalizeAddress(address)
      
      const { data, error } = await supabase
        .from('property_data')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('normalized_address', normalizedAddress)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found error is OK
        // Check for table not found errors
        if (error.code === 'PGRST202' || error.message?.includes('relation "property_data" does not exist')) {
          throw new Error('Property data table not found. Please apply database migrations first.')
        }
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          throw new Error('Permission denied accessing property data table. Check RLS policies.')
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('Error fetching stored property data:', error)
      // Re-throw with better error message if it's a database structure issue
      if (error.message?.includes('table not found') || error.message?.includes('relation') || error.message?.includes('permission denied')) {
        throw error
      }
      return null
    }
  }

  /**
   * Check if property data needs refresh (older than 30 days OR incomplete data)
   */
  needsRefresh(propertyData: any): boolean {
    if (!propertyData?.last_attom_sync) return true
    
    // Check if data is incomplete (missing key property details)
    const isIncomplete = !propertyData.property_type || 
                        !propertyData.year_built || 
                        !propertyData.square_footage ||
                        propertyData.attom_sync_status !== 'success'
    
    if (isIncomplete) {
      console.log('🔄 Property data incomplete, forcing refresh:', {
        hasPropertyType: !!propertyData.property_type,
        hasYearBuilt: !!propertyData.year_built,
        hasSquareFootage: !!propertyData.square_footage,
        syncStatus: propertyData.attom_sync_status
      })
      return true
    }
    
    const lastSync = new Date(propertyData.last_attom_sync)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    return lastSync < thirtyDaysAgo
  }

  /**
   * Smart property lookup with database caching
   * This is the main method to use for getting property data with Attom integration
   */
  async getPropertyDataWithCache(
    address: string, 
    city?: string, 
    state?: string, 
    tenantId?: string
  ): Promise<any> {
    try {
      // First check if we have recent data in the database
      if (tenantId) {
        const existingData = await this.getStoredPropertyData(address, tenantId)
        
        if (existingData && !this.needsRefresh(existingData)) {
          console.log('📋 Using recent property data from database:', existingData)
          return existingData
        }
        
        if (existingData && existingData.attom_sync_status === 'error') {
          // If we have an error record, don't retry for 24 hours
          const lastAttempt = new Date(existingData.last_attom_sync || 0)
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          
          if (lastAttempt > oneDayAgo) {
            console.log('⚠️ Skipping Attom API call due to recent error:', existingData.attom_error_message)
            return existingData
          }
        }
      }

      // Fetch fresh data from Attom API
      console.log('🌐 Fetching fresh property data from Attom API...')
      const freshData = await this.getComprehensivePropertyData(address, city, state, tenantId)
      
      return freshData
    } catch (error) {
      console.error('Error in smart property lookup:', error)
      
      // Return any existing data as fallback, even if stale
      if (tenantId) {
        const fallbackData = await this.getStoredPropertyData(address, tenantId)
        if (fallbackData) {
          console.log('📋 Returning stale data as fallback due to error')
          return fallbackData
        }
      }
      
      throw error
    }
  }

  /**
   * Bulk update properties with Attom data
   * Useful for refreshing existing property database
   */
  async bulkUpdateProperties(tenantId: string, limit: number = 50): Promise<void> {
    try {
      console.log(`🔄 Starting bulk property update for tenant ${tenantId} (limit: ${limit})`)
      
      // Get properties that need refresh
      const { data: properties, error } = await supabase
        .from('property_data')
        .select('address, city, state, last_attom_sync')
        .eq('tenant_id', tenantId)
        .or(
          'last_attom_sync.is.null,' +
          `last_attom_sync.lt.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`
        )
        .limit(limit)

      if (error) {
        throw error
      }

      if (!properties || properties.length === 0) {
        console.log('✅ No properties need updating')
        return
      }

      console.log(`📊 Found ${properties.length} properties to update`)

      // Process in batches to avoid rate limits
      const batchSize = 5
      for (let i = 0; i < properties.length; i += batchSize) {
        const batch = properties.slice(i, i + batchSize)
        
        await Promise.allSettled(
          batch.map(async (property) => {
            try {
              await this.getComprehensivePropertyData(
                property.address,
                property.city,
                property.state,
                tenantId
              )
              console.log(`✅ Updated: ${property.address}`)
            } catch (error) {
              console.error(`❌ Failed to update ${property.address}:`, error)
            }
          })
        )

        // Rate limiting - wait 2 seconds between batches
        if (i + batchSize < properties.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      console.log('🎉 Bulk update completed')
    } catch (error) {
      console.error('Error in bulk property update:', error)
      throw error
    }
  }
}

export const attomDataService = new AttomDataService()
export default attomDataService