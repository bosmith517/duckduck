/**
 * Phone Number Normalization Utilities
 * 
 * Provides E.164 phone number normalization to prevent duplicate contacts
 * and ensure consistent phone number formatting across the system.
 */

// Regular expression patterns for phone number cleaning
const PHONE_PATTERNS = {
  // Remove all non-digit characters
  DIGITS_ONLY: /\D/g,
  
  // Common US phone patterns
  US_10_DIGIT: /^(\d{3})(\d{3})(\d{4})$/,
  US_11_DIGIT: /^1(\d{3})(\d{3})(\d{4})$/,
  
  // International patterns
  E164_PATTERN: /^\+[1-9]\d{1,14}$/,
  
  // Common formatting patterns to strip
  COMMON_FORMATS: /[\s\-\(\)\+\.]/g
}

/**
 * Normalize a phone number to E.164 format
 * 
 * @param phoneNumber Raw phone number string
 * @param defaultCountryCode Country code to use if none provided (default: '1' for US)
 * @returns Normalized E.164 phone number or null if invalid
 */
export function normalizePhoneNumber(phoneNumber: string | null | undefined, defaultCountryCode: string = '1'): string | null {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null
  }

  // Remove all formatting characters
  const cleaned = phoneNumber.replace(PHONE_PATTERNS.COMMON_FORMATS, '')
  
  // Extract only digits
  const digitsOnly = cleaned.replace(PHONE_PATTERNS.DIGITS_ONLY, '')
  
  if (!digitsOnly) {
    return null
  }

  // Handle different phone number lengths
  let normalized: string | null = null
  
  if (digitsOnly.length === 10 && defaultCountryCode === '1') {
    // US 10-digit number, add country code
    normalized = `+1${digitsOnly}`
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US 11-digit number with country code
    normalized = `+${digitsOnly}`
  } else if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    // International number, check if it needs country code
    if (phoneNumber.startsWith('+')) {
      // Already has + prefix, validate format
      if (PHONE_PATTERNS.E164_PATTERN.test(phoneNumber.replace(PHONE_PATTERNS.COMMON_FORMATS, ''))) {
        normalized = `+${digitsOnly}`
      }
    } else {
      // Add default country code
      normalized = `+${defaultCountryCode}${digitsOnly}`
    }
  }

  // Validate final format
  if (normalized && PHONE_PATTERNS.E164_PATTERN.test(normalized)) {
    return normalized
  }

  return null
}

/**
 * Format a normalized phone number for display
 * 
 * @param phoneNumber E.164 formatted phone number
 * @param format Display format type
 * @returns Formatted phone number for display
 */
export function formatPhoneNumber(phoneNumber: string | null | undefined, format: 'us' | 'international' | 'compact' = 'us'): string {
  if (!phoneNumber) {
    return ''
  }

  const normalized = normalizePhoneNumber(phoneNumber)
  if (!normalized) {
    return phoneNumber // Return original if normalization fails
  }

  const digits = normalized.replace(/\D/g, '')
  
  if (format === 'us' && digits.length === 11 && digits.startsWith('1')) {
    // US format: (555) 123-4567
    const areaCode = digits.substr(1, 3)
    const exchange = digits.substr(4, 3)
    const number = digits.substr(7, 4)
    return `(${areaCode}) ${exchange}-${number}`
  } else if (format === 'international') {
    // International format: +1 555 123 4567
    if (digits.startsWith('1') && digits.length === 11) {
      const country = digits.substr(0, 1)
      const areaCode = digits.substr(1, 3)
      const exchange = digits.substr(4, 3)
      const number = digits.substr(7, 4)
      return `+${country} ${areaCode} ${exchange} ${number}`
    } else {
      // Generic international format
      return normalized
    }
  } else if (format === 'compact') {
    // Compact format: 555-123-4567
    if (digits.length === 11 && digits.startsWith('1')) {
      const areaCode = digits.substr(1, 3)
      const exchange = digits.substr(4, 3)
      const number = digits.substr(7, 4)
      return `${areaCode}-${exchange}-${number}`
    } else {
      return normalized
    }
  }

  return normalized
}

/**
 * Check if two phone numbers are equivalent
 * 
 * @param phone1 First phone number
 * @param phone2 Second phone number
 * @returns True if the numbers are equivalent
 */
export function phoneNumbersMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const normalized1 = normalizePhoneNumber(phone1)
  const normalized2 = normalizePhoneNumber(phone2)
  
  return normalized1 !== null && normalized2 !== null && normalized1 === normalized2
}

/**
 * Validate phone number format
 * 
 * @param phoneNumber Phone number to validate
 * @returns Validation result with details
 */
export function validatePhoneNumber(phoneNumber: string | null | undefined): {
  isValid: boolean
  normalized: string | null
  error?: string
} {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      isValid: false,
      normalized: null,
      error: 'Phone number is required'
    }
  }

  const normalized = normalizePhoneNumber(phoneNumber)
  
  if (!normalized) {
    return {
      isValid: false,
      normalized: null,
      error: 'Invalid phone number format'
    }
  }

  return {
    isValid: true,
    normalized
  }
}

/**
 * Extract phone numbers from text
 * 
 * @param text Text to search for phone numbers
 * @returns Array of normalized phone numbers found
 */
export function extractPhoneNumbers(text: string): string[] {
  if (!text) return []

  // Common phone number patterns
  const patterns = [
    /\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    /\+?([0-9]{1,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{3,4})[-.\s]?([0-9]{3,4})/g
  ]

  const foundNumbers: string[] = []
  
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const normalized = normalizePhoneNumber(match[0])
      if (normalized && !foundNumbers.includes(normalized)) {
        foundNumbers.push(normalized)
      }
    }
  }

  return foundNumbers
}

/**
 * Create a phone number search query for database
 * 
 * @param phoneNumber Phone number to search for
 * @returns Array of possible phone number variations for database search
 */
export function createPhoneSearchVariations(phoneNumber: string | null | undefined): string[] {
  if (!phoneNumber) return []

  const normalized = normalizePhoneNumber(phoneNumber)
  if (!normalized) return [phoneNumber].filter(Boolean) as string[]

  const variations: string[] = [normalized]
  
  // Add common formatting variations
  const digits = normalized.replace(/\D/g, '')
  
  if (digits.length === 11 && digits.startsWith('1')) {
    const tenDigit = digits.substr(1)
    variations.push(
      tenDigit, // 5551234567
      `(${tenDigit.substr(0, 3)}) ${tenDigit.substr(3, 3)}-${tenDigit.substr(6)}`, // (555) 123-4567
      `${tenDigit.substr(0, 3)}-${tenDigit.substr(3, 3)}-${tenDigit.substr(6)}`, // 555-123-4567
      `${tenDigit.substr(0, 3)}.${tenDigit.substr(3, 3)}.${tenDigit.substr(6)}`, // 555.123.4567
      `1${tenDigit}`, // 15551234567
      `1-${tenDigit.substr(0, 3)}-${tenDigit.substr(3, 3)}-${tenDigit.substr(6)}` // 1-555-123-4567
    )
  }

  // Remove duplicates
  return [...new Set(variations)]
}

// Export utility object for easier importing
export const phoneUtils = {
  normalize: normalizePhoneNumber,
  format: formatPhoneNumber,
  match: phoneNumbersMatch,
  validate: validatePhoneNumber,
  extract: extractPhoneNumbers,
  searchVariations: createPhoneSearchVariations
}

export default phoneUtils