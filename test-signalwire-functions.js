// Test script for SignalWire Edge Functions
// Run with: node test-signalwire-functions.js

const SUPABASE_URL = 'https://eskpnhbemnxkxafjbbdx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVza3BuaGJlbW54a3hhZmpiYmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMjg4MDEsImV4cCI6MjA2NTcwNDgwMX0.FCGjVeYMGsQX1Lcyh2v6kgk78gsQRL962tmlByDch3s';

// You'll need to get a valid auth token from your browser session
// Open DevTools, go to Application > Local Storage > find the supabase auth token
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace this

async function testCreateRoom() {
  console.log('Testing create-signalwire-video-room...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-signalwire-video-room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ jobId: null })
    });

    const data = await response.json();
    console.log('Create Room Response:', data);
    
    if (response.ok && data.roomName) {
      return data.roomName;
    } else {
      console.error('Failed to create room:', data);
      return null;
    }
  } catch (error) {
    console.error('Error creating room:', error);
    return null;
  }
}

async function testGenerateToken(roomName) {
  console.log('\nTesting generate-signalwire-token...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-signalwire-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        clientIdentity: 'test-user-123',
        room_name: roomName
      })
    });

    const data = await response.json();
    console.log('Generate Token Response:', data);
    
    if (response.ok && data.token) {
      // Decode the JWT to inspect it
      const parts = data.token.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      console.log('\nDecoded JWT Header:', header);
      console.log('Decoded JWT Payload:', payload);
    }
  } catch (error) {
    console.error('Error generating token:', error);
  }
}

async function runTests() {
  console.log('Starting SignalWire Edge Function tests...\n');
  
  if (AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
    console.error('Please update AUTH_TOKEN with a valid token from your browser session');
    console.log('\nTo get the token:');
    console.log('1. Open your app in the browser and log in');
    console.log('2. Open DevTools (F12)');
    console.log('3. Go to Application tab > Local Storage');
    console.log('4. Find the key that contains "auth-token" and copy its value');
    return;
  }
  
  // Test 1: Create a room
  const roomName = await testCreateRoom();
  
  if (roomName) {
    // Test 2: Generate a token for the room
    await testGenerateToken(roomName);
  }
}

runTests();
