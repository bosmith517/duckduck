// Test if database functions exist
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function testDatabaseFunctions() {
  console.log('Testing database functions...\n')

  // Test if system_start_tracking_session exists
  try {
    const { data, error } = await supabase
      .rpc('system_start_tracking_session', {
        p_job_id: '00000000-0000-0000-0000-000000000000',
        p_technician_id: '00000000-0000-0000-0000-000000000000',
        p_initial_latitude: 0,
        p_initial_longitude: 0,
        p_duration_hours: 4
      })
    
    if (error) {
      console.log('❌ system_start_tracking_session:', error.message)
      if (error.message.includes('does not exist')) {
        console.log('   Function not found in database')
      }
    } else {
      console.log('✅ system_start_tracking_session exists')
    }
  } catch (err) {
    console.log('❌ system_start_tracking_session error:', err.message)
  }

  // Test if system_update_technician_location exists
  try {
    const { data, error } = await supabase
      .rpc('system_update_technician_location', {
        p_job_id: '00000000-0000-0000-0000-000000000000',
        p_technician_id: '00000000-0000-0000-0000-000000000000',
        p_tracking_token: 'test',
        p_latitude: 0,
        p_longitude: 0
      })
    
    if (error) {
      console.log('❌ system_update_technician_location:', error.message)
      if (error.message.includes('does not exist')) {
        console.log('   Function not found in database')
      }
    } else {
      console.log('✅ system_update_technician_location exists')
    }
  } catch (err) {
    console.log('❌ system_update_technician_location error:', err.message)
  }

  // Check job_technician_locations table
  try {
    const { data, error } = await supabase
      .from('job_technician_locations')
      .select('*')
      .limit(1)
    
    if (error) {
      console.log('❌ job_technician_locations table:', error.message)
    } else {
      console.log('✅ job_technician_locations table exists')
    }
  } catch (err) {
    console.log('❌ job_technician_locations table error:', err.message)
  }

  console.log('\nRecommendation: Use direct database operations instead of RPC functions')
}

testDatabaseFunctions()