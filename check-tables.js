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

async function checkTables() {
  try {
    // Check if we can access the database by listing tables
    const { data, error } = await supabase
      .rpc('get_table_names', {})
      .select()
    
    if (error) {
      console.log('RPC not available, trying direct table access...')
      
      // Try to access a simple table to test connection
      const { data: tenants, error: tenantError } = await supabase
        .from('tenants')
        .select('id, company_name')
        .limit(5)
      
      if (tenantError) {
        console.error('Error accessing tenants table:', tenantError)
      } else {
        console.log(`Found ${tenants.length} tenants:`)
        tenants.forEach(tenant => {
          console.log(`- ${tenant.company_name} (${tenant.id})`)
        })
      }
      
      // Try to access user_profiles
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, tenant_id')
        .limit(5)
      
      if (profileError) {
        console.error('Error accessing user_profiles:', profileError)
      } else {
        console.log(`Found ${profiles.length} user profiles:`)
        profiles.forEach(profile => {
          console.log(`- ${profile.first_name} ${profile.last_name} (${profile.tenant_id})`)
        })
      }
      
      // Try to access jobs table
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, status, tenant_id')
        .limit(5)
      
      if (jobsError) {
        console.error('Error accessing jobs table:', jobsError)
      } else {
        console.log(`Found ${jobs.length} jobs:`)
        jobs.forEach(job => {
          console.log(`- ${job.title} (${job.status}) - Tenant: ${job.tenant_id}`)
        })
      }
      
      // Try to access job_activity_log
      const { data: activities, error: activitiesError } = await supabase
        .from('job_activity_log')
        .select('id, title, activity_type, tenant_id')
        .limit(5)
      
      if (activitiesError) {
        console.error('Error accessing job_activity_log:', activitiesError)
      } else {
        console.log(`Found ${activities.length} activities:`)
        activities.forEach(activity => {
          console.log(`- ${activity.title} (${activity.activity_type}) - Tenant: ${activity.tenant_id}`)
        })
      }
      
    } else {
      console.log('Available tables:', data)
    }
    
  } catch (error) {
    console.error('Error checking tables:', error)
  }
}

checkTables()