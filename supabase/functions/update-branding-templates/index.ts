import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { tenant_id, branding } = await req.json()

    if (!tenant_id || !branding) {
      throw new Error('Missing tenant_id or branding data')
    }

    // Generate logo HTML if logo exists
    const logoHtml = branding.logo_url 
      ? `<img src="${branding.logo_url}" alt="${branding.company_name}" style="max-height: 60px; margin-bottom: 10px;">`
      : ''

    // Generate email signature with variables replaced
    let emailSignature = branding.email_signature || ''
    emailSignature = emailSignature
      .replace(/{company_name}/g, branding.company_name)
      .replace(/{phone}/g, branding.phone_display_name || '')
      .replace(/{website}/g, branding.website_url || '')
      .replace(/{address}/g, branding.address || '')

    // Template replacements for all email types
    const templateReplacements = {
      '{company_name}': branding.company_name,
      '{primary_color}': branding.primary_color,
      '{secondary_color}': branding.secondary_color,
      '{logo_html}': logoHtml,
      '{email_signature}': emailSignature,
      '{tagline}': branding.tagline || ''
    }

    // Update all email templates for this tenant
    const emailTemplates = [
      {
        template_name: 'Welcome Portal',
        template_type: 'welcome',
        subject_template: `Welcome to Your Service Portal - ${branding.company_name}`,
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${branding.primary_color}; color: white; padding: 20px; text-align: center;">
              ${logoHtml}
              <h1>${branding.company_name}</h1>
              ${branding.tagline ? `<p style="opacity: 0.9;">${branding.tagline}</p>` : ''}
            </div>
            <div style="padding: 30px;">
              <h2>Welcome {customer_name}!</h2>
              <p>We've created a secure portal where you can track your service progress, view estimates, and communicate with our team.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{portal_url}" style="background: ${branding.primary_color}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Access Your Portal</a>
              </div>
              <p style="color: #666; font-size: 14px;">Your portal link: <a href="{portal_url}">{portal_url}</a></p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                ${emailSignature.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        `,
        text_template: `Welcome {customer_name}! Access your service portal: {portal_url}. ${emailSignature}`
      },
      {
        template_name: 'Job Scheduled',
        template_type: 'job_scheduled',
        subject_template: `Service Scheduled - ${branding.company_name}`,
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${branding.primary_color}; color: white; padding: 20px; text-align: center;">
              ${logoHtml}
              <h1>${branding.company_name}</h1>
            </div>
            <div style="padding: 30px;">
              <h2>Service Scheduled</h2>
              <p>Hi {customer_name},</p>
              <p>Your {service_type} service has been scheduled for <strong>{scheduled_date}</strong>.</p>
              <p><strong>Job Details:</strong><br>
              {job_title}<br>
              {job_description}</p>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>📅 Date & Time:</strong> {scheduled_date}<br>
                <strong>⏱️ Estimated Duration:</strong> {estimated_duration}<br>
                <strong>👷 Technician:</strong> {technician_name}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{portal_url}" style="background: ${branding.primary_color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View Job Details</a>
              </div>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                ${emailSignature.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        `,
        text_template: `Hi {customer_name}, your {service_type} service is scheduled for {scheduled_date}. View details: {portal_url}. ${emailSignature}`
      },
      {
        template_name: 'Job Update',
        template_type: 'job_update',
        subject_template: `Service Update - ${branding.company_name}`,
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${branding.primary_color}; color: white; padding: 20px; text-align: center;">
              ${logoHtml}
              <h1>${branding.company_name}</h1>
            </div>
            <div style="padding: 30px;">
              <h2>Service Update</h2>
              <p>Hi {customer_name},</p>
              <p>We have an update on your {service_type} service:</p>
              <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${branding.primary_color};">
                <p><strong>Status:</strong> {job_status}<br>
                <strong>Update:</strong> {update_message}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{portal_url}" style="background: ${branding.primary_color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">View Full Update</a>
              </div>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                ${emailSignature.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        `,
        text_template: `Hi {customer_name}, update on your {service_type}: {update_message}. View details: {portal_url}. ${emailSignature}`
      }
    ]

    // Upsert all email templates
    for (const template of emailTemplates) {
      await supabaseClient
        .from('email_templates')
        .upsert({
          tenant_id,
          ...template,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,template_name' })
    }

    // Update portal subdomain configuration
    if (branding.portal_subdomain) {
      // Here you would typically update DNS records or subdomain routing
      // For now, we'll just log the subdomain configuration
      console.log(`Portal subdomain configured: ${branding.portal_subdomain}.tradeworkspro.com`)
    }

    // Update SignalWire caller ID if phone_display_name is provided
    if (branding.phone_display_name) {
      try {
        // This would integrate with SignalWire to update caller ID
        console.log(`Caller ID updated: ${branding.phone_display_name}`)
      } catch (error) {
        console.error('Error updating caller ID:', error)
        // Don't fail the entire process if caller ID update fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Branding templates updated successfully',
        templates_updated: emailTemplates.length,
        portal_subdomain: branding.portal_subdomain ? `${branding.portal_subdomain}.tradeworkspro.com` : null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error updating branding templates:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})