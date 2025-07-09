import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHash } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestPasswordResetRequest {
  email: string
  recaptchaToken?: string
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

    const { email, recaptchaToken } = await req.json() as RequestPasswordResetRequest

    // Get request metadata
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid email address' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(supabaseClient, email, ipAddress)
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          error: `Too many password reset attempts. Please try again after ${rateLimitCheck.retryAfter}.`
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Find user by email
    const { data: userData, error: userError } = await supabaseClient
      .from('user_profiles')
      .select('id, tenant_id, first_name, last_name')
      .eq('email', email.toLowerCase())
      .single()

    if (userError || !userData) {
      // Don't reveal if email exists or not for security
      console.log('User not found for email:', email)
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'If an account exists with this email, you will receive password reset instructions.'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Generate secure reset token
    const resetToken = crypto.randomUUID() + '-' + crypto.randomUUID()
    const encoder = new TextEncoder()
    const data = encoder.encode(resetToken)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Calculate expiration (configurable, default 1 hour)
    const expiryHours = parseInt(Deno.env.get('PASSWORD_RESET_EXPIRY_HOURS') || '1')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiryHours)

    // Create password reset request record
    const { error: insertError } = await supabaseClient
      .from('password_reset_requests')
      .insert({
        user_id: userData.id,
        email: email.toLowerCase(),
        tenant_id: userData.tenant_id,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
        request_source: 'user'
      })

    if (insertError) {
      console.error('Error creating password reset request:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to process password reset request' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get tenant information for branding
    const { data: tenantData } = await supabaseClient
      .from('tenants')
      .select('name, subdomain')
      .eq('id', userData.tenant_id)
      .single()

    // Get tenant branding
    const { data: brandingData } = await supabaseClient
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .single()

    // Build reset link
    const baseUrl = req.headers.get('origin') || 'https://app.tradeworkspro.com'
    const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`

    // Prepare email variables
    const emailVariables = {
      user_name: `${userData.first_name} ${userData.last_name}`.trim() || email,
      tenant_name: tenantData?.name || 'TradeWorks Pro',
      tenant_logo_url: brandingData?.logo_url || null,
      reset_link: resetLink,
      expiry_hours: expiryHours.toString(),
      request_time: new Date().toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
      request_ip: ipAddress,
      request_device: userAgent.split('(')[0].trim(),
      current_year: new Date().getFullYear().toString(),
      primary_color: brandingData?.primary_color || '#007bff',
      support_email: brandingData?.support_email || 'support@tradeworkspro.com'
    }

    // Send password reset email via the email system
    const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: email,
        templateName: 'password_reset',
        variables: emailVariables,
        tenantId: userData.tenant_id
      }
    })

    if (emailError || !emailData?.success) {
      console.error('Error sending password reset email:', emailError)
      // Update the request record
      await supabaseClient
        .from('password_reset_requests')
        .update({ 
          email_sent: false,
          updated_at: new Date().toISOString()
        })
        .eq('token_hash', tokenHash)

      return new Response(
        JSON.stringify({ error: 'Failed to send password reset email' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Update the request record with email sent status
    await supabaseClient
      .from('password_reset_requests')
      .update({ 
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_id: emailData.emailId,
        updated_at: new Date().toISOString()
      })
      .eq('token_hash', tokenHash)

    // Update rate limit counter
    await updateRateLimit(supabaseClient, email, ipAddress)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in request-password-reset function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function checkRateLimit(
  supabaseClient: any,
  email: string,
  ipAddress: string
): Promise<{ allowed: boolean; retryAfter?: string }> {
  const maxAttemptsPerHour = 3
  const maxAttemptsPerDay = 10
  const windowSizeHours = 1

  // Check email-based rate limit
  const hourAgo = new Date()
  hourAgo.setHours(hourAgo.getHours() - windowSizeHours)

  const { data: emailLimit } = await supabaseClient
    .from('password_reset_rate_limits')
    .select('*')
    .eq('identifier', email.toLowerCase())
    .eq('identifier_type', 'email')
    .single()

  if (emailLimit) {
    // Check if blocked
    if (emailLimit.blocked_until && new Date(emailLimit.blocked_until) > new Date()) {
      const blockedUntil = new Date(emailLimit.blocked_until)
      const minutesRemaining = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000)
      return { 
        allowed: false, 
        retryAfter: `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
      }
    }

    // Check hourly limit
    if (new Date(emailLimit.window_start) > hourAgo && emailLimit.request_count >= maxAttemptsPerHour) {
      // Block for 1 hour
      const blockedUntil = new Date()
      blockedUntil.setHours(blockedUntil.getHours() + 1)
      
      await supabaseClient
        .from('password_reset_rate_limits')
        .update({ 
          blocked_until: blockedUntil.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('identifier', email.toLowerCase())
        .eq('identifier_type', 'email')

      return { allowed: false, retryAfter: '60 minutes' }
    }
  }

  // Also check IP-based rate limit to prevent abuse
  const { data: ipLimit } = await supabaseClient
    .from('password_reset_rate_limits')
    .select('*')
    .eq('identifier', ipAddress)
    .eq('identifier_type', 'ip')
    .single()

  if (ipLimit && ipLimit.blocked_until && new Date(ipLimit.blocked_until) > new Date()) {
    const blockedUntil = new Date(ipLimit.blocked_until)
    const minutesRemaining = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000)
    return { 
      allowed: false, 
      retryAfter: `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
    }
  }

  return { allowed: true }
}

async function updateRateLimit(
  supabaseClient: any,
  email: string,
  ipAddress: string
): Promise<void> {
  const hourAgo = new Date()
  hourAgo.setHours(hourAgo.getHours() - 1)

  // Update email rate limit
  const { data: existingEmailLimit } = await supabaseClient
    .from('password_reset_rate_limits')
    .select('*')
    .eq('identifier', email.toLowerCase())
    .eq('identifier_type', 'email')
    .single()

  if (existingEmailLimit) {
    if (new Date(existingEmailLimit.window_start) < hourAgo) {
      // Reset window
      await supabaseClient
        .from('password_reset_rate_limits')
        .update({ 
          request_count: 1,
          window_start: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('identifier', email.toLowerCase())
        .eq('identifier_type', 'email')
    } else {
      // Increment counter
      await supabaseClient
        .from('password_reset_rate_limits')
        .update({ 
          request_count: existingEmailLimit.request_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('identifier', email.toLowerCase())
        .eq('identifier_type', 'email')
    }
  } else {
    // Create new rate limit record
    await supabaseClient
      .from('password_reset_rate_limits')
      .insert({
        identifier: email.toLowerCase(),
        identifier_type: 'email',
        request_count: 1,
        window_start: new Date().toISOString()
      })
  }

  // Also track IP rate limit
  const { data: existingIpLimit } = await supabaseClient
    .from('password_reset_rate_limits')
    .select('*')
    .eq('identifier', ipAddress)
    .eq('identifier_type', 'ip')
    .single()

  if (existingIpLimit) {
    if (new Date(existingIpLimit.window_start) < hourAgo) {
      await supabaseClient
        .from('password_reset_rate_limits')
        .update({ 
          request_count: 1,
          window_start: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('identifier', ipAddress)
        .eq('identifier_type', 'ip')
    } else {
      await supabaseClient
        .from('password_reset_rate_limits')
        .update({ 
          request_count: existingIpLimit.request_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('identifier', ipAddress)
        .eq('identifier_type', 'ip')
    }
  } else {
    await supabaseClient
      .from('password_reset_rate_limits')
      .insert({
        identifier: ipAddress,
        identifier_type: 'ip',
        request_count: 1,
        window_start: new Date().toISOString()
      })
  }
}