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

    const brandingSchema = `
      -- Create tenant_branding table for white-label settings
      CREATE TABLE IF NOT EXISTS tenant_branding (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        company_name TEXT NOT NULL,
        logo_url TEXT,
        primary_color TEXT DEFAULT '#007bff',
        secondary_color TEXT DEFAULT '#6c757d',
        custom_domain TEXT,
        email_from_name TEXT NOT NULL,
        email_from_address TEXT NOT NULL,
        phone_display_name TEXT,
        website_url TEXT,
        address TEXT,
        tagline TEXT,
        email_signature TEXT,
        portal_subdomain TEXT,
        white_label_enabled BOOLEAN DEFAULT false,
        custom_css TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id),
        UNIQUE(portal_subdomain),
        UNIQUE(custom_domain)
      );

      -- Create communication_preferences table for smart communication
      CREATE TABLE IF NOT EXISTS communication_preferences (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        customer_id UUID, -- Can be contact_id or account_id
        customer_type TEXT CHECK (customer_type IN ('contact', 'account')),
        
        -- Communication preferences
        preferred_method TEXT DEFAULT 'sms' CHECK (preferred_method IN ('sms', 'email', 'phone', 'portal')),
        business_hours_only BOOLEAN DEFAULT false,
        timezone TEXT DEFAULT 'America/New_York',
        business_start_time TIME DEFAULT '09:00:00',
        business_end_time TIME DEFAULT '17:00:00',
        weekend_communication BOOLEAN DEFAULT false,
        
        -- Auto-response preferences
        auto_followup_enabled BOOLEAN DEFAULT true,
        followup_delay_hours INTEGER DEFAULT 24,
        max_followup_attempts INTEGER DEFAULT 3,
        escalation_enabled BOOLEAN DEFAULT true,
        escalation_delay_hours INTEGER DEFAULT 48,
        
        -- Response tracking
        last_response_at TIMESTAMPTZ,
        response_rate DECIMAL(5,2) DEFAULT 0.00,
        avg_response_time_minutes INTEGER DEFAULT 0,
        
        -- Preferences
        appointment_reminders BOOLEAN DEFAULT true,
        job_updates BOOLEAN DEFAULT true,
        marketing_communications BOOLEAN DEFAULT false,
        emergency_communications BOOLEAN DEFAULT true,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, customer_id)
      );

      -- Create communication_log table for tracking interactions
      CREATE TABLE IF NOT EXISTS communication_log (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL,
        customer_type TEXT NOT NULL CHECK (customer_type IN ('contact', 'account')),
        job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
        
        -- Communication details
        communication_type TEXT NOT NULL CHECK (communication_type IN ('sms', 'email', 'phone', 'portal_message', 'auto_followup', 'escalation')),
        direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
        message_content TEXT,
        subject TEXT,
        
        -- Response tracking
        requires_response BOOLEAN DEFAULT false,
        response_deadline TIMESTAMPTZ,
        responded_at TIMESTAMPTZ,
        response_time_minutes INTEGER,
        
        -- Auto-communication metadata
        is_automated BOOLEAN DEFAULT false,
        trigger_type TEXT,
        followup_sequence_id UUID,
        escalation_level INTEGER DEFAULT 0,
        
        -- Status and delivery
        status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'responded', 'failed', 'bounced')),
        delivery_attempts INTEGER DEFAULT 1,
        error_message TEXT,
        
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create auto_followup_sequences table
      CREATE TABLE IF NOT EXISTS auto_followup_sequences (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        
        -- Trigger conditions
        trigger_event TEXT NOT NULL CHECK (trigger_event IN ('job_scheduled', 'estimate_sent', 'invoice_sent', 'job_completed', 'no_response', 'portal_inactive')),
        trigger_delay_hours INTEGER DEFAULT 24,
        
        -- Sequence settings
        max_attempts INTEGER DEFAULT 3,
        escalation_enabled BOOLEAN DEFAULT false,
        escalation_delay_hours INTEGER DEFAULT 48,
        respect_business_hours BOOLEAN DEFAULT true,
        
        -- Message templates
        message_templates JSONB DEFAULT '[]',
        escalation_templates JSONB DEFAULT '[]',
        
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create email_templates table for branded communications
      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        template_name TEXT NOT NULL,
        template_type TEXT NOT NULL CHECK (template_type IN ('welcome', 'job_scheduled', 'job_update', 'estimate', 'invoice', 'completion', 'followup', 'escalation')),
        
        subject_template TEXT NOT NULL,
        html_template TEXT NOT NULL,
        text_template TEXT,
        
        -- Template variables available: {customer_name}, {company_name}, {job_title}, {portal_url}, etc.
        variables_used TEXT[] DEFAULT ARRAY[]::TEXT[],
        
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        UNIQUE(tenant_id, template_name)
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_communication_preferences_tenant_customer ON communication_preferences(tenant_id, customer_id);
      CREATE INDEX IF NOT EXISTS idx_communication_log_tenant_customer ON communication_log(tenant_id, customer_id);
      CREATE INDEX IF NOT EXISTS idx_communication_log_job_id ON communication_log(job_id);
      CREATE INDEX IF NOT EXISTS idx_communication_log_created_at ON communication_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_auto_followup_tenant_active ON auto_followup_sequences(tenant_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_email_templates_tenant_type ON email_templates(tenant_id, template_type);

      -- Enable RLS on all tables
      ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
      ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;
      ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
      ALTER TABLE auto_followup_sequences ENABLE ROW LEVEL SECURITY;
      ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

      -- RLS Policies
      CREATE POLICY IF NOT EXISTS "Tenant branding is tenant-isolated" ON tenant_branding
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      CREATE POLICY IF NOT EXISTS "Communication preferences are tenant-isolated" ON communication_preferences
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      CREATE POLICY IF NOT EXISTS "Communication log is tenant-isolated" ON communication_log
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      CREATE POLICY IF NOT EXISTS "Auto followup sequences are tenant-isolated" ON auto_followup_sequences
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      CREATE POLICY IF NOT EXISTS "Email templates are tenant-isolated" ON email_templates
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      -- Function to initialize communication preferences for new customers
      CREATE OR REPLACE FUNCTION initialize_customer_communication_preferences()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Initialize preferences for new contacts
        IF TG_TABLE_NAME = 'contacts' THEN
          INSERT INTO communication_preferences (
            tenant_id, customer_id, customer_type, preferred_method, business_hours_only
          ) VALUES (
            NEW.tenant_id, NEW.id, 'contact', 'sms', true
          ) ON CONFLICT (tenant_id, customer_id) DO NOTHING;
        END IF;
        
        -- Initialize preferences for new accounts
        IF TG_TABLE_NAME = 'accounts' THEN
          INSERT INTO communication_preferences (
            tenant_id, customer_id, customer_type, preferred_method, business_hours_only
          ) VALUES (
            NEW.tenant_id, NEW.id, 'account', 'email', true
          ) ON CONFLICT (tenant_id, customer_id) DO NOTHING;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Triggers for auto-initializing communication preferences
      DROP TRIGGER IF EXISTS trigger_init_contact_comm_prefs ON contacts;
      CREATE TRIGGER trigger_init_contact_comm_prefs
        AFTER INSERT ON contacts
        FOR EACH ROW
        EXECUTE FUNCTION initialize_customer_communication_preferences();

      DROP TRIGGER IF EXISTS trigger_init_account_comm_prefs ON accounts;
      CREATE TRIGGER trigger_init_account_comm_prefs
        AFTER INSERT ON accounts
        FOR EACH ROW
        EXECUTE FUNCTION initialize_customer_communication_preferences();

      -- Function to log communications and update response tracking
      CREATE OR REPLACE FUNCTION log_communication_activity(
        p_tenant_id UUID,
        p_customer_id UUID,
        p_customer_type TEXT,
        p_job_id UUID DEFAULT NULL,
        p_communication_type TEXT DEFAULT 'sms',
        p_direction TEXT DEFAULT 'outbound',
        p_message_content TEXT DEFAULT NULL,
        p_subject TEXT DEFAULT NULL,
        p_requires_response BOOLEAN DEFAULT false,
        p_is_automated BOOLEAN DEFAULT false
      ) RETURNS UUID AS $$
      DECLARE
        log_id UUID;
        response_deadline TIMESTAMPTZ;
      BEGIN
        -- Calculate response deadline if response required
        IF p_requires_response THEN
          SELECT 
            NOW() + (followup_delay_hours * INTERVAL '1 hour')
          INTO response_deadline
          FROM communication_preferences 
          WHERE tenant_id = p_tenant_id AND customer_id = p_customer_id;
          
          -- Default to 24 hours if no preference found
          IF response_deadline IS NULL THEN
            response_deadline := NOW() + INTERVAL '24 hours';
          END IF;
        END IF;

        -- Insert communication log
        INSERT INTO communication_log (
          tenant_id, customer_id, customer_type, job_id,
          communication_type, direction, message_content, subject,
          requires_response, response_deadline, is_automated
        ) VALUES (
          p_tenant_id, p_customer_id, p_customer_type, p_job_id,
          p_communication_type, p_direction, p_message_content, p_subject,
          p_requires_response, response_deadline, p_is_automated
        ) RETURNING id INTO log_id;

        -- Update last communication time in preferences
        UPDATE communication_preferences 
        SET updated_at = NOW()
        WHERE tenant_id = p_tenant_id AND customer_id = p_customer_id;

        RETURN log_id;
      END;
      $$ LANGUAGE plpgsql;

      -- Insert default email templates
      INSERT INTO email_templates (tenant_id, template_name, template_type, subject_template, html_template, text_template, is_default)
      SELECT 
        c.id as tenant_id,
        'Welcome Portal',
        'welcome',
        'Welcome to Your Service Portal - {company_name}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: {primary_color}; color: white; padding: 20px; text-align: center;">
            {logo_html}
            <h1>{company_name}</h1>
            <p>{tagline}</p>
          </div>
          <div style="padding: 30px;">
            <h2>Welcome {customer_name}!</h2>
            <p>We''ve created a secure portal where you can track your service progress:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{portal_url}" style="background: {primary_color}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Access Your Portal</a>
            </div>
            <p>Your portal link: <a href="{portal_url}">{portal_url}</a></p>
            {email_signature}
          </div>
        </div>',
        'Welcome {customer_name}! Access your service portal: {portal_url}. Best regards, {company_name}',
        true
      FROM companies c
      WHERE NOT EXISTS (
        SELECT 1 FROM email_templates et 
        WHERE et.tenant_id = c.id AND et.template_name = 'Welcome Portal'
      );

      -- Grant necessary permissions
      GRANT ALL ON tenant_branding TO authenticated;
      GRANT ALL ON communication_preferences TO authenticated;
      GRANT ALL ON communication_log TO authenticated;
      GRANT ALL ON auto_followup_sequences TO authenticated;
      GRANT ALL ON email_templates TO authenticated;
    `

    // Execute the schema
    const { error } = await supabaseClient.rpc('exec_sql', { sql: brandingSchema })
    
    if (error) {
      console.error('Branding schema error:', error)
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Branding and communication system setup completed successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error setting up branding system:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})