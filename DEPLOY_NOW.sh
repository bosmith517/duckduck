#!/bin/bash
# EMERGENCY PRODUCTION DEPLOYMENT SCRIPT

echo "🚀 EMERGENCY DEPLOYMENT TO PRODUCTION"
echo "===================================="

# 1. Run database fixes
echo "1. Applying database fixes..."
supabase db push < FIX_NEW_INQUIRY_DATABASE.sql

# 2. Deploy Edge Functions
echo "2. Deploying Edge Functions..."
supabase functions deploy send-team-invitation

# 3. Build the app
echo "3. Building app..."
npm run build

# 4. Deploy to Vercel
echo "4. Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "POST-DEPLOYMENT CHECKLIST:"
echo "1. Update DNS if needed:"
echo "   - app.tradeworkspro.com → Vercel"
echo "   - api.tradeworkspro.com → Supabase"
echo ""
echo "2. In Supabase Dashboard:"
echo "   - Site URL: https://app.tradeworkspro.com"
echo "   - Add redirect URL: https://app.tradeworkspro.com/*"
echo ""
echo "3. Test critical flows:"
echo "   - Magic link login"
echo "   - New Inquiry → Lead → Contact/Account creation"
echo "   - Team invitations"
echo ""
echo "4. Monitor for errors in:"
echo "   - Vercel logs"
echo "   - Supabase logs"
echo "   - Browser console"