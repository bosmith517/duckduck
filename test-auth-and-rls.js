import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read environment variables
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key] = value
    }
  })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAuthAndRLS() {
  try {
    console.log('Testing database connection...')
    console.log('Supabase URL:', supabaseUrl)
    console.log('Using key type:', supabaseKey.includes('service_role') ? 'service_role' : 'anon')
    
    // Test with service role bypassing RLS
    const supabaseService = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    console.log('\n=== Testing with service role access ===')
    
    // Check tenants
    const { data: tenants, error: tenantError } = await supabaseService
      .from('tenants')
      .select('id, company_name')
      .limit(5)
    
    if (tenantError) {
      console.error('Error accessing tenants:', tenantError)
    } else {
      console.log(`Found ${tenants.length} tenants:`)
      tenants.forEach(tenant => {
        console.log(`- ${tenant.company_name} (${tenant.id})`)
      })
    }
    
    // Check jobs
    const { data: jobs, error: jobsError } = await supabaseService
      .from('jobs')
      .select('id, title, status, tenant_id')
      .limit(5)
    
    if (jobsError) {
      console.error('Error accessing jobs:', jobsError)
    } else {
      console.log(`Found ${jobs.length} jobs:`)
      jobs.forEach(job => {
        console.log(`- ${job.title} (${job.status}) - Tenant: ${job.tenant_id}`)
      })
    }
    
    // Check activities
    const { data: activities, error: activitiesError } = await supabaseService
      .from('job_activity_log')
      .select('id, title, activity_type, tenant_id, job_id')
      .limit(5)
    
    if (activitiesError) {
      console.error('Error accessing activities:', activitiesError)
    } else {
      console.log(`Found ${activities.length} activities:`)
      activities.forEach(activity => {
        console.log(`- ${activity.title} (${activity.activity_type}) - Job: ${activity.job_id}`)
      })
    }
    
    // If we have a tenant and jobs, test the activity logging flow
    if (tenants.length > 0 && jobs.length > 0) {
      const testTenant = tenants[0]
      const testJob = jobs[0]
      
      console.log(`\n=== Testing activity logging for Job ${testJob.id} ===`)
      
      // Test RLS policies by trying to access as if we're a user
      const { data: jobActivities, error: jobActivitiesError } = await supabaseService
        .from('job_activity_log')
        .select(`
          *,
          user_profiles (
            first_name,
            last_name,
            role
          )
        `)
        .eq('job_id', testJob.id)
        .order('created_at', { ascending: false })
      
      if (jobActivitiesError) {
        console.error('Error fetching job activities:', jobActivitiesError)
      } else {
        console.log(`Found ${jobActivities.length} activities for job ${testJob.id}:`)
        jobActivities.forEach(activity => {
          console.log(`- ${activity.title} (${activity.activity_type}) - ${activity.is_visible_to_customer ? 'Customer Visible' : 'Internal'}`)
        })
      }
    }
    
  } catch (error) {
    console.error('Error testing auth and RLS:', error)
  }
}

testAuthAndRLS()