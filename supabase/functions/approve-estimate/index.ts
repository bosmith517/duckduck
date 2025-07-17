import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApproveEstimateRequest {
  estimateId: string
  signatureData?: string
  approvedBy: string
  approvalNotes?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    // Get the JWT token to identify the user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Parse request body
    const { estimateId, signatureData, approvedBy, approvalNotes }: ApproveEstimateRequest = await req.json()

    if (!estimateId) {
      throw new Error('Estimate ID is required')
    }

    // Get the estimate with its relationships
    const { data: estimate, error: estimateError } = await supabaseClient
      .from('estimates')
      .select(`
        *,
        jobs:job_id(*),
        leads:lead_id(
          *,
          contacts:contact_id(*),
          accounts:account_id(*)
        )
      `)
      .eq('id', estimateId)
      .single()

    if (estimateError || !estimate) {
      throw new Error('Estimate not found')
    }

    // Verify the user has access to this estimate (via tenant_id)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.tenant_id !== estimate.tenant_id) {
      throw new Error('Unauthorized access to this estimate')
    }

    // Check if estimate is already approved
    if (estimate.status === 'approved' || estimate.is_approved) {
      throw new Error('Estimate is already approved')
    }

    // Start a transaction to update estimate and create job if needed
    const updates: any = {
      status: 'approved',
      is_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: approvedBy || user.email,
      approval_notes: approvalNotes
    }

    // If signature provided, store it
    if (signatureData) {
      updates.signature_data = signatureData
    }

    // Update the estimate
    const { error: updateError } = await supabaseClient
      .from('estimates')
      .update(updates)
      .eq('id', estimateId)

    if (updateError) {
      throw updateError
    }

    // If this estimate is tied to a lead (customer journey flow), create the job
    let newJob = null
    if (estimate.lead_id && !estimate.job_id) {
      const lead = estimate.leads
      
      // Generate job number
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      
      // Get count of jobs created today for job number
      const { count } = await supabaseClient
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${year}-${month}-${day}T00:00:00.000Z`)
        .lt('created_at', `${year}-${month}-${day}T23:59:59.999Z`)

      const sequence = String((count || 0) + 1).padStart(4, '0')
      const jobNumber = `JOB-${year}${month}${day}-${sequence}`

      // Prepare job data based on estimate and lead
      const jobData = {
        tenant_id: estimate.tenant_id,
        account_id: lead?.account_id || null,
        contact_id: lead?.contact_id || null,
        job_number: jobNumber, // Add job number
        title: estimate.project_title || `Job from Estimate #${estimate.estimate_number}`,
        description: estimate.description,
        status: 'pending',
        priority: 'medium',
        scheduled_start: null, // Will be set when scheduled
        scheduled_end: null,
        estimated_hours: estimate.estimated_hours || 0,
        total_amount: estimate.total_amount || 0,
        estimated_cost: estimate.total_amount || 0, // Add estimated cost
        contract_price: estimate.total_amount || 0, // Add contract price
        // Cost breakdowns
        estimated_material_cost: estimate.material_cost || 0,
        estimated_labor_cost: estimate.labor_cost || 0,
        estimated_equipment_cost: estimate.equipment_cost || 0,
        estimated_overhead_cost: estimate.overhead_cost || 0
        // Location from lead
        service_location: lead?.full_address || lead?.street_address || null,
        service_city: lead?.city || null,
        service_state: lead?.state || null,
        service_zip: lead?.zip_code || null,
        // Link back to estimate and lead
        estimate_id: estimateId,
        lead_id: estimate.lead_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Create the job
      const { data: createdJob, error: jobError } = await supabaseClient
        .from('jobs')
        .insert(jobData)
        .select()
        .single()

      if (jobError) {
        console.error('Error creating job:', jobError)
        // Don't throw - estimate is already approved
      } else {
        newJob = createdJob

        // Update estimate with job reference
        await supabaseClient
          .from('estimates')
          .update({ job_id: createdJob.id })
          .eq('id', estimateId)

        // Update lead status to converted
        if (lead) {
          await supabaseClient
            .from('leads')
            .update({ 
              status: 'converted',
              converted_at: new Date().toISOString(),
              converted_to_job_id: createdJob.id
            })
            .eq('id', estimate.lead_id)
        }

        // Create activity log entries
        const activities = [
          {
            tenant_id: estimate.tenant_id,
            entity_type: 'estimate',
            entity_id: estimateId,
            activity_type: 'estimate_approved',
            description: `Estimate #${estimate.estimate_number} approved by ${approvedBy || user.email}`,
            user_id: user.id,
            metadata: { approval_notes: approvalNotes, signature: !!signatureData }
          }
        ]

        if (newJob) {
          activities.push({
            tenant_id: estimate.tenant_id,
            entity_type: 'job',
            entity_id: newJob.id,
            activity_type: 'job_created',
            description: `Job created from approved estimate #${estimate.estimate_number}`,
            user_id: user.id,
            metadata: { estimate_id: estimateId, lead_id: estimate.lead_id }
          })
        }

        await supabaseClient
          .from('activity_logs')
          .insert(activities)
      }
    }

    // Send notification email
    try {
      const emailData = {
        to: estimate.client_email || lead?.email,
        subject: `Estimate #${estimate.estimate_number} Approved`,
        template: 'estimate-approved',
        data: {
          estimate_number: estimate.estimate_number,
          project_title: estimate.project_title,
          total_amount: estimate.total_amount,
          approved_by: approvedBy || user.email,
          job_id: newJob?.id
        }
      }

      // Call send-email function
      await supabaseClient.functions.invoke('send-email', {
        body: emailData
      })
    } catch (emailError) {
      console.error('Error sending approval email:', emailError)
      // Don't throw - email is not critical
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        estimate: { ...estimate, ...updates },
        job: newJob,
        message: newJob 
          ? 'Estimate approved and job created successfully' 
          : 'Estimate approved successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in approve-estimate function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to approve estimate',
        details: error
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})