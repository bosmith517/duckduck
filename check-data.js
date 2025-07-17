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

async function checkData() {
  try {
    // Check leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, title, status')
      .limit(5)
    
    if (leadsError) {
      console.error('Error fetching leads:', leadsError)
    } else {
      console.log(`Found ${leads.length} leads`)
      leads.forEach(lead => console.log(`- ${lead.title} (${lead.status})`))
    }
    
    // Check jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, status')
      .limit(5)
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
    } else {
      console.log(`Found ${jobs.length} jobs`)
      jobs.forEach(job => console.log(`- ${job.title} (${job.status})`))
    }
    
    // Check estimates
    const { data: estimates, error: estimatesError } = await supabase
      .from('estimates')
      .select('id, project_title, status')
      .limit(5)
    
    if (estimatesError) {
      console.error('Error fetching estimates:', estimatesError)
    } else {
      console.log(`Found ${estimates.length} estimates`)
      estimates.forEach(estimate => console.log(`- ${estimate.project_title} (${estimate.status})`))
    }
    
    // Check existing activities
    const { data: activities, error: activitiesError } = await supabase
      .from('job_activity_log')
      .select('id, title, activity_type, created_at')
      .limit(10)
    
    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
    } else {
      console.log(`Found ${activities.length} existing activities`)
      activities.forEach(activity => console.log(`- ${activity.title} (${activity.activity_type})`))
    }
    
  } catch (error) {
    console.error('Error in check:', error)
  }
}

checkData()