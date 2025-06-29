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

    // Update the existing client_portal_tokens table to include job_id and additional fields
    const portalTokensSchema = `
      -- Update client_portal_tokens table for job-specific tokens
      ALTER TABLE client_portal_tokens 
      ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS customer_id UUID, -- Can reference either contact_id or account_id
      ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_portal_tokens_job_id ON client_portal_tokens(job_id);
      CREATE INDEX IF NOT EXISTS idx_portal_tokens_customer_id ON client_portal_tokens(customer_id);
      CREATE INDEX IF NOT EXISTS idx_portal_tokens_tenant_active ON client_portal_tokens(tenant_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON client_portal_tokens(token) WHERE is_active = true;

      -- Update the portal_activity_log table structure
      DROP TABLE IF EXISTS portal_activity_log CASCADE;
      CREATE TABLE portal_activity_log (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        portal_token_id UUID NOT NULL REFERENCES client_portal_tokens(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'view_job', 'view_estimate', 'approve_estimate', 'decline_estimate', 'view_invoice', 'payment_attempt', 'payment_success', 'document_download', 'message_sent', 'file_upload')),
        page_visited TEXT,
        duration_seconds INTEGER,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes for portal activity
      CREATE INDEX IF NOT EXISTS idx_portal_activity_token_id ON portal_activity_log(portal_token_id);
      CREATE INDEX IF NOT EXISTS idx_portal_activity_created_at ON portal_activity_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_portal_activity_type ON portal_activity_log(activity_type);

      -- Enable RLS on portal activity log
      ALTER TABLE portal_activity_log ENABLE ROW LEVEL SECURITY;

      -- RLS Policy for portal activity log
      CREATE POLICY IF NOT EXISTS "Portal activity is tenant-isolated" ON portal_activity_log
        FOR ALL USING (portal_token_id IN (
          SELECT id FROM client_portal_tokens 
          WHERE tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        ));

      -- Function to auto-generate portal token when job is created
      CREATE OR REPLACE FUNCTION auto_generate_portal_token()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Only create portal token for jobs with customers
        IF NEW.contact_id IS NOT NULL OR NEW.account_id IS NOT NULL THEN
          PERFORM net.http_post(
            url := '${Deno.env.get('SUPABASE_URL')}/functions/v1/auto-generate-job-portal',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}"}',
            body := json_build_object(
              'job_id', NEW.id,
              'tenant_id', NEW.tenant_id,
              'contact_id', NEW.contact_id,
              'account_id', NEW.account_id
            )::text
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger to auto-generate portal tokens for new jobs
      DROP TRIGGER IF EXISTS trigger_auto_portal_token ON jobs;
      CREATE TRIGGER trigger_auto_portal_token
        AFTER INSERT ON jobs
        FOR EACH ROW
        EXECUTE FUNCTION auto_generate_portal_token();

      -- Function to log portal activity with automatic token updates
      CREATE OR REPLACE FUNCTION log_portal_activity(
        p_token_id UUID,
        p_activity_type TEXT,
        p_page_visited TEXT DEFAULT NULL,
        p_metadata JSONB DEFAULT '{}'
      ) RETURNS UUID AS $$
      DECLARE
        activity_id UUID;
      BEGIN
        -- Insert activity log
        INSERT INTO portal_activity_log (
          portal_token_id,
          activity_type,
          page_visited,
          metadata,
          created_at
        ) VALUES (
          p_token_id,
          p_activity_type,
          p_page_visited,
          p_metadata,
          NOW()
        ) RETURNING id INTO activity_id;

        -- Update token last_accessed time if it's a login or view activity
        IF p_activity_type IN ('login', 'view_job', 'view_estimate', 'view_invoice') THEN
          UPDATE client_portal_tokens 
          SET 
            last_accessed = NOW(),
            access_count = access_count + 1
          WHERE id = p_token_id;
        END IF;

        RETURN activity_id;
      END;
      $$ LANGUAGE plpgsql;

      -- View for portal analytics summary
      CREATE OR REPLACE VIEW portal_analytics_summary AS
      SELECT 
        cpt.id as token_id,
        cpt.job_id,
        cpt.tenant_id,
        cpt.customer_id,
        cpt.token,
        cpt.created_at as portal_created_at,
        cpt.last_accessed,
        cpt.access_count,
        cpt.is_active,
        
        -- Activity counts
        COUNT(pal.id) as total_activities,
        COUNT(DISTINCT DATE(pal.created_at)) as active_days,
        
        -- Activity breakdown
        COUNT(CASE WHEN pal.activity_type = 'login' THEN 1 END) as login_count,
        COUNT(CASE WHEN pal.activity_type = 'view_job' THEN 1 END) as job_views,
        COUNT(CASE WHEN pal.activity_type = 'view_estimate' THEN 1 END) as estimate_views,
        COUNT(CASE WHEN pal.activity_type = 'view_invoice' THEN 1 END) as invoice_views,
        COUNT(CASE WHEN pal.activity_type = 'payment_success' THEN 1 END) as payments_made,
        
        -- Engagement metrics
        MAX(pal.created_at) as last_activity,
        CASE 
          WHEN MAX(pal.created_at) > NOW() - INTERVAL '7 days' THEN true 
          ELSE false 
        END as is_recently_active,
        
        -- Customer info from jobs
        j.title as job_title,
        j.status as job_status,
        COALESCE(c.first_name || ' ' || c.last_name, a.name) as customer_name,
        COALESCE(c.phone, a.phone) as customer_phone,
        COALESCE(c.email, a.email) as customer_email
        
      FROM client_portal_tokens cpt
      LEFT JOIN portal_activity_log pal ON cpt.id = pal.portal_token_id
      LEFT JOIN jobs j ON cpt.job_id = j.id
      LEFT JOIN contacts c ON cpt.contact_id = c.id
      LEFT JOIN accounts a ON j.account_id = a.id
      GROUP BY 
        cpt.id, cpt.job_id, cpt.tenant_id, cpt.customer_id, cpt.token, 
        cpt.created_at, cpt.last_accessed, cpt.access_count, cpt.is_active,
        j.title, j.status, c.first_name, c.last_name, a.name, c.phone, a.phone, c.email, a.email;

      -- Grant necessary permissions
      GRANT SELECT ON portal_analytics_summary TO authenticated;
    `

    // Execute the schema updates
    const { error } = await supabaseClient.rpc('exec_sql', { sql: portalTokensSchema })
    
    if (error) {
      console.error('Portal tokens schema error:', error)
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Portal tokens and activity tracking schema created successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error setting up portal tokens:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})