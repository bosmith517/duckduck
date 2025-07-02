import { supabase } from '../../supabaseClient'

export interface PropertyData {
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

class PropertyService {
  /**
   * Get property data from database or scrape from Redfin
   */
  async getPropertyData(address: string, tenantId?: string): Promise<PropertyData | null> {
    try {
      console.log('🔍 Getting property data for:', address)
      
      // First try to get from database
      if (tenantId) {
        const dbData = await this.getPropertyFromDatabase(address, tenantId)
        if (dbData) {
          console.log('📋 Found property data in database:', dbData)
          return dbData
        }
      }

      // If not in database or no tenant ID, try scraping
      console.log('🕷️ Scraping property data from Redfin...')
      const { data, error } = await supabase.functions.invoke('scrape-property-data', {
        body: { address, tenantId }
      })

      console.log('🔧 Scraping result - Error:', error)
      console.log('🔧 Scraping result - Data:', data)

      if (error) {
        console.error('❌ Error calling scraping function:', error)
        return null
      }

      if (data?.success && data?.property) {
        console.log('✅ Successfully got property data:', data.property)
        return this.transformDatabasePropertyData(data.property)
      }

      console.log('⚠️ No property data returned from scraping')
      return null
    } catch (error) {
      console.error('❌ Error fetching property data:', error)
      return null
    }
  }

  /**
   * Get property data from database
   */
  async getPropertyFromDatabase(address: string, tenantId: string): Promise<PropertyData | null> {
    try {
      const normalizedAddress = address.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim()
      
      const { data, error } = await supabase
        .from('property_data')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('normalized_address', normalizedAddress)
        .gte('scraped_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Within 7 days
        .single()

      if (error || !data) {
        return null
      }

      return this.transformDatabasePropertyData(data)
    } catch (error) {
      console.error('Error getting property from database:', error)
      return null
    }
  }

  /**
   * Transform database property data to PropertyData interface
   */
  private transformDatabasePropertyData(dbData: any): PropertyData {
    return {
      address: dbData.address,
      streetViewUrl: dbData.street_view_url || `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(dbData.address)}&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`,
      zestimate: dbData.estimated_value,
      yearBuilt: dbData.year_built,
      squareFootage: dbData.square_footage,
      lotSize: dbData.lot_size,
      bedrooms: dbData.bedrooms,
      bathrooms: dbData.bathrooms,
      propertyType: dbData.property_type || 'Residential Property',
      lastSoldDate: dbData.last_sold_date,
      lastSoldPrice: dbData.last_sold_price,
      taxAssessment: dbData.tax_assessment,
      photoUrl: dbData.property_image_url
    }
  }

  /**
   * Get fallback property data with Google Street View
   */
  private getFallbackPropertyData(address: string): PropertyData {
    console.log('🏠 Using fallback property data for:', address)
    return {
      address: address,
      streetViewUrl: `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(address)}&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`,
      propertyType: 'Residential Property',
      // Note: This is fallback mock data when Redfin API fails
      zestimate: undefined, // Don't show fake estimate
      yearBuilt: undefined,
      squareFootage: undefined,
      lotSize: 'Not available',
      bedrooms: undefined,
      bathrooms: undefined,
      lastSoldDate: undefined,
      lastSoldPrice: undefined,
      taxAssessment: undefined
    }
  }

  /**
   * Format property data for display
   */
  formatPropertyData(property: PropertyData): PropertyData {
    return {
      ...property,
      // Ensure we have a valid street view URL
      streetViewUrl: property.streetViewUrl || this.getFallbackPropertyData(property.address).streetViewUrl,
      // Format lot size
      lotSize: property.lotSize || 'Not available',
      // Default property type
      propertyType: property.propertyType || 'Residential Property'
    }
  }

  /**
   * Cache property data in local storage for performance
   */
  private cachePropertyData(address: string, data: PropertyData): void {
    try {
      const cacheKey = `property_${address.toLowerCase().replace(/\s+/g, '_')}`
      const cacheData = {
        data,
        timestamp: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    } catch (error) {
      console.warn('Failed to cache property data:', error)
    }
  }

  /**
   * Get cached property data if still valid
   */
  private getCachedPropertyData(address: string): PropertyData | null {
    try {
      const cacheKey = `property_${address.toLowerCase().replace(/\s+/g, '_')}`
      const cached = localStorage.getItem(cacheKey)
      
      if (cached) {
        const cacheData = JSON.parse(cached)
        
        if (cacheData.expires > Date.now()) {
          return cacheData.data
        } else {
          localStorage.removeItem(cacheKey)
        }
      }
      
      return null
    } catch (error) {
      console.warn('Failed to get cached property data:', error)
      return null
    }
  }

  /**
   * Get property data with caching
   */
  async getPropertyDataWithCache(address: string, tenantId?: string): Promise<PropertyData> {
    // Check cache first
    const cached = this.getCachedPropertyData(address)
    if (cached) {
      console.log('💾 Using cached property data for:', address, cached)
      return this.formatPropertyData(cached)
    }

    console.log('🆕 No cache found, fetching fresh property data for:', address)

    // Fetch fresh data
    const propertyData = await this.getPropertyData(address, tenantId)
    const formattedData = this.formatPropertyData(propertyData || this.getFallbackPropertyData(address))

    // Cache the result
    this.cachePropertyData(address, formattedData)

    return formattedData
  }

  /**
   * Clear cached property data for testing
   */
  clearCache(address?: string): void {
    try {
      if (address) {
        const cacheKey = `property_${address.toLowerCase().replace(/\s+/g, '_')}`
        localStorage.removeItem(cacheKey)
        console.log('🧹 Cleared cache for:', address)
      } else {
        // Clear all property cache
        const keys = Object.keys(localStorage).filter(key => key.startsWith('property_'))
        keys.forEach(key => localStorage.removeItem(key))
        console.log('🧹 Cleared all property cache')
      }
    } catch (error) {
      console.warn('Failed to clear property cache:', error)
    }
  }
}

export const propertyService = new PropertyService()
export default propertyService