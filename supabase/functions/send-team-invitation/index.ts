import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Parse request body
    const { email, role, firstName, lastName } = await req.json()

    if (!email || !role) {
      throw new Error('Email and role are required')
    }

    // Get user's tenant
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Check permissions
    if (!['admin', 'manager', 'supervisor'].includes(userProfile.role)) {
      throw new Error('Unauthorized: You do not have permission to send invitations')
    }

    // Call the database function to create invitation
    const { data: inviteResult, error: inviteError } = await supabaseClient
      .rpc('send_team_invitation_email', {
        p_email: email,
        p_tenant_id: userProfile.tenant_id,
        p_invited_by: user.id,
        p_role: role,
        p_first_name: firstName || null,
        p_last_name: lastName || null
      })

    if (inviteError) {
      throw inviteError
    }

    if (!inviteResult.success) {
      throw new Error(inviteResult.error)
    }

    // Generate the invitation URL
    // SITE_URL should be your frontend app URL (where users access your app)
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.tradeworkspro.com'
    const invitationUrl = `${siteUrl}/auth/accept-invitation?token=${inviteResult.invitation_id}`

    // Create Supabase auth user with magic link
    const { data: authData, error: authError } = await supabaseClient.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: invitationUrl,
        data: {
          tenant_id: userProfile.tenant_id,
          role: role,
          invitation_id: inviteResult.invitation_id
        }
      }
    })

    if (authError) {
      console.error('Error generating auth link:', authError)
      // Don't fail the whole operation if auth link fails
      // We can still send a regular invitation email
    }

    // Send email using the existing send-email function
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to TradeWorks Pro</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td align="center" style="padding: 40px 20px; border-bottom: 1px solid #e0e0e0;">
                    <img src="${siteUrl}/media/logos/tradeworks-logo.png" alt="TradeWorks Pro" style="height: 50px;">
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                      You've been invited to join ${inviteResult.tenant_name}
                    </h2>
                    
                    <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                      Hi${firstName ? ' ' + firstName : ''},
                    </p>
                    
                    <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                      ${inviteResult.inviter_name} has invited you to join their team on TradeWorks Pro as a <strong>${role}</strong>.
                    </p>
                    
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${authData?.properties?.action_link || invitationUrl}" 
                             style="display: inline-block; padding: 14px 30px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #999999; font-size: 14px; line-height: 20px; margin: 20px 0 0 0; text-align: center;">
                      This invitation will expire in 7 days.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    
                    <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0;">
                      If the button doesn't work, copy and paste this link into your browser:<br>
                      <a href="${authData?.properties?.action_link || invitationUrl}" style="color: #007bff; word-break: break-all;">
                        ${authData?.properties?.action_link || invitationUrl}
                      </a>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0; text-align: center; border-radius: 0 0 8px 8px;">
                    <p style="color: #999999; font-size: 12px; margin: 0 0 10px 0;">
                      TradeWorks Pro - Business Management for Service Contractors
                    </p>
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      © 2024 TradeWorks Pro. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    // Call the send-email function
    const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: `Invitation to join ${inviteResult.tenant_name} on TradeWorks Pro`,
        html: emailHtml,
        replyTo: user.email
      })
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      console.error('Error sending email:', errorText)
      throw new Error('Failed to send invitation email')
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation sent successfully',
        invitation_id: inviteResult.invitation_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in send-team-invitation:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})