// Test tracking session data
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function checkTrackingSessions() {
  console.log('Checking tracking sessions...\n')

  // Get all active tracking sessions
  const { data, error } = await supabase
    .from('job_technician_locations')
    .select('*')
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('No active tracking sessions found')
    return
  }

  console.log(`Found ${data.length} active tracking sessions:\n`)
  
  data.forEach((session, index) => {
    console.log(`Session ${index + 1}:`)
    console.log(`  Tracking Token: ${session.tracking_token}`)
    console.log(`  Job ID: ${session.job_id}`)
    console.log(`  User ID: ${session.user_id}`)
    console.log(`  Technician ID: ${session.technician_id}`)
    console.log(`  Tenant ID: ${session.tenant_id}`)
    console.log(`  Location: ${session.latitude}, ${session.longitude}`)
    console.log(`  Created: ${session.created_at}`)
    console.log(`  Expires: ${session.expires_at}`)
    console.log(`  Is Active: ${session.is_active}`)
    console.log('')
  })

  // Check if user_id and technician_id are the same
  const mismatchedSessions = data.filter(s => s.user_id !== s.technician_id)
  if (mismatchedSessions.length > 0) {
    console.log('⚠️  Found sessions where user_id !== technician_id')
    console.log('This might cause issues with location updates\n')
  }
}

checkTrackingSessions()