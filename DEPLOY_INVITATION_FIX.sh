#!/bin/bash
# Deploy invitation system fixes

echo "Deploying invitation system fixes..."

# 1. Run the SQL migration
echo "1. Running SQL migration..."
supabase db push < FIX_INVITATION_SYSTEM_COMPLETE.sql

# 2. Deploy the Edge Function
echo "2. Deploying send-team-invitation Edge Function..."
supabase functions deploy send-team-invitation

# 3. Set Edge Function secrets if needed
echo "3. Setting Edge Function secrets..."
echo "Make sure to set SITE_URL in your Edge Function secrets:"
echo "supabase secrets set SITE_URL=https://app.tradeworkspro.com"

# 4. Update Supabase email templates
echo ""
echo "4. IMPORTANT: Update email templates in Supabase Dashboard:"
echo "   - Go to Authentication > Email Templates"
echo "   - Update 'Invite User' template to use correct redirect URL"
echo "   - Set redirect to: {{ .SiteURL }}/auth/callback"
echo ""

# 5. Test the invitation flow
echo "5. To test the invitation flow:"
echo "   - Go to your Teams page"
echo "   - Add a new team member"
echo "   - Check if they receive the invitation email"
echo "   - Click the link and complete the setup"

echo ""
echo "Deployment complete!"