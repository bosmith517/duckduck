#!/usr/bin/env node

/**
 * Debug script for Attom Data API integration
 * This helps troubleshoot the 500 error you're seeing
 */

console.log('🔍 Attom Integration Debug Script');
console.log('=' .repeat(50));

console.log('\n📋 Checking Integration Status:');

// Check if files exist
const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'supabase/functions/get-attom-property-data/index.ts',
  'supabase/functions/get-attom-property-data/deno.json',
  'src/app/services/attomDataService.ts',
  'src/app/components/shared/PropertyDetails.tsx'
];

console.log('\n✅ Files Check:');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

console.log('\n🔧 Next Steps to Fix the 500 Error:');
console.log('');
console.log('1. 📡 Deploy the Edge Function:');
console.log('   supabase functions deploy get-attom-property-data');
console.log('');
console.log('2. 🔑 Set Environment Variables in Supabase:');
console.log('   Go to Supabase Dashboard > Project Settings > Edge Functions');
console.log('   Add: ATTOM_API_KEY=your_actual_attom_api_key');
console.log('');
console.log('3. 🗄️ Apply Database Migrations:');
console.log('   Make sure the property_data table exists with all Attom fields');
console.log('');
console.log('4. 🧪 Test the Integration:');
console.log('   - Go to any job with an address');
console.log('   - Click the "Property Data" tab');
console.log('   - Check browser console for detailed error messages');

console.log('\n🚨 Common Causes of 500 Error:');
console.log('');
console.log('❌ Edge Function not deployed');
console.log('   Solution: supabase functions deploy get-attom-property-data');
console.log('');
console.log('❌ Missing ATTOM_API_KEY environment variable');
console.log('   Solution: Set in Supabase Dashboard');
console.log('');
console.log('❌ Database table missing or incorrect schema');
console.log('   Solution: Run database migrations');
console.log('');
console.log('❌ Supabase permissions issue');
console.log('   Solution: Check RLS policies and service role permissions');

console.log('\n🔍 Debug Commands:');
console.log('');
console.log('Check Supabase function status:');
console.log('  supabase functions list');
console.log('');
console.log('View function logs:');
console.log('  supabase functions logs get-attom-property-data');
console.log('');
console.log('Test function locally:');
console.log('  supabase functions serve get-attom-property-data');

console.log('\n📞 When You See the Property Data Tab:');
console.log('');
console.log('1. Open browser DevTools (F12)');
console.log('2. Go to Console tab');
console.log('3. Click "Property Data" tab in your job');
console.log('4. Look for these messages:');
console.log('   🌐 Calling Supabase Edge Function for property lookup');
console.log('   🔍 Edge Function Response: {...}');
console.log('   ✅ Successfully got property data (success)');
console.log('   ❌ Error messages (problems)');

console.log('\n🎯 Expected Workflow:');
console.log('');
console.log('1. User creates job with address');
console.log('2. User generates customer portal');
console.log('3. 🏠 Background: Property data auto-fetched');
console.log('4. User views "Property Data" tab');
console.log('5. 📊 Rich property information displayed');

console.log('\n📧 Need Help?');
console.log('If you continue seeing 500 errors after:');
console.log('1. Deploying the function');
console.log('2. Setting the API key');
console.log('3. Checking the logs');
console.log('');
console.log('Share the browser console output and Supabase function logs');

process.exit(0);