import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
  token: string
  newPassword: string
}

interface ValidateTokenRequest {
  token: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // Handle token validation endpoint
    if (path === 'validate') {
      const { token } = await req.json() as ValidateTokenRequest
      
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Token is required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Hash the token to compare with stored hash
      const encoder = new TextEncoder()
      const data = encoder.encode(token)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Find the password reset request
      const { data: resetRequest, error: findError } = await supabaseClient
        .from('password_reset_requests')
        .select('*, user_profiles!inner(email, first_name, last_name)')
        .eq('token_hash', tokenHash)
        .eq('status', 'pending')
        .single()

      if (findError || !resetRequest) {
        return new Response(
          JSON.stringify({ 
            valid: false,
            error: 'Invalid or expired reset token' 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Check if token has expired
      if (new Date(resetRequest.expires_at) < new Date()) {
        // Mark as expired
        await supabaseClient
          .from('password_reset_requests')
          .update({ 
            status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('id', resetRequest.id)

        return new Response(
          JSON.stringify({ 
            valid: false,
            error: 'This password reset link has expired' 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Token is valid
      return new Response(
        JSON.stringify({ 
          valid: true,
          email: resetRequest.user_profiles.email,
          userName: `${resetRequest.user_profiles.first_name} ${resetRequest.user_profiles.last_name}`.trim()
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Handle password reset
    const { token, newPassword } = await req.json() as ResetPasswordRequest

    // Get request metadata
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Validate inputs
    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Token and new password are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Hash the token
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Find the password reset request
    const { data: resetRequest, error: findError } = await supabaseClient
      .from('password_reset_requests')
      .select('*, user_profiles!inner(email, first_name, last_name, tenant_id)')
      .eq('token_hash', tokenHash)
      .eq('status', 'pending')
      .single()

    if (findError || !resetRequest) {
      // Track failed attempt
      await supabaseClient
        .from('password_reset_requests')
        .update({ 
          attempt_count: resetRequest?.attempt_count ? resetRequest.attempt_count + 1 : 1,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('token_hash', tokenHash)

      return new Response(
        JSON.stringify({ error: 'Invalid or expired reset token' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if token has expired
    if (new Date(resetRequest.expires_at) < new Date()) {
      await supabaseClient
        .from('password_reset_requests')
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', resetRequest.id)

      return new Response(
        JSON.stringify({ error: 'This password reset link has expired' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check for too many failed attempts
    if (resetRequest.attempt_count >= 5) {
      await supabaseClient
        .from('password_reset_requests')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', resetRequest.id)

      return new Response(
        JSON.stringify({ error: 'Too many failed attempts. Please request a new password reset.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Update the user's password using admin API
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      resetRequest.user_id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Mark the reset request as used
    await supabaseClient
      .from('password_reset_requests')
      .update({ 
        status: 'used',
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', resetRequest.id)

    // Get tenant information for notification email
    const { data: tenantData } = await supabaseClient
      .from('tenants')
      .select('name')
      .eq('id', resetRequest.user_profiles.tenant_id)
      .single()

    // Get tenant branding
    const { data: brandingData } = await supabaseClient
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', resetRequest.user_profiles.tenant_id)
      .single()

    // Send password change notification email
    const emailVariables = {
      user_name: `${resetRequest.user_profiles.first_name} ${resetRequest.user_profiles.last_name}`.trim(),
      tenant_name: tenantData?.name || 'TradeWorks Pro',
      tenant_logo_url: brandingData?.logo_url || null,
      change_time: new Date().toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
      change_ip: ipAddress,
      change_device: userAgent.split('(')[0].trim(),
      current_year: new Date().getFullYear().toString(),
      primary_color: brandingData?.primary_color || '#007bff',
      support_email: brandingData?.support_email || 'support@tradeworkspro.com'
    }

    // Send notification email
    await supabaseClient.functions.invoke('send-email', {
      body: {
        to: resetRequest.user_profiles.email,
        templateName: 'password_changed',
        variables: emailVariables,
        tenantId: resetRequest.user_profiles.tenant_id
      }
    })

    // Invalidate all other pending reset requests for this user
    await supabaseClient
      .from('password_reset_requests')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', resetRequest.user_id)
      .eq('status', 'pending')
      .neq('id', resetRequest.id)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password has been successfully reset'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in reset-password function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})