export interface AddressComponents {
  street_number?: string
  route?: string
  locality?: string
  administrative_area_level_1?: string
  administrative_area_level_2?: string
  country?: string
  postal_code?: string
  subpremise?: string
  premise?: string
}

export interface FormattedAddress {
  full_address: string
  street_address: string
  city: string
  state: string
  state_code: string
  zip: string
  country: string
  country_code: string
  latitude?: number
  longitude?: number
}

export interface PlaceResult {
  place_id: string
  formatted_address: string
  address_components: AddressComponents
  geometry?: {
    location: {
      lat: number
      lng: number
    }
  }
}

/**
 * Parse Google Places API result into standardized address format
 */
export function parseGooglePlaceResult(place: any): FormattedAddress {
  const components: AddressComponents = {}
  
  // Parse address components
  if (place.address_components) {
    place.address_components.forEach((component: any) => {
      const types = component.types
      
      if (types.includes('street_number')) {
        components.street_number = component.long_name
      } else if (types.includes('route')) {
        components.route = component.long_name
      } else if (types.includes('locality')) {
        components.locality = component.long_name
      } else if (types.includes('administrative_area_level_1')) {
        components.administrative_area_level_1 = component.short_name
      } else if (types.includes('administrative_area_level_2')) {
        components.administrative_area_level_2 = component.long_name
      } else if (types.includes('country')) {
        components.country = component.long_name
      } else if (types.includes('postal_code')) {
        components.postal_code = component.long_name
      } else if (types.includes('subpremise')) {
        components.subpremise = component.long_name
      } else if (types.includes('premise')) {
        components.premise = component.long_name
      }
    })
  }

  // Build formatted address
  const streetParts = []
  if (components.street_number) streetParts.push(components.street_number)
  if (components.route) streetParts.push(components.route)
  if (components.subpremise) streetParts.push(`#${components.subpremise}`)
  if (components.premise) streetParts.push(components.premise)

  const street_address = streetParts.join(' ')
  const city = components.locality || ''
  const state = components.administrative_area_level_1 || ''
  const zip = components.postal_code || ''
  const country = components.country || ''

  return {
    full_address: place.formatted_address || '',
    street_address,
    city,
    state,
    state_code: state, // Google returns state codes in short_name
    zip,
    country,
    country_code: '', // Would need additional mapping for country codes
    latitude: place.geometry?.location?.lat(),
    longitude: place.geometry?.location?.lng()
  }
}

/**
 * Format address components into a readable string
 */
export function formatAddressString(address: Partial<FormattedAddress>): string {
  const parts = []
  
  if (address.street_address) parts.push(address.street_address)
  if (address.city) parts.push(address.city)
  if (address.state && address.zip) {
    parts.push(`${address.state} ${address.zip}`)
  } else if (address.state) {
    parts.push(address.state)
  } else if (address.zip) {
    parts.push(address.zip)
  }
  if (address.country && address.country !== 'United States') {
    parts.push(address.country)
  }
  
  return parts.join(', ')
}

/**
 * Validate if address has required components
 */
export function validateAddress(address: Partial<FormattedAddress>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!address.street_address?.trim()) {
    errors.push('Street address is required')
  }
  
  if (!address.city?.trim()) {
    errors.push('City is required')
  }
  
  if (!address.state?.trim()) {
    errors.push('State is required')
  }
  
  if (!address.zip?.trim()) {
    errors.push('ZIP code is required')
  } else if (!/^\d{5}(-\d{4})?$/.test(address.zip.trim())) {
    errors.push('ZIP code must be in format 12345 or 12345-6789')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Extract coordinates from address if available
 */
export function extractCoordinates(address: FormattedAddress): { lat: number; lng: number } | null {
  if (address.latitude && address.longitude) {
    return {
      lat: address.latitude,
      lng: address.longitude
    }
  }
  return null
}

/**
 * Check if Google Places API is loaded
 */
export function isGooglePlacesLoaded(): boolean {
  return !!(window as any).google?.maps?.places
}

/**
 * Load Google Places API script
 */
export function loadGooglePlacesAPI(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isGooglePlacesLoaded()) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Places API'))
    
    document.head.appendChild(script)
  })
}
