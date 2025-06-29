// supabase/functions/complete-full-onboarding/index.ts
// Centralized function to complete contractor onboarding with full business setup

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
    const { tenantId, onboardingData } = await req.json()
    if (!tenantId || !onboardingData) {
      throw new Error('Missing tenantId or onboardingData')
    }

    // Use admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('Processing onboarding completion for tenant:', tenantId)

    // Step 1: Attempt to create SignalWire subproject (non-blocking)
    // If this fails, onboarding still succeeds and we handle it separately
    createSubprojectAsync(supabase, tenantId, onboardingData.businessName)
      .catch(error => {
        console.error('Background subproject creation failed:', error)
        // Log to admin notification system but don't block onboarding
        logSubprojectFailure(supabaseAdmin, tenantId, onboardingData.businessName, error.message)
      })

    // Step 2: Update company/tenant information
    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .update({
        company_name: onboardingData.businessName,
        phone: onboardingData.selectedPhoneNumber || onboardingData.businessPhone,
        email: onboardingData.businessEmail,
        website: onboardingData.businessWebsite,
        address: onboardingData.businessAddress,
        license_number: onboardingData.licenseNumber,
        insurance_number: onboardingData.insuranceNumber,
        primary_service_type: onboardingData.selectedServiceType,
        onboarding_completed_at: new Date().toISOString(),
        settings: {
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

    // Step 2: Create default service library entries based on selected service type
    if (onboardingData.selectedServiceType) {
      await createDefaultServices(supabaseAdmin, tenantId, onboardingData.selectedServiceType)
    }

    // Step 3: Create default project templates
    if (onboardingData.selectedServiceType) {
      await createDefaultProjectTemplates(supabaseAdmin, tenantId, onboardingData.selectedServiceType)
    }

    // Step 4: Create team members if any were added
    if (onboardingData.teamMembers && onboardingData.teamMembers.length > 0) {
      await createTeamMembers(supabaseAdmin, tenantId, onboardingData.teamMembers)
    }

    // Step 5: Mark onboarding as complete
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

    // Step 6: Send welcome email (optional - implement if needed)
    // await sendWelcomeEmail(user.email, onboardingData)

    console.log('Onboarding completed successfully for tenant:', tenantId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Onboarding completed successfully',
      tenantId,
      businessPhone: onboardingData.selectedPhoneNumber || onboardingData.businessPhone,
      businessName: onboardingData.businessName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in complete-full-onboarding:', error.message)
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
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

// Async function to create subproject without blocking onboarding
async function createSubprojectAsync(supabase: any, tenantId: string, companyName: string) {
  try {
    console.log('Starting background subproject creation for tenant:', tenantId)
    
    const subprojectResponse = await supabase.functions.invoke('create-signalwire-subproject', {
      body: {
        tenantId,
        companyName
      }
    })

    if (subprojectResponse.error) {
      throw new Error(subprojectResponse.error.message)
    }
    
    console.log('Background subproject creation completed successfully:', subprojectResponse.data?.subproject?.id)
    
    // Mark subproject as successfully created
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    await supabaseAdmin
      .from('tenants')
      .update({ 
        subproject_status: 'created',
        subproject_created_at: new Date().toISOString()
      })
      .eq('id', tenantId)
      
  } catch (error) {
    console.error('Error in createSubprojectAsync:', error)
    throw error
  }
}

// Function to log subproject creation failures for admin follow-up
async function logSubprojectFailure(supabase: any, tenantId: string, companyName: string, errorMessage: string) {
  try {
    console.log('Logging subproject failure for admin follow-up')
    
    // Create admin notification record
    await supabase
      .from('admin_notifications')
      .insert({
        type: 'subproject_creation_failed',
        tenant_id: tenantId,
        title: `SignalWire Subproject Creation Failed - ${companyName}`,
        message: `Failed to create subproject for tenant ${tenantId} (${companyName}). Error: ${errorMessage}`,
        priority: 'high',
        status: 'pending',
        metadata: {
          tenant_id: tenantId,
          company_name: companyName,
          error_message: errorMessage,
          created_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      })
    
    // Update tenant status to indicate subproject needs manual creation
    await supabase
      .from('tenants')
      .update({ 
        subproject_status: 'failed',
        subproject_error: errorMessage,
        subproject_retry_needed: true
      })
      .eq('id', tenantId)
      
    console.log('Admin notification created for subproject failure')
  } catch (error) {
    console.error('Error logging subproject failure:', error)
    // Even if notification logging fails, we don't want to break anything
  }
}