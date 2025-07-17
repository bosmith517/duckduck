/**
 * Unit Tests for Feature Flag Configuration
 * 
 * Tests the feature flag system to ensure proper boolean conversion
 * and default value handling.
 */

import { isFeatureEnabled } from '../config'

// Mock environment variables for testing
const originalEnv = { ...import.meta.env }

beforeEach(() => {
  // Reset environment for each test
  Object.keys(import.meta.env).forEach(key => {
    if (key.startsWith('VITE_ENABLE_')) {
      delete (import.meta.env as any)[key]
    }
  })
})

afterAll(() => {
  // Restore original environment
  Object.assign(import.meta.env, originalEnv)
})

describe('Feature Flag Configuration', () => {
  describe('isFeatureEnabled', () => {
    test('should return true for enabled features', () => {
      // Set environment variable to true
      ;(import.meta.env as any).VITE_ENABLE_UNIFIED_JOURNEY = 'true'
      
      // Re-import to get updated config
      jest.resetModules()
      const { isFeatureEnabled } = require('../config')
      
      expect(isFeatureEnabled('unifiedJourney')).toBe(true)
    })

    test('should return false for disabled features', () => {
      ;(import.meta.env as any).VITE_ENABLE_UNIFIED_JOURNEY = 'false'
      
      jest.resetModules()
      const { isFeatureEnabled } = require('../config')
      
      expect(isFeatureEnabled('unifiedJourney')).toBe(false)
    })

    test('should handle string "false" as boolean false', () => {
      ;(import.meta.env as any).VITE_ENABLE_AI_SUGGESTIONS = 'false'
      
      jest.resetModules()
      const { isFeatureEnabled } = require('../config')
      
      expect(isFeatureEnabled('aiSuggestions')).toBe(false)
    })

    test('should return default true for unified journey when undefined', () => {
      // Don't set any environment variable, should use default
      jest.resetModules()
      const { isFeatureEnabled } = require('../config')
      
      expect(isFeatureEnabled('unifiedJourney')).toBe(true)
    })

    test('should return default false for photo batching when undefined', () => {
      jest.resetModules()
      const { isFeatureEnabled } = require('../config')
      
      expect(isFeatureEnabled('photoBatching')).toBe(false)
    })

    test('should handle all feature flags', () => {
      ;(import.meta.env as any).VITE_ENABLE_UNIFIED_JOURNEY = 'true'
      ;(import.meta.env as any).VITE_ENABLE_AI_SUGGESTIONS = 'true'
      ;(import.meta.env as any).VITE_ENABLE_REAL_TIME_SYNC = 'true'
      ;(import.meta.env as any).VITE_ENABLE_PHOTO_BATCHING = 'true'
      ;(import.meta.env as any).VITE_ENABLE_SENTRY_LOGGING = 'true'
      
      jest.resetModules()
      const { isFeatureEnabled } = require('../config')
      
      expect(isFeatureEnabled('unifiedJourney')).toBe(true)
      expect(isFeatureEnabled('aiSuggestions')).toBe(true)
      expect(isFeatureEnabled('realTimeSync')).toBe(true)
      expect(isFeatureEnabled('photoBatching')).toBe(true)
      expect(isFeatureEnabled('sentryLogging')).toBe(true)
    })

    test('should handle mixed true/false values', () => {
      ;(import.meta.env as any).VITE_ENABLE_UNIFIED_JOURNEY = 'true'
      ;(import.meta.env as any).VITE_ENABLE_AI_SUGGESTIONS = 'false'
      ;(import.meta.env as any).VITE_ENABLE_REAL_TIME_SYNC = 'true'
      
      jest.resetModules()
      const { isFeatureEnabled } = require('../config')
      
      expect(isFeatureEnabled('unifiedJourney')).toBe(true)
      expect(isFeatureEnabled('aiSuggestions')).toBe(false)
      expect(isFeatureEnabled('realTimeSync')).toBe(true)
    })
  })

  describe('config object', () => {
    test('should have correct structure', () => {
      jest.resetModules()
      const { config } = require('../config')
      
      expect(config).toHaveProperty('featureFlags')
      expect(config).toHaveProperty('journey')
      expect(config).toHaveProperty('realTime')
      expect(config).toHaveProperty('logging')
      
      expect(config.journey).toHaveProperty('enabled')
      expect(config.journey).toHaveProperty('autoAdvanceSteps')
      expect(config.journey).toHaveProperty('realTimeUpdates')
      
      expect(config.realTime).toHaveProperty('enabled')
      expect(config.realTime).toHaveProperty('channels')
    })

    test('should have consistent feature flag mappings', () => {
      ;(import.meta.env as any).VITE_ENABLE_UNIFIED_JOURNEY = 'true'
      ;(import.meta.env as any).VITE_ENABLE_REAL_TIME_SYNC = 'false'
      
      jest.resetModules()
      const { config } = require('../config')
      
      expect(config.journey.enabled).toBe(true)
      expect(config.journey.realTimeUpdates).toBe(false)
      expect(config.realTime.enabled).toBe(false)
    })
  })
})

describe('Phone Number Normalization', () => {
  const { normalizePhoneNumber, phoneNumbersMatch } = require('../phoneUtils')

  test('should normalize US phone numbers', () => {
    expect(normalizePhoneNumber('555-123-4567')).toBe('+15551234567')
    expect(normalizePhoneNumber('(555) 123-4567')).toBe('+15551234567')
    expect(normalizePhoneNumber('555.123.4567')).toBe('+15551234567')
    expect(normalizePhoneNumber('5551234567')).toBe('+15551234567')
  })

  test('should handle 11-digit numbers', () => {
    expect(normalizePhoneNumber('1-555-123-4567')).toBe('+15551234567')
    expect(normalizePhoneNumber('15551234567')).toBe('+15551234567')
  })

  test('should return null for invalid numbers', () => {
    expect(normalizePhoneNumber('')).toBe(null)
    expect(normalizePhoneNumber('abc')).toBe(null)
    expect(normalizePhoneNumber('123')).toBe(null)
    expect(normalizePhoneNumber(null)).toBe(null)
    expect(normalizePhoneNumber(undefined)).toBe(null)
  })

  test('should detect matching phone numbers', () => {
    expect(phoneNumbersMatch('555-123-4567', '(555) 123-4567')).toBe(true)
    expect(phoneNumbersMatch('5551234567', '+1-555-123-4567')).toBe(true)
    expect(phoneNumbersMatch('555-123-4567', '555-123-4568')).toBe(false)
  })
})

describe('Edge Function Rollback Test', () => {
  // This would be an integration test that calls the actual Edge Function
  // with invalid data to test rollback behavior
  test.skip('should rollback transaction on error', async () => {
    // This test would require actual Supabase setup and is marked as skip
    // for now. In a real test environment, you would:
    // 1. Call the convert-lead-to-job function with invalid data
    // 2. Verify that no partial records were created
    // 3. Ensure database is in consistent state
    
    expect(true).toBe(true) // Placeholder
  })
})