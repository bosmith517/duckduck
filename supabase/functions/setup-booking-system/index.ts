import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    )

    // Check if tables already exist
    const { data: existingTables } = await supabaseAdmin
      .from('booking_links')
      .select('id')
      .limit(1)

    if (existingTables) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Booking system tables already exist' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If we get here, tables don't exist, so we should use the SQL editor
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Please run the booking system migration using the Supabase SQL editor',
        instructions: [
          '1. Go to your Supabase dashboard',
          '2. Navigate to the SQL Editor',
          '3. Copy the contents of supabase/migrations/20250710000001_booking_system.sql',
          '4. Paste and run it in the SQL editor'
        ]
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )

  } catch (error) {
    console.error('Error in setup-booking-system:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        instructions: [
          '1. Go to your Supabase dashboard',
          '2. Navigate to the SQL Editor',
          '3. Copy the contents of supabase/migrations/20250710000001_booking_system.sql',
          '4. Paste and run it in the SQL editor'
        ]
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})