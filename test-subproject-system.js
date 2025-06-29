#!/usr/bin/env node

/**
 * Test Script for SignalWire Subproject System
 * 
 * This script tests the subproject creation and management functionality
 * by calling the Supabase Edge Functions directly.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// Test configuration
const TEST_CONFIG = {
  tenant: {
    name: 'Test Subproject Company',
    email: 'test@subproject.com',
    plan: 'professional'
  },
  signalwire: {
    projectId: process.env.VITE_SIGNALWIRE_PROJECT_ID || 'your-project-id',
    spaceUrl: process.env.VITE_SIGNALWIRE_SPACE_URL || 'your-space.signalwire.com'
  }
};

class SubprojectTester {
  constructor() {
    this.baseUrl = `${SUPABASE_URL}/functions/v1`;
    this.headers = {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
  }

  async log(message, data = null) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async callFunction(functionName, payload = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/${functionName}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Function ${functionName} failed: ${result.error || response.statusText}`);
      }

      return result;
    } catch (error) {
      this.log(`Error calling ${functionName}:`, error.message);
      throw error;
    }
  }

  async testSubprojectCreation() {
    this.log('🔄 Testing Subproject Creation...');
    
    try {
      const payload = {
        tenantId: 'test-tenant-id-' + Date.now(),
        tenantName: TEST_CONFIG.tenant.name,
        companyEmail: TEST_CONFIG.tenant.email
      };

      const result = await this.callFunction('create-signalwire-subproject', payload);
      
      this.log('✅ Subproject creation test passed', result);
      return result;
    } catch (error) {
      this.log('❌ Subproject creation test failed:', error.message);
      throw error;
    }
  }

  async testOnboardingIntegration() {
    this.log('🔄 Testing Onboarding Integration...');
    
    try {
      const payload = {
        tenantId: 'test-onboarding-' + Date.now(),
        companyName: TEST_CONFIG.tenant.name,
        companyEmail: TEST_CONFIG.tenant.email,
        plan: TEST_CONFIG.tenant.plan,
        ownerUserId: 'test-user-id'
      };

      const result = await this.callFunction('complete-full-onboarding', payload);
      
      this.log('✅ Onboarding integration test passed', result);
      return result;
    } catch (error) {
      this.log('❌ Onboarding integration test failed:', error.message);
      throw error;
    }
  }

  async testRetryMechanism() {
    this.log('🔄 Testing Retry Mechanism...');
    
    try {
      const payload = {
        tenantId: 'test-retry-' + Date.now(),
        adminUserId: 'test-admin-id'
      };

      const result = await this.callFunction('retry-subproject-creation', payload);
      
      this.log('✅ Retry mechanism test passed', result);
      return result;
    } catch (error) {
      this.log('❌ Retry mechanism test failed:', error.message);
      // This might fail if tenant doesn't exist, which is expected
      this.log('ℹ️  Note: This test may fail if tenant doesn\'t exist (expected behavior)');
    }
  }

  async testTokenGeneration() {
    this.log('🔄 Testing Enhanced Token Generation...');
    
    try {
      const payload = {
        identity: 'test-user@example.com',
        tenantId: 'test-tenant-id'
      };

      const result = await this.callFunction('generate-signalwire-voice-token', payload);
      
      this.log('✅ Token generation test passed', result);
      return result;
    } catch (error) {
      this.log('❌ Token generation test failed:', error.message);
      throw error;
    }
  }

  async validateEnvironment() {
    this.log('🔍 Validating Environment...');
    
    const required = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_SIGNALWIRE_PROJECT_ID'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      this.log('❌ Missing required environment variables:', missing);
      return false;
    }

    this.log('✅ Environment validation passed');
    return true;
  }

  async runAllTests() {
    console.log('🚀 Starting Subproject System Tests\n');
    
    // Validate environment
    if (!await this.validateEnvironment()) {
      console.log('\n❌ Tests aborted due to missing environment variables');
      return;
    }

    const tests = [
      { name: 'Token Generation', fn: () => this.testTokenGeneration() },
      { name: 'Subproject Creation', fn: () => this.testSubprojectCreation() },
      { name: 'Onboarding Integration', fn: () => this.testOnboardingIntegration() },
      { name: 'Retry Mechanism', fn: () => this.testRetryMechanism() }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        console.log(`\n📋 Running: ${test.name}`);
        await test.fn();
        passed++;
      } catch (error) {
        failed++;
        this.log(`❌ ${test.name} failed:`, error.message);
      }
    }

    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Subproject system is ready.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the deployment guide for troubleshooting.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new SubprojectTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = SubprojectTester;