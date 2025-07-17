/**
 * Sentry Error Logging Integration
 * 
 * Centralized error logging and monitoring for the customer journey system
 */

import { config } from './config'

// Error severity levels
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

// Journey-specific error context
export interface JourneyErrorContext {
  journeyStep?: string
  leadId?: string
  jobId?: string
  estimateId?: string
  userId?: string
  tenantId?: string
  featureFlags?: Record<string, boolean>
  userAgent?: string
  timestamp?: string
}

// Mock Sentry interface (replace with actual Sentry import in production)
interface SentryInterface {
  captureException: (error: Error, context?: any) => void
  captureMessage: (message: string, level?: string, context?: any) => void
  setContext: (key: string, context: any) => void
  setTag: (key: string, value: string) => void
  setUser: (user: any) => void
  addBreadcrumb: (breadcrumb: any) => void
}

// Mock Sentry implementation (replace with real Sentry in production)
const mockSentry: SentryInterface = {
  captureException: (error, context) => {
    if (config.logging.console) {
      console.error('[Sentry Mock] Exception:', error, context)
    }
  },
  captureMessage: (message, level, context) => {
    if (config.logging.console) {
      console.log(`[Sentry Mock] ${level?.toUpperCase()}: ${message}`, context)
    }
  },
  setContext: (key, context) => {
    if (config.logging.console) {
      console.log(`[Sentry Mock] Context ${key}:`, context)
    }
  },
  setTag: (key, value) => {
    if (config.logging.console) {
      console.log(`[Sentry Mock] Tag ${key}: ${value}`)
    }
  },
  setUser: (user) => {
    if (config.logging.console) {
      console.log('[Sentry Mock] User:', user)
    }
  },
  addBreadcrumb: (breadcrumb) => {
    if (config.logging.console) {
      console.log('[Sentry Mock] Breadcrumb:', breadcrumb)
    }
  }
}

// Use mock for now - replace with actual Sentry import
const Sentry = mockSentry

class JourneyLogger {
  private defaultContext: JourneyErrorContext = {}

  /**
   * Initialize logger with default context
   */
  init(context: JourneyErrorContext) {
    this.defaultContext = context
    
    if (config.logging.sentry) {
      Sentry.setUser({
        id: context.userId,
        tenant_id: context.tenantId
      })
      
      Sentry.setContext('journey', {
        step: context.journeyStep,
        leadId: context.leadId,
        jobId: context.jobId,
        estimateId: context.estimateId
      })
      
      Sentry.setContext('environment', {
        featureFlags: context.featureFlags,
        userAgent: context.userAgent || navigator.userAgent,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Log an error with journey context
   */
  logError(error: Error, context: Partial<JourneyErrorContext> = {}, severity: ErrorSeverity = 'error') {
    const fullContext = { ...this.defaultContext, ...context }
    
    // Add breadcrumb for journey tracking
    this.addBreadcrumb('error', `Journey error in ${fullContext.journeyStep}`, fullContext)
    
    if (config.logging.sentry) {
      Sentry.setContext('error_context', fullContext)
      Sentry.captureException(error)
    }
    
    // Always log to console in development
    if (config.logging.console) {
      console.error(`[Journey ${severity.toUpperCase()}]`, error, fullContext)
    }
  }

  /**
   * Log a message with journey context
   */
  logMessage(message: string, context: Partial<JourneyErrorContext> = {}, severity: ErrorSeverity = 'info') {
    const fullContext = { ...this.defaultContext, ...context }
    
    if (config.logging.sentry && severity === 'error') {
      Sentry.captureMessage(message, severity, { extra: fullContext })
    }
    
    // Log to console based on level
    if (config.logging.console && this.shouldLog(severity)) {
      const logFn = this.getLogFunction(severity)
      logFn(`[Journey ${severity.toUpperCase()}] ${message}`, fullContext)
    }
  }

  /**
   * Add breadcrumb for tracking user actions
   */
  addBreadcrumb(category: string, message: string, data?: any) {
    if (config.logging.sentry) {
      Sentry.addBreadcrumb({
        category,
        message,
        data,
        timestamp: Date.now() / 1000
      })
    }
    
    if (config.logging.console) {
      console.log(`[Journey Breadcrumb] ${category}: ${message}`, data)
    }
  }

  /**
   * Track journey step changes
   */
  trackStepChange(fromStep: string, toStep: string, context: Partial<JourneyErrorContext> = {}) {
    this.addBreadcrumb('journey', `Step change: ${fromStep} → ${toStep}`, context)
    
    if (config.logging.events.journey) {
      this.logMessage(`Journey step changed from ${fromStep} to ${toStep}`, context, 'info')
    }
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature: string, action: string, context: Partial<JourneyErrorContext> = {}) {
    this.addBreadcrumb('feature', `${feature}: ${action}`, context)
    
    if (config.logging.console) {
      console.log(`[Journey Feature] ${feature}: ${action}`, context)
    }
  }

  /**
   * Track API calls and responses
   */
  trackApiCall(endpoint: string, method: string, status: number, duration: number, context: Partial<JourneyErrorContext> = {}) {
    const isError = status >= 400
    const severity: ErrorSeverity = isError ? 'error' : 'info'
    
    this.addBreadcrumb('http', `${method} ${endpoint} - ${status} (${duration}ms)`, {
      ...context,
      status,
      duration,
      method,
      endpoint
    })
    
    if (isError) {
      this.logMessage(`API call failed: ${method} ${endpoint} returned ${status}`, context, 'error')
    }
  }

  /**
   * Update journey context
   */
  updateContext(context: Partial<JourneyErrorContext>) {
    this.defaultContext = { ...this.defaultContext, ...context }
    
    if (config.logging.sentry) {
      Sentry.setContext('journey', {
        step: this.defaultContext.journeyStep,
        leadId: this.defaultContext.leadId,
        jobId: this.defaultContext.jobId,
        estimateId: this.defaultContext.estimateId
      })
    }
  }

  private shouldLog(severity: ErrorSeverity): boolean {
    const level = config.logging.level as string
    if (level === 'debug') return true
    if (level === 'info' && ['fatal', 'error', 'warning', 'info'].includes(severity)) return true
    if (level === 'warning' && ['fatal', 'error', 'warning'].includes(severity)) return true
    if (level === 'error' && ['fatal', 'error'].includes(severity)) return true
    return false
  }

  private getLogFunction(severity: ErrorSeverity) {
    switch (severity) {
      case 'fatal':
      case 'error':
        return console.error
      case 'warning':
        return console.warn
      case 'info':
        return console.info
      case 'debug':
        return console.debug
      default:
        return console.log
    }
  }
}

// Export singleton instance
export const journeyLogger = new JourneyLogger()

// Convenience functions
export const logError = (error: Error, context?: Partial<JourneyErrorContext>, severity?: ErrorSeverity) => {
  journeyLogger.logError(error, context, severity)
}

export const logMessage = (message: string, context?: Partial<JourneyErrorContext>, severity?: ErrorSeverity) => {
  journeyLogger.logMessage(message, context, severity)
}

export const trackStepChange = (fromStep: string, toStep: string, context?: Partial<JourneyErrorContext>) => {
  journeyLogger.trackStepChange(fromStep, toStep, context)
}

export const trackFeatureUsage = (feature: string, action: string, context?: Partial<JourneyErrorContext>) => {
  journeyLogger.trackFeatureUsage(feature, action, context)
}

export const trackApiCall = (endpoint: string, method: string, status: number, duration: number, context?: Partial<JourneyErrorContext>) => {
  journeyLogger.trackApiCall(endpoint, method, status, duration, context)
}

// Initialize with feature flags
journeyLogger.init({
  featureFlags: config.featureFlags,
  timestamp: new Date().toISOString()
})

export default journeyLogger