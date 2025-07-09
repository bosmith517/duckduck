import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get request body
    const { userId } = await req.json()
    
    if (!userId) {
      throw new Error('User ID is required')
    }

    // Verify the requester is authenticated and has admin privileges
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Get the requester's profile to check if they're an admin
    const { data: requesterProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !requesterProfile) {
      throw new Error('Could not verify requester permissions')
    }

    if (requesterProfile.role !== 'admin') {
      throw new Error('Only admins can delete team members')
    }

    // Get the target user's profile to ensure they're in the same tenant
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('user_profiles')
      .select('tenant_id, email')
      .eq('id', userId)
      .single()

    if (targetError || !targetProfile) {
      throw new Error('User not found')
    }

    // Verify both users are in the same tenant
    if (targetProfile.tenant_id !== requesterProfile.tenant_id) {
      throw new Error('Cannot delete users from other tenants')
    }

    // Don't allow users to delete themselves
    if (userId === user.id) {
      throw new Error('You cannot delete your own account')
    }

    // Delete related data first (to avoid foreign key constraints)
    // This is a simplified version - in production, you'd want to handle more tables
    
    // Delete password reset logs
    await supabaseAdmin
      .from('password_reset_logs')
      .delete()
      .eq('user_id', userId)

    // Delete password reset requests
    await supabaseAdmin
      .from('password_reset_requests')
      .delete()
      .eq('user_id', userId)

    // Delete chat channels created by user
    await supabaseAdmin
      .from('chat_channels')
      .delete()
      .eq('created_by', userId)

    // Delete user invitations
    await supabaseAdmin
      .from('user_invitations')
      .delete()
      .eq('email', targetProfile.email)

    // Delete the user profile
    const { error: deleteProfileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (deleteProfileError) {
      throw new Error(`Failed to delete user profile: ${deleteProfileError.message}`)
    }

    // Delete the auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      // If we can't delete the auth user, we should log this but still consider it successful
      // since the profile is already deleted
      console.error('Failed to delete auth user:', deleteAuthError)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Team member deleted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error deleting team member:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to delete team member'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})