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

async function checkRealData() {
  try {
    // Check for real jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
    } else {
      console.log(`\n=== JOBS (${jobs.length} found) ===`)
      jobs.forEach(job => {
        console.log(`- ${job.title} (${job.status}) - ${job.id}`)
      })
    }
    
    // Check for real activities
    const { data: activities, error: activitiesError } = await supabase
      .from('job_activity_log')
      .select('id, job_id, title, activity_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
    } else {
      console.log(`\n=== ACTIVITIES (${activities.length} found) ===`)
      activities.forEach(activity => {
        console.log(`- ${activity.title} (${activity.activity_type}) - Job: ${activity.job_id}`)
      })
    }
    
    // If we have jobs but no activities, test inserting an activity
    if (jobs.length > 0 && activities.length === 0) {
      console.log('\n=== TESTING ACTIVITY INSERTION ===')
      const testJob = jobs[0]
      
      const { data: testActivity, error: insertError } = await supabase
        .from('job_activity_log')
        .insert({
          job_id: testJob.id,
          tenant_id: 'test-tenant-id', // We'll need to get the real tenant_id
          activity_type: 'note_added',
          activity_category: 'system',
          title: 'Test Activity',
          description: 'Testing activity insertion',
          is_visible_to_customer: true,
          is_milestone: false
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('Error inserting test activity:', insertError)
      } else {
        console.log('Test activity inserted successfully:', testActivity.id)
      }
    }
    
    // If we have activities for jobs, test fetching them for specific job
    if (jobs.length > 0 && activities.length > 0) {
      const testJob = jobs[0]
      console.log(`\n=== TESTING ACTIVITIES FOR JOB ${testJob.id} ===`)
      
      const { data: jobActivities, error: jobActivitiesError } = await supabase
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
    console.error('Error checking real data:', error)
  }
}

checkRealData()