/**
 * Secure logging utility that only logs in development mode
 * Prevents sensitive data from being exposed in production
 */

const isDevelopment = import.meta.env.DEV
const isDebugEnabled = import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true'

// Sanitize sensitive data before logging
const sanitize = (data: any): any => {
  if (typeof data !== 'object' || data === null) return data
  
  const sensitive = ['password', 'token', 'access_token', 'refresh_token', 'api_key', 'secret']
  const sanitized = { ...data }
  
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase()
    
    // Check if key contains sensitive words
    if (sensitive.some(s => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]'
    }
    // Mask email addresses partially
    else if (lowerKey.includes('email') && typeof sanitized[key] === 'string') {
      const email = sanitized[key]
      const [user, domain] = email.split('@')
      if (domain) {
        sanitized[key] = `${user.substring(0, 2)}***@${domain}`
      }
    }
    // Mask UUIDs/IDs partially
    else if ((lowerKey.includes('id') || lowerKey === 'uuid') && typeof sanitized[key] === 'string') {
      const id = sanitized[key]
      if (id.length > 8) {
        sanitized[key] = `${id.substring(0, 4)}...${id.substring(id.length - 4)}`
      }
    }
    // Recursively sanitize nested objects
    else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key])
    }
  })
  
  return sanitized
}

export const logger = {
  /**
   * Log general information (development only)
   */
  log: (...args: any[]) => {
    if (isDevelopment && isDebugEnabled) {
      console.log(...args.map(arg => 
        typeof arg === 'object' ? sanitize(arg) : arg
      ))
    }
  },

  /**
   * Log warnings (always shown but sanitized)
   */
  warn: (...args: any[]) => {
    console.warn(...args.map(arg => 
      typeof arg === 'object' ? sanitize(arg) : arg
    ))
  },

  /**
   * Log errors (always shown but sanitized)
   */
  error: (...args: any[]) => {
    console.error(...args.map(arg => 
      typeof arg === 'object' ? sanitize(arg) : arg
    ))
  },

  /**
   * Log debug information (only in development with debug flag)
   */
  debug: (...args: any[]) => {
    if (isDevelopment && isDebugEnabled) {
      console.debug(...args.map(arg => 
        typeof arg === 'object' ? sanitize(arg) : arg
      ))
    }
  },

  /**
   * Log performance metrics (development only)
   */
  time: (label: string) => {
    if (isDevelopment) {
      console.time(label)
    }
  },

  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label)
    }
  }
}

// Usage example:
// import { logger } from '@/utils/logger'
// 
// logger.log('User authenticated', { id: user.id, email: user.email })
// Output in dev: User authenticated { id: "1234...5678", email: "us***@example.com" }
// Output in prod: (nothing)