// Debug portal tracking detection
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function debugPortalTracking() {
  console.log('🔍 Debugging Portal Tracking Detection\n')

  // 1. Check all active tracking sessions
  const { data: activeSessions, error: sessionError } = await supabase
    .from('job_technician_locations')
    .select('*')
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (sessionError) {
    console.error('❌ Error fetching sessions:', sessionError)
    return
  }

  console.log(`Found ${activeSessions?.length || 0} active tracking sessions:\n`)
  
  if (activeSessions && activeSessions.length > 0) {
    activeSessions.forEach((session, index) => {
      console.log(`Session ${index + 1}:`)
      console.log(`  Job ID: ${session.job_id}`)
      console.log(`  Tracking Token: ${session.tracking_token}`)
      console.log(`  Created: ${session.created_at}`)
      console.log(`  Expires: ${session.expires_at}`)
      console.log(`  Location: ${session.latitude}, ${session.longitude}`)
      console.log('')
    })

    // 2. Test the get-technician-location edge function
    const testToken = activeSessions[0].tracking_token
    console.log(`\n🧪 Testing edge function with token: ${testToken}\n`)

    try {
      const response = await fetch(
        `${process.env.VITE_SUPABASE_URL}/functions/v1/get-technician-location?token=${testToken}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Edge function response:', data)
      } else {
        console.log('❌ Edge function error:', response.status, await response.text())
      }
    } catch (error) {
      console.error('❌ Edge function fetch error:', error)
    }

    // 3. Check portal tokens
    console.log('\n🎫 Checking portal tokens for jobs with tracking:\n')
    
    for (const session of activeSessions) {
      const { data: portalTokens } = await supabase
        .from('client_portal_tokens')
        .select('token, job_id, contact_id, expires_at')
        .eq('job_id', session.job_id)
        .gte('expires_at', new Date().toISOString())

      if (portalTokens && portalTokens.length > 0) {
        console.log(`Portal tokens for job ${session.job_id}:`)
        portalTokens.forEach(token => {
          console.log(`  Token: ${token.token}`)
          console.log(`  Portal URL: http://localhost:5173/portal/${token.token}`)
          console.log(`  Expires: ${token.expires_at}`)
        })
      } else {
        console.log(`No portal tokens found for job ${session.job_id}`)
      }
      console.log('')
    }
  } else {
    console.log('No active tracking sessions found')
  }
}

debugPortalTracking()