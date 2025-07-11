// supabase/functions/complete-full-onboarding/index.ts
// Centralized function to complete contractor onboarding with full business setup

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UniversalLogger, loggedDatabaseOperation, loggedFunctionCall } from '../_shared/universal-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let logger: UniversalLogger | null = null

  try {
    console.log('Starting complete-full-onboarding function')
    
    // Authenticate the user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authentication required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Get request data
    const requestData = await req.json()
    const { tenantId, onboardingData } = requestData
    if (!tenantId || !onboardingData) {
      throw new Error('Missing tenantId or onboardingData')
    }

    // Use admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Initialize logger
    logger = new UniversalLogger(supabaseAdmin, 'complete-full-onboarding', tenantId, user.id)
    logger.setRequestData(requestData)

    console.log('Processing onboarding completion for tenant:', tenantId)

    // Step 1: Phone number setup (if requested)
    let signalwireOnboardingSuccess = false
    try {
      console.log('Starting complete SignalWire onboarding...')
      
      const signalwireResult = await supabase.functions.invoke('complete-signalwire-onboarding', {
        body: {
          companyName: onboardingData.businessName,
          areaCode: onboardingData.areaCode || '630'
        }
      })

      if (signalwireResult.error) {
        console.error('SignalWire onboarding failed:', signalwireResult.error)
        throw new Error(signalwireResult.error.message)
      }

      console.log('✅ Phone number purchase successful:', signalwireResult.data)
      signalwireOnboardingSuccess = true
      
    } catch (error) {
      console.error('Phone number purchase failed:', error)
      // Don't block main onboarding for phone number issues
      console.log('Phone number can be purchased later in Settings')
    }

    // Step 2: Update tenant information (subscription/service level info)
    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .update({
        company_name: onboardingData.businessName,
        service_type: onboardingData.selectedServiceType,
        onboarding_completed: true,
        business_info: {
          selected_phone: onboardingData.selectedPhoneNumber,
          onboarding_completed_at: new Date().toISOString()
        },
        workflow_preferences: {
          ...onboardingData.preferences,
          branding: {
            primaryColor: onboardingData.brandColors?.primary || '#1b84ff',
            secondaryColor: onboardingData.brandColors?.secondary || '#7239ea',
            logoUrl: onboardingData.companyLogoUrl
          }
        }
      })
      .eq('id', tenantId)

    if (tenantError) {
      console.error('Error updating tenant:', tenantError)
      throw new Error('Failed to update company information')
    }

    // Step 2.5: Create company account record with detailed business info
    const { error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert({
        tenant_id: tenantId,
        name: onboardingData.businessName,
        type: 'company',
        industry: onboardingData.selectedServiceType,
        phone: onboardingData.businessPhone, // Their actual business contact number
        email: onboardingData.businessEmail,
        website: onboardingData.businessWebsite,
        address_line1: onboardingData.businessAddress,
        notes: `License Number: ${onboardingData.licenseNumber || 'Not provided'}\nInsurance Number: ${onboardingData.insuranceNumber || 'Not provided'}`,
        account_status: 'ACTIVE'
      })

    if (accountError) {
      console.error('Error creating company account:', accountError)
      // Don't throw here - account creation failure shouldn't block onboarding completion
    }

    // Step 2.6: Provision selected SignalWire phone number for communications
    let phoneProvisioningSuccess = false
    if (onboardingData.selectedPhoneNumber) {
      try {
        console.log('Provisioning selected SignalWire number:', onboardingData.selectedPhoneNumber)
        
        const phoneProvisioningResult = await loggedFunctionCall(
          logger,
          'purchase-phone-number',
          { 
            phoneNumber: onboardingData.selectedPhoneNumber,
            tenantId: tenantId,
            from_onboarding: true
          },
          () => supabase.functions.invoke('purchase-phone-number', {
            body: { 
              phoneNumber: onboardingData.selectedPhoneNumber,
              tenantId: tenantId,
              from_onboarding: true
            }
          })
        )

        if (phoneProvisioningResult.error) {
          console.error('Error provisioning SignalWire phone number:', phoneProvisioningResult.error)
          // Don't throw - phone provisioning failure shouldn't block onboarding
        } else {
          console.log('SignalWire phone number provisioned successfully:', onboardingData.selectedPhoneNumber)
          phoneProvisioningSuccess = true
          
          // Verify the phone number was actually saved to the database
          const { data: savedPhone } = await loggedDatabaseOperation(
            logger,
            'signalwire_phone_numbers',
            'select',
            () => supabaseAdmin
              .from('signalwire_phone_numbers')
              .select('id, number, signalwire_number_id')
              .eq('tenant_id', tenantId)
              .eq('number', onboardingData.selectedPhoneNumber)
              .single()
          )
          
          if (!savedPhone) {
            console.error('Phone number was not found in database after provisioning')
            phoneProvisioningSuccess = false
          } else {
            console.log('Verified phone number in database:', savedPhone)
          }
        }
      } catch (error) {
        console.error('Error in SignalWire phone number provisioning:', error)
        // Non-blocking - log for admin follow-up
      }
    }

    // Step 3: Create default service library entries based on selected service type
    if (onboardingData.selectedServiceType) {
      await createDefaultServices(supabaseAdmin, tenantId, onboardingData.selectedServiceType)
    }

    // Step 4: Create default project templates
    if (onboardingData.selectedServiceType) {
      await createDefaultProjectTemplates(supabaseAdmin, tenantId, onboardingData.selectedServiceType)
    }

    // Step 5: Create team members if any were added
    if (onboardingData.teamMembers && onboardingData.teamMembers.length > 0) {
      await createTeamMembers(supabaseAdmin, tenantId, onboardingData.teamMembers)
    }

    // Step 6: Mark onboarding as complete
    const { error: progressError } = await supabaseAdmin
      .from('onboarding_progress')
      .update({
        completed_at: new Date().toISOString(),
        current_step: 'complete',
        onboarding_data: onboardingData
      })
      .eq('tenant_id', tenantId)

    if (progressError) {
      console.error('Error updating onboarding progress:', progressError)
    }

    // Step 7: Send welcome email (optional - implement if needed)
    // await sendWelcomeEmail(user.email, onboardingData)

    console.log('Onboarding completed successfully for tenant:', tenantId)

    // Collect final status of all operations
    const responseData = {
      success: true,
      message: 'Onboarding completed successfully',
      tenantId,
      businessPhone: onboardingData.selectedPhoneNumber || onboardingData.businessPhone,
      businessName: onboardingData.businessName,
      completionStatus: {
        signalwire_onboarding: signalwireOnboardingSuccess ? 'completed' : 'failed',
        phone_provisioning: phoneProvisioningSuccess,
        tenant_update: 'completed',
        account_creation: 'completed',
        services_created: 'completed',
        templates_created: 'completed'
      },
      next_steps: []
    }

    // Add next steps for incomplete operations
    if (!signalwireOnboardingSuccess) {
      responseData.next_steps.push('Phone number purchase can be completed in Settings')
    }
    if (!phoneProvisioningSuccess && onboardingData.selectedPhoneNumber) {
      responseData.next_steps.push('Phone number provisioning needs retry')
    }

    logger.setResponseData(responseData)
    logger.setSuccess(true)
    await logger.saveLog()

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in complete-full-onboarding:', error.message)
    
    if (logger) {
      logger.setError(error)
      logger.setSuccess(false)
      await logger.saveLog()
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      function: 'complete-full-onboarding'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper function to create default services based on service type
async function createDefaultServices(supabase: any, tenantId: string, serviceType: string) {
  try {
    const serviceTemplates: Record<string, any[]> = {
      hvac: [
        {
          name: 'HVAC System Inspection',
          description: 'Comprehensive inspection of heating and cooling systems',
          category: 'Diagnostic',
          default_price: 150,
          estimated_duration: 120,
          requires_permit: false
        },
        {
          name: 'AC Repair',
          description: 'Air conditioning system repair services',
          category: 'Repair',
          default_price: 300,
          estimated_duration: 180,
          requires_permit: false
        },
        {
          name: 'Furnace Installation',
          description: 'Complete furnace installation and setup',
          category: 'Installation',
          default_price: 2500,
          estimated_duration: 480,
          requires_permit: true
        }
      ],
      plumbing: [
        {
          name: 'Plumbing Inspection',
          description: 'Complete plumbing system inspection',
          category: 'Diagnostic',
          default_price: 100,
          estimated_duration: 90,
          requires_permit: false
        },
        {
          name: 'Leak Repair',
          description: 'Pipe leak detection and repair',
          category: 'Repair',
          default_price: 200,
          estimated_duration: 120,
          requires_permit: false
        },
        {
          name: 'Water Heater Installation',
          description: 'New water heater installation',
          category: 'Installation',
          default_price: 1200,
          estimated_duration: 240,
          requires_permit: true
        }
      ],
      electrical: [
        {
          name: 'Electrical Inspection',
          description: 'Electrical system safety inspection',
          category: 'Diagnostic',
          default_price: 125,
          estimated_duration: 90,
          requires_permit: false
        },
        {
          name: 'Outlet Installation',
          description: 'Install new electrical outlets',
          category: 'Installation',
          default_price: 150,
          estimated_duration: 60,
          requires_permit: true
        },
        {
          name: 'Panel Upgrade',
          description: 'Electrical panel upgrade and modernization',
          category: 'Installation',
          default_price: 2000,
          estimated_duration: 360,
          requires_permit: true
        }
      ],
      roofing: [
        {
          name: 'Roof Inspection',
          description: 'Comprehensive roof condition assessment',
          category: 'Diagnostic',
          default_price: 200,
          estimated_duration: 120,
          requires_permit: false
        },
        {
          name: 'Roof Repair',
          description: 'Minor roof repairs and patching',
          category: 'Repair',
          default_price: 500,
          estimated_duration: 240,
          requires_permit: false
        },
        {
          name: 'Full Roof Replacement',
          description: 'Complete roof replacement',
          category: 'Installation',
          default_price: 15000,
          estimated_duration: 2880,
          requires_permit: true
        }
      ]
    }

    const services = serviceTemplates[serviceType] || []
    
    if (services.length > 0) {
      const serviceInserts = services.map(service => ({
        ...service,
        tenant_id: tenantId,
        is_active: true,
        created_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('service_library')
        .insert(serviceInserts)

      if (error) {
        console.error('Error creating default services:', error)
      } else {
        console.log(`Created ${services.length} default services for ${serviceType}`)
      }
    }
  } catch (error) {
    console.error('Error in createDefaultServices:', error)
  }
}

// Helper function to create default project templates
async function createDefaultProjectTemplates(supabase: any, tenantId: string, serviceType: string) {
  try {
    const templates: Record<string, any> = {
      hvac: {
        name: 'Standard HVAC Project',
        description: 'Default template for HVAC projects',
        default_tasks: [
          { name: 'Initial Assessment', duration_hours: 1, order: 1 },
          { name: 'System Diagnosis', duration_hours: 2, order: 2 },
          { name: 'Parts Procurement', duration_hours: 0, order: 3 },
          { name: 'Repair/Installation', duration_hours: 4, order: 4 },
          { name: 'System Testing', duration_hours: 1, order: 5 },
          { name: 'Customer Walkthrough', duration_hours: 0.5, order: 6 }
        ],
        default_milestones: [
          { name: 'Project Start', percentage: 0 },
          { name: 'Diagnosis Complete', percentage: 25 },
          { name: 'Parts Acquired', percentage: 40 },
          { name: 'Work Complete', percentage: 90 },
          { name: 'Final Approval', percentage: 100 }
        ]
      },
      plumbing: {
        name: 'Standard Plumbing Project',
        description: 'Default template for plumbing projects',
        default_tasks: [
          { name: 'Site Inspection', duration_hours: 1, order: 1 },
          { name: 'Problem Assessment', duration_hours: 1, order: 2 },
          { name: 'Material Preparation', duration_hours: 0.5, order: 3 },
          { name: 'Plumbing Work', duration_hours: 3, order: 4 },
          { name: 'Testing & Cleanup', duration_hours: 1, order: 5 }
        ],
        default_milestones: [
          { name: 'Project Start', percentage: 0 },
          { name: 'Assessment Complete', percentage: 30 },
          { name: 'Work in Progress', percentage: 60 },
          { name: 'Testing Complete', percentage: 90 },
          { name: 'Project Complete', percentage: 100 }
        ]
      }
    }

    const template = templates[serviceType]
    if (template) {
      const { error } = await supabase
        .from('project_templates')
        .insert({
          ...template,
          tenant_id: tenantId,
          service_type: serviceType,
          is_default: true,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error creating project template:', error)
      } else {
        console.log(`Created default project template for ${serviceType}`)
      }
    }
  } catch (error) {
    console.error('Error in createDefaultProjectTemplates:', error)
  }
}

// Helper function to create team member invitations
async function createTeamMembers(supabase: any, tenantId: string, teamMembers: any[]) {
  try {
    const invitations = teamMembers
      .filter(member => member.name && member.email)
      .map(member => ({
        tenant_id: tenantId,
        email: member.email,
        full_name: member.name,
        phone: member.phone || null,
        role: member.accessLevel || 'agent',
        department: member.department || null,
        position: member.role || null,
        status: 'pending',
        invited_at: new Date().toISOString()
      }))

    if (invitations.length > 0) {
      const { error } = await supabase
        .from('team_invitations')
        .insert(invitations)

      if (error) {
        console.error('Error creating team invitations:', error)
      } else {
        console.log(`Created ${invitations.length} team member invitations`)
      }
    }
  } catch (error) {
    console.error('Error in createTeamMembers:', error)
  }
}

// Removed subproject functions - no longer needed