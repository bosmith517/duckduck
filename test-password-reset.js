// Quick test script for password reset system
// Run with: node test-password-reset.js

const SUPABASE_URL = 'https://eskpnhbemnxkxafjbbdx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here';

async function testPasswordReset() {
  console.log('Testing Password Reset System...\n');

  // Test 1: Request Password Reset
  console.log('1. Testing password reset request...');
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: 'test@example.com' // Change to a real email for testing
      })
    });

    const data = await response.json();
    console.log('Response:', response.status, data);
    
    if (response.status === 429) {
      console.log('❌ Rate limited - working as expected!');
    } else if (data.success) {
      console.log('✅ Password reset request sent successfully');
    } else {
      console.log('❌ Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }

  // Test 2: Validate Token (with fake token)
  console.log('\n2. Testing token validation with invalid token...');
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-password/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        token: 'invalid-token-12345'
      })
    });

    const data = await response.json();
    console.log('Response:', response.status, data);
    
    if (!data.valid) {
      console.log('✅ Invalid token rejected correctly');
    } else {
      console.log('❌ Invalid token was accepted!');
    }
  } catch (error) {
    console.error('❌ Validation failed:', error);
  }

  console.log('\n✨ Test complete! Check your email if you used a real address.');
  console.log('📋 Next steps:');
  console.log('1. Check the email for the reset link');
  console.log('2. Click the link and verify the reset page loads');
  console.log('3. Reset your password');
  console.log('4. Check for the password change notification email');
}

testPasswordReset();