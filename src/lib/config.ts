/**
 * Application Configuration
 * 
 * Feature flags and environment-based configuration
 */

// Environment variables (with defaults)
const env = {
  NODE_ENV: import.meta.env.MODE || 'development',
  ENABLE_UNIFIED_JOURNEY: import.meta.env.VITE_ENABLE_UNIFIED_JOURNEY || 'true',
  ENABLE_AI_SUGGESTIONS: import.meta.env.VITE_ENABLE_AI_SUGGESTIONS || 'true',
  ENABLE_REAL_TIME_SYNC: import.meta.env.VITE_ENABLE_REAL_TIME_SYNC || 'true',
  ENABLE_PHOTO_BATCHING: import.meta.env.VITE_ENABLE_PHOTO_BATCHING || 'false',
  ENABLE_SENTRY_LOGGING: import.meta.env.VITE_ENABLE_SENTRY_LOGGING || 'false',
  ENABLE_ESTIMATE_APPROVAL_FLOW: import.meta.env.VITE_ENABLE_ESTIMATE_APPROVAL_FLOW || 'false'
}

// Feature flags
export const featureFlags = {
  // Customer Journey System
  unifiedJourney: env.ENABLE_UNIFIED_JOURNEY === 'true',
  
  // AI-powered features
  aiSuggestions: env.ENABLE_AI_SUGGESTIONS === 'true',
  
  // Real-time synchronization
  realTimeSync: env.ENABLE_REAL_TIME_SYNC === 'true',
  
  // Photo batching and upload queues
  photoBatching: env.ENABLE_PHOTO_BATCHING === 'true',
  
  // Error tracking and logging
  sentryLogging: env.ENABLE_SENTRY_LOGGING === 'true',
  
  // Estimate approval workflow (lead -> estimate -> approval -> job)
  estimateApprovalFlow: env.ENABLE_ESTIMATE_APPROVAL_FLOW === 'true',
} as const

// Environment helpers
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

// Configuration object
export const config = {
  env,
  featureFlags,
  isDevelopment,
  isProduction,
  isTest,
  
  // Customer Journey Configuration
  journey: {
    enabled: featureFlags.unifiedJourney,
    autoAdvanceSteps: featureFlags.unifiedJourney,
    realTimeUpdates: featureFlags.realTimeSync,
    aiSuggestions: featureFlags.aiSuggestions,
    crossTabSync: featureFlags.realTimeSync,
    persistState: true,
    maxHistoryEntries: 50,
    
    // Event configuration
    events: {
      debounceMs: 100,
      maxRetries: 3,
      timeoutMs: 5000
    },
    
    // AI configuration
    ai: {
      enabled: featureFlags.aiSuggestions,
      maxSuggestions: 3,
      contextWindow: 10,
      refreshInterval: 60000, // 1 minute
      confidenceThreshold: 0.6
    },
    
    // Photo configuration
    photos: {
      batchingEnabled: featureFlags.photoBatching,
      maxBatchSize: 10,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      previewQuality: 0.8
    }
  },
  
  // Real-time subscriptions
  realTime: {
    enabled: featureFlags.realTimeSync,
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000, // 30 seconds
    
    // Channel subscriptions
    channels: {
      leads: featureFlags.unifiedJourney,
      siteVisits: featureFlags.unifiedJourney,
      estimates: featureFlags.unifiedJourney,
      jobs: featureFlags.unifiedJourney,
      photos: featureFlags.photoBatching,
      approvals: featureFlags.estimateApprovalFlow
    }
  },
  
  // Logging and monitoring
  logging: {
    sentry: featureFlags.sentryLogging,
    console: isDevelopment,
    level: isDevelopment ? 'debug' : 'error',
    
    // What to log
    events: {
      journey: isDevelopment || featureFlags.unifiedJourney,
      ai: isDevelopment || featureFlags.aiSuggestions,
      realTime: isDevelopment || featureFlags.realTimeSync,
      photos: isDevelopment || featureFlags.photoBatching
    }
  }
} as const

// Type exports
export type FeatureFlags = typeof featureFlags
export type Config = typeof config

// Helper functions
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return featureFlags[feature]
}

export const getConfig = () => config

// Development helpers
if (isDevelopment) {
  console.log('🚀 Application Configuration:', {
    environment: env.NODE_ENV,
    featureFlags,
    journey: config.journey,
    realTime: config.realTime
  })
}