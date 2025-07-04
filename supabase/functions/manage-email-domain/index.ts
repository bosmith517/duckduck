import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
}

interface CreateDomainRequest {
  domain_name: string
  default_from_name: string
  default_from_email: string
  reply_to_email?: string
  region?: string
}

interface UpdateDomainRequest {
  domain_id: string
  default_from_name?: string
  default_from_email?: string
  reply_to_email?: string
  is_default?: boolean
}

interface ResendDomainResponse {
  id: string
  name: string
  status: string
  records: Array<{
    record: string
    name: string
    value: string
    type: string
  }>
  region: string
  created_at: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user context and tenant
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's tenant
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'User tenant not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has admin permissions
    if (userProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin permissions required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantId = userProfile.tenant_id
    const url = new URL(req.url)

    // Route the request based on method and path
    if (req.method === 'POST') {
      return await createDomain(req, supabaseClient, tenantId)
    } else if (req.method === 'GET') {
      return await getDomains(supabaseClient, tenantId)
    } else if (req.method === 'PUT') {
      return await updateDomain(req, supabaseClient, tenantId)
    } else if (req.method === 'DELETE') {
      const domainId = url.searchParams.get('domain_id')
      return await deleteDomain(supabaseClient, tenantId, domainId)
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in manage-email-domain function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function createDomain(req: Request, supabaseClient: any, tenantId: string): Promise<Response> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: 'Resend API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const requestData: CreateDomainRequest = await req.json()

  // Validate required fields
  if (!requestData.domain_name || !requestData.default_from_name || !requestData.default_from_email) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: domain_name, default_from_name, default_from_email' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(requestData.default_from_email)) {
    return new Response(
      JSON.stringify({ error: 'Invalid email format for default_from_email' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate that from_email domain matches the domain being added
  const emailDomain = requestData.default_from_email.split('@')[1]
  if (emailDomain !== requestData.domain_name) {
    return new Response(
      JSON.stringify({ error: 'default_from_email must use the domain being added' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Check if domain already exists for this tenant
    const { data: existingDomain } = await supabaseClient
      .from('tenant_email_domains')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('domain_name', requestData.domain_name)
      .single()

    if (existingDomain) {
      return new Response(
        JSON.stringify({ error: 'Domain already exists for this tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create domain in Resend
    const resendPayload = {
      name: requestData.domain_name,
      region: requestData.region || 'us-east-1'
    }

    const resendResponse = await fetch('https://api.resend.com/domains', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text()
      console.error('Resend domain creation error:', errorData)
      return new Response(
        JSON.stringify({ error: `Failed to create domain in Resend: ${errorData}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resendDomain: ResendDomainResponse = await resendResponse.json()

    // Check if this is the tenant's first domain (make it default)
    const { data: domainCount } = await supabaseClient
      .from('tenant_email_domains')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)

    const isFirstDomain = !domainCount || domainCount.length === 0

    // Generate webhook secret for this domain
    const { data: webhookSecret } = await supabaseClient
      .rpc('generate_webhook_secret')

    // Insert domain into database
    const { data: domainRecord, error: insertError } = await supabaseClient
      .from('tenant_email_domains')
      .insert({
        tenant_id: tenantId,
        domain_name: requestData.domain_name,
        resend_domain_id: resendDomain.id,
        status: 'pending',
        dns_records: resendDomain.records,
        default_from_name: requestData.default_from_name,
        default_from_email: requestData.default_from_email,
        reply_to_email: requestData.reply_to_email,
        is_default: isFirstDomain,
        webhook_secret: webhookSecret,
        verification_started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      
      // Clean up Resend domain if database insert failed
      try {
        await fetch(`https://api.resend.com/domains/${resendDomain.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${resendApiKey}` }
        })
      } catch (cleanupError) {
        console.error('Failed to cleanup Resend domain:', cleanupError)
      }

      return new Response(
        JSON.stringify({ error: 'Failed to save domain to database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain: {
          id: domainRecord.id,
          domain_name: domainRecord.domain_name,
          status: domainRecord.status,
          dns_records: domainRecord.dns_records,
          default_from_name: domainRecord.default_from_name,
          default_from_email: domainRecord.default_from_email,
          reply_to_email: domainRecord.reply_to_email,
          is_default: domainRecord.is_default,
          created_at: domainRecord.created_at
        },
        resend_domain_id: resendDomain.id
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating domain:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create domain' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getDomains(supabaseClient: any, tenantId: string): Promise<Response> {
  try {
    const { data: domains, error: fetchError } = await supabaseClient
      .from('tenant_email_domains')
      .select(`
        id,
        domain_name,
        status,
        dns_records,
        default_from_name,
        default_from_email,
        reply_to_email,
        is_default,
        is_active,
        created_at,
        verified_at,
        last_checked_at
      `)
      .eq('tenant_id', tenantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching domains:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch domains' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        domains: domains || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in getDomains:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get domains' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function updateDomain(req: Request, supabaseClient: any, tenantId: string): Promise<Response> {
  const requestData: UpdateDomainRequest = await req.json()

  if (!requestData.domain_id) {
    return new Response(
      JSON.stringify({ error: 'domain_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Verify domain belongs to tenant
    const { data: domain, error: fetchError } = await supabaseClient
      .from('tenant_email_domains')
      .select('*')
      .eq('id', requestData.domain_id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !domain) {
      return new Response(
        JSON.stringify({ error: 'Domain not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (requestData.default_from_name !== undefined) {
      updateData.default_from_name = requestData.default_from_name
    }

    if (requestData.default_from_email !== undefined) {
      // Validate email format and domain
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(requestData.default_from_email)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const emailDomain = requestData.default_from_email.split('@')[1]
      if (emailDomain !== domain.domain_name) {
        return new Response(
          JSON.stringify({ error: 'Email must use the registered domain' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      updateData.default_from_email = requestData.default_from_email
    }

    if (requestData.reply_to_email !== undefined) {
      updateData.reply_to_email = requestData.reply_to_email
    }

    if (requestData.is_default !== undefined) {
      // If setting as default, unset other defaults first
      if (requestData.is_default) {
        await supabaseClient
          .from('tenant_email_domains')
          .update({ is_default: false })
          .eq('tenant_id', tenantId)
          .neq('id', requestData.domain_id)
      }
      updateData.is_default = requestData.is_default
    }

    // Update domain
    const { data: updatedDomain, error: updateError } = await supabaseClient
      .from('tenant_email_domains')
      .update(updateData)
      .eq('id', requestData.domain_id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating domain:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update domain' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain: updatedDomain
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error updating domain:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to update domain' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function deleteDomain(supabaseClient: any, tenantId: string, domainId: string | null): Promise<Response> {
  if (!domainId) {
    return new Response(
      JSON.stringify({ error: 'domain_id parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: 'Resend API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get domain details
    const { data: domain, error: fetchError } = await supabaseClient
      .from('tenant_email_domains')
      .select('*')
      .eq('id', domainId)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !domain) {
      return new Response(
        JSON.stringify({ error: 'Domain not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if this is the last domain for the tenant
    const { data: domainCount } = await supabaseClient
      .from('tenant_email_domains')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)

    if (domainCount && domainCount.length === 1) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete the last domain. Tenant must have at least one domain.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete from Resend first
    if (domain.resend_domain_id) {
      const resendResponse = await fetch(`https://api.resend.com/domains/${domain.resend_domain_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`
        }
      })

      if (!resendResponse.ok && resendResponse.status !== 404) {
        const errorData = await resendResponse.text()
        console.error('Error deleting domain from Resend:', errorData)
        return new Response(
          JSON.stringify({ error: 'Failed to delete domain from Resend' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseClient
      .from('tenant_email_domains')
      .delete()
      .eq('id', domainId)
      .eq('tenant_id', tenantId)

    if (deleteError) {
      console.error('Error deleting domain from database:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete domain from database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If we deleted the default domain, set another domain as default
    if (domain.is_default) {
      const { data: remainingDomains } = await supabaseClient
        .from('tenant_email_domains')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)

      if (remainingDomains && remainingDomains.length > 0) {
        await supabaseClient
          .from('tenant_email_domains')
          .update({ is_default: true })
          .eq('id', remainingDomains[0].id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Domain deleted successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error deleting domain:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to delete domain' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

/* 
Email Domain Management Edge Function

This function manages email domains for tenants through the Resend API.
It handles domain creation, verification, updates, and deletion.

Features:
- Create domains in Resend and sync to database
- Get all domains for a tenant
- Update domain configuration
- Delete domains (with safety checks)
- Automatic default domain management
- DNS record management
- Webhook secret generation

API Endpoints:

POST /functions/v1/manage-email-domain
Create a new domain:
{
  "domain_name": "mail.company.com",
  "default_from_name": "Company Support",
  "default_from_email": "support@mail.company.com",
  "reply_to_email": "noreply@mail.company.com",
  "region": "us-east-1"
}

GET /functions/v1/manage-email-domain
Get all domains for the tenant

PUT /functions/v1/manage-email-domain
Update domain settings:
{
  "domain_id": "uuid",
  "default_from_name": "New Name",
  "is_default": true
}

DELETE /functions/v1/manage-email-domain?domain_id=uuid
Delete a domain

Security:
- Requires admin role
- Tenant isolation enforced
- Input validation and sanitization

Environment Variables Required:
- RESEND_API_KEY: Your Resend API key
- SUPABASE_URL: Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Service role key
*/