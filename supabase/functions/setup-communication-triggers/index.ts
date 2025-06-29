import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Create the database schema for communication triggers
    const schema = `
      -- Communication triggers table
      CREATE TABLE IF NOT EXISTS communication_triggers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        trigger_type TEXT NOT NULL CHECK (trigger_type IN ('job_status', 'location_proximity', 'time_based', 'payment_status', 'appointment_reminder')),
        trigger_conditions JSONB NOT NULL DEFAULT '{}',
        message_template JSONB NOT NULL DEFAULT '{}',
        active BOOLEAN DEFAULT true,
        send_count INTEGER DEFAULT 0,
        last_sent TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Communication trigger logs
      CREATE TABLE IF NOT EXISTS communication_trigger_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        trigger_id UUID REFERENCES communication_triggers(id) ON DELETE CASCADE,
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        recipient_phone TEXT,
        recipient_email TEXT,
        message_sent TEXT,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        success BOOLEAN DEFAULT false,
        error_message TEXT
      );

      -- Real-time location tracking for technicians
      CREATE TABLE IF NOT EXISTS technician_locations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        technician_id UUID NOT NULL,
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy DECIMAL(8, 2),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_communication_triggers_tenant_active ON communication_triggers(tenant_id, active);
      CREATE INDEX IF NOT EXISTS idx_trigger_logs_job_trigger ON communication_trigger_logs(job_id, trigger_id);
      CREATE INDEX IF NOT EXISTS idx_technician_locations_job ON technician_locations(job_id, timestamp DESC);

      -- Enable RLS
      ALTER TABLE communication_triggers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE communication_trigger_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE technician_locations ENABLE ROW LEVEL SECURITY;

      -- RLS Policies
      CREATE POLICY IF NOT EXISTS "Users can manage their tenant's communication triggers" ON communication_triggers
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      CREATE POLICY IF NOT EXISTS "Users can view their tenant's trigger logs" ON communication_trigger_logs
        FOR SELECT USING (trigger_id IN (SELECT id FROM communication_triggers WHERE tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())));

      CREATE POLICY IF NOT EXISTS "Users can manage their tenant's technician locations" ON technician_locations
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      -- Function to process job status changes
      CREATE OR REPLACE FUNCTION process_job_status_trigger()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Only process if status actually changed
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          -- Call the communication trigger processing function
          PERFORM net.http_post(
            url := '${Deno.env.get('SUPABASE_URL')}/functions/v1/process-communication-triggers',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}',
            body := json_build_object(
              'trigger_type', 'job_status',
              'job_id', NEW.id,
              'old_status', OLD.status,
              'new_status', NEW.status
            )::text
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger for job status changes
      DROP TRIGGER IF EXISTS trigger_job_status_change ON jobs;
      CREATE TRIGGER trigger_job_status_change
        AFTER UPDATE ON jobs
        FOR EACH ROW
        EXECUTE FUNCTION process_job_status_trigger();

      -- Function to check location proximity
      CREATE OR REPLACE FUNCTION check_location_proximity()
      RETURNS TRIGGER AS $$
      DECLARE
        job_record RECORD;
        distance_meters DECIMAL;
      BEGIN
        -- Get the associated job details
        SELECT * INTO job_record FROM jobs WHERE id = NEW.job_id;
        
        IF FOUND AND job_record.service_address_lat IS NOT NULL AND job_record.service_address_lng IS NOT NULL THEN
          -- Calculate distance using the Haversine formula
          SELECT (
            6371000 * acos(
              cos(radians(job_record.service_address_lat)) * 
              cos(radians(NEW.latitude)) * 
              cos(radians(NEW.longitude) - radians(job_record.service_address_lng)) + 
              sin(radians(job_record.service_address_lat)) * 
              sin(radians(NEW.latitude))
            )
          ) INTO distance_meters;

          -- Trigger proximity-based communications
          PERFORM net.http_post(
            url := '${Deno.env.get('SUPABASE_URL')}/functions/v1/process-communication-triggers',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}',
            body := json_build_object(
              'trigger_type', 'location_proximity',
              'job_id', NEW.job_id,
              'technician_location', json_build_object('lat', NEW.latitude, 'lng', NEW.longitude),
              'distance_meters', distance_meters
            )::text
          );
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger for location updates
      DROP TRIGGER IF EXISTS trigger_location_proximity ON technician_locations;
      CREATE TRIGGER trigger_location_proximity
        AFTER INSERT ON technician_locations
        FOR EACH ROW
        EXECUTE FUNCTION check_location_proximity();

      -- Function to handle payment triggers
      CREATE OR REPLACE FUNCTION process_payment_trigger()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid' THEN
          PERFORM net.http_post(
            url := '${Deno.env.get('SUPABASE_URL')}/functions/v1/process-communication-triggers',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}',
            body := json_build_object(
              'trigger_type', 'payment_status',
              'payment_id', NEW.id,
              'job_id', NEW.job_id
            )::text
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger for payment status changes (if you have a payments table)
      -- DROP TRIGGER IF EXISTS trigger_payment_status ON payments;
      -- CREATE TRIGGER trigger_payment_status
      --   AFTER UPDATE ON payments
      --   FOR EACH ROW
      --   EXECUTE FUNCTION process_payment_trigger();
    `

    // Execute the schema creation
    const { error } = await supabaseClient.rpc('exec_sql', { sql: schema })
    
    if (error) {
      console.error('Schema creation error:', error)
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Communication triggers database schema created successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error setting up communication triggers:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})