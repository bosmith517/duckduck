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

async function createTestData() {
  try {
    // First, get or create a tenant
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
    
    if (tenantError) {
      console.error('Error fetching tenants:', tenantError)
      return
    }
    
    let tenantId
    if (tenants && tenants.length > 0) {
      tenantId = tenants[0].id
      console.log('Using existing tenant:', tenantId)
    } else {
      console.log('No tenants found. Need to create tenant first.')
      return
    }
    
    // Create a test contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0123'
      })
      .select()
      .single()
    
    if (contactError) {
      console.error('Error creating contact:', contactError)
      return
    }
    
    console.log('Created test contact:', contact.id)
    
    // Create a test job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        contact_id: contact.id,
        title: 'Test Electrical Service',
        description: 'Test job for activity logging',
        status: 'scheduled',
        priority: 'medium',
        start_date: new Date().toISOString(),
        estimated_cost: 500.00
      })
      .select()
      .single()
    
    if (jobError) {
      console.error('Error creating job:', jobError)
      return
    }
    
    console.log('Created test job:', job.id)
    
    // Create test activities
    const activities = [
      {
        job_id: job.id,
        tenant_id: tenantId,
        activity_type: 'job_created',
        activity_category: 'system',
        title: 'Job Created',
        description: 'New job created for electrical service',
        is_visible_to_customer: true,
        is_milestone: true
      },
      {
        job_id: job.id,
        tenant_id: tenantId,
        activity_type: 'note_added',
        activity_category: 'user',
        title: 'Initial Assessment',
        description: 'Customer reports flickering lights in kitchen',
        is_visible_to_customer: true,
        is_milestone: false
      },
      {
        job_id: job.id,
        tenant_id: tenantId,
        activity_type: 'technician_assigned',
        activity_category: 'admin',
        title: 'Technician Assigned',
        description: 'Mike Johnson assigned to this job',
        is_visible_to_customer: true,
        is_milestone: true
      }
    ]
    
    const { data: insertedActivities, error: activitiesError } = await supabase
      .from('job_activity_log')
      .insert(activities)
      .select()
    
    if (activitiesError) {
      console.error('Error creating activities:', activitiesError)
      return
    }
    
    console.log(`Created ${insertedActivities.length} test activities`)
    
    // Test fetching activities
    const { data: fetchedActivities, error: fetchError } = await supabase
      .from('job_activity_log')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
    
    if (fetchError) {
      console.error('Error fetching activities:', fetchError)
      return
    }
    
    console.log(`\nFetched ${fetchedActivities.length} activities for job ${job.id}:`)
    fetchedActivities.forEach(activity => {
      console.log(`- ${activity.title} (${activity.activity_type}) - ${activity.is_visible_to_customer ? 'Customer Visible' : 'Internal'}`)
    })
    
    console.log('\nTest data created successfully!')
    console.log('Job ID:', job.id)
    console.log('You can now test the Activity tab in the UI with this job.')
    
  } catch (error) {
    console.error('Error creating test data:', error)
  }
}

createTestData()