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

async function testActivityLogging() {
  try {
    // First, get a sample job to test with
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, tenant_id, title')
      .limit(1)
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      return
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('No jobs found to test with')
      return
    }
    
    const testJob = jobs[0]
    console.log('Testing with job:', testJob.id, testJob.title)
    
    // Try to insert a test activity
    const { data: activity, error: activityError } = await supabase
      .from('job_activity_log')
      .insert({
        job_id: testJob.id,
        tenant_id: testJob.tenant_id,
        activity_type: 'note_added',
        activity_category: 'system',
        title: 'Test Activity',
        description: 'This is a test activity to verify logging works',
        is_visible_to_customer: true,
        is_milestone: false
      })
      .select()
      .single()
    
    if (activityError) {
      console.error('Error inserting test activity:', activityError)
      return
    }
    
    console.log('Test activity created successfully:', activity.id)
    
    // Try to fetch activities for this job
    const { data: activities, error: fetchError } = await supabase
      .from('job_activity_log')
      .select('*')
      .eq('job_id', testJob.id)
      .order('created_at', { ascending: false })
    
    if (fetchError) {
      console.error('Error fetching activities:', fetchError)
      return
    }
    
    console.log(`Found ${activities.length} activities for job ${testJob.id}`)
    activities.forEach(activity => {
      console.log(`- ${activity.title} (${activity.activity_type})`)
    })
    
    // Clean up the test activity
    const { error: deleteError } = await supabase
      .from('job_activity_log')
      .delete()
      .eq('id', activity.id)
    
    if (deleteError) {
      console.error('Error deleting test activity:', deleteError)
    } else {
      console.log('Test activity cleaned up successfully')
    }
    
  } catch (error) {
    console.error('Error in test:', error)
  }
}

testActivityLogging()