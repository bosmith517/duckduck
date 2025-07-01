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

    const estimateTemplatesSchema = `
      -- Create estimate_templates table for template-driven estimates
      CREATE TABLE IF NOT EXISTS estimate_templates (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        service_type TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('installation', 'repair', 'maintenance', 'consultation', 'emergency', 'custom')),
        
        -- Base pricing structure
        base_price DECIMAL(10,2) DEFAULT 0.00,
        pricing_tiers JSONB NOT NULL DEFAULT '{
          "basic": {"name": "Basic Package", "description": "", "price": 0, "includes": []},
          "standard": {"name": "Standard Package", "description": "", "price": 0, "includes": []},
          "premium": {"name": "Premium Package", "description": "", "price": 0, "includes": []}
        }',
        
        -- Template configuration
        line_items JSONB DEFAULT '[]',
        variables JSONB DEFAULT '[]',
        markup_percentage DECIMAL(5,2) DEFAULT 20.00,
        tax_rate DECIMAL(5,2) DEFAULT 8.50,
        
        -- Template metadata
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        estimated_duration_days INTEGER DEFAULT 1,
        
        -- Approval workflow
        requires_approval BOOLEAN DEFAULT false,
        approval_threshold DECIMAL(10,2),
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create estimate_line_items table for detailed line items
      CREATE TABLE IF NOT EXISTS estimate_line_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
        template_line_item_id UUID,
        
        -- Line item details
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL CHECK (category IN ('labor', 'materials', 'equipment', 'permits', 'disposal', 'travel', 'markup', 'tax')),
        
        -- Pricing
        unit_type TEXT NOT NULL CHECK (unit_type IN ('hour', 'day', 'item', 'sqft', 'linear_ft', 'cubic_yard', 'gallon', 'ton')),
        unit_price DECIMAL(10,2) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
        total_price DECIMAL(10,2) NOT NULL,
        
        -- Markup and pricing adjustments
        markup_percentage DECIMAL(5,2) DEFAULT 0.00,
        discount_percentage DECIMAL(5,2) DEFAULT 0.00,
        
        -- Metadata
        is_optional BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        notes TEXT,
        
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create estimate_variables table for template variable tracking
      CREATE TABLE IF NOT EXISTS estimate_variables (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
        
        variable_name TEXT NOT NULL,
        variable_value TEXT,
        variable_type TEXT NOT NULL CHECK (variable_type IN ('number', 'text', 'select', 'checkbox', 'area_measurement')),
        affects_pricing BOOLEAN DEFAULT false,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(estimate_id, variable_name)
      );

      -- Update existing estimates table to support templates
      ALTER TABLE estimates 
      ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES estimate_templates(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS selected_tier TEXT CHECK (selected_tier IN ('basic', 'standard', 'premium')),
      ADD COLUMN IF NOT EXISTS custom_variables JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5,2) DEFAULT 20.00,
      ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS created_from_template BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS estimated_duration_days INTEGER DEFAULT 1;

      -- Create template_usage_analytics table for tracking
      CREATE TABLE IF NOT EXISTS template_usage_analytics (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        template_id UUID NOT NULL REFERENCES estimate_templates(id) ON DELETE CASCADE,
        
        -- Usage details
        user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
        customer_id UUID,
        customer_type TEXT CHECK (customer_type IN ('contact', 'account')),
        
        -- Results
        selected_tier TEXT,
        final_amount DECIMAL(10,2),
        creation_time_seconds INTEGER,
        was_sent BOOLEAN DEFAULT false,
        was_accepted BOOLEAN DEFAULT false,
        
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_estimate_templates_tenant_service ON estimate_templates(tenant_id, service_type);
      CREATE INDEX IF NOT EXISTS idx_estimate_templates_usage ON estimate_templates(tenant_id, usage_count DESC);
      CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate ON estimate_line_items(estimate_id);
      CREATE INDEX IF NOT EXISTS idx_estimate_variables_estimate ON estimate_variables(estimate_id);
      CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage_analytics(template_id);
      CREATE INDEX IF NOT EXISTS idx_estimates_template_id ON estimates(template_id);

      -- Enable RLS on all tables
      ALTER TABLE estimate_templates ENABLE ROW LEVEL SECURITY;
      ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
      ALTER TABLE estimate_variables ENABLE ROW LEVEL SECURITY;
      ALTER TABLE template_usage_analytics ENABLE ROW LEVEL SECURITY;

      -- RLS Policies
      CREATE POLICY IF NOT EXISTS "Estimate templates are tenant-isolated" ON estimate_templates
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      CREATE POLICY IF NOT EXISTS "Estimate line items are tenant-isolated" ON estimate_line_items
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      CREATE POLICY IF NOT EXISTS "Estimate variables are tenant-isolated" ON estimate_variables
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      CREATE POLICY IF NOT EXISTS "Template usage analytics are tenant-isolated" ON template_usage_analytics
        FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

      -- Function to automatically update template usage count
      CREATE OR REPLACE FUNCTION update_template_usage_count()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Increment usage count when estimate is created from template
        IF NEW.template_id IS NOT NULL AND NEW.created_from_template = true THEN
          UPDATE estimate_templates 
          SET 
            usage_count = usage_count + 1,
            updated_at = NOW()
          WHERE id = NEW.template_id;
          
          -- Log usage analytics
          INSERT INTO template_usage_analytics (
            tenant_id, template_id, user_id, customer_id, customer_type,
            selected_tier, final_amount, was_sent
          ) VALUES (
            NEW.tenant_id, NEW.template_id, auth.uid(), 
            CASE 
              WHEN NEW.contact_id IS NOT NULL THEN NEW.contact_id
              WHEN NEW.account_id IS NOT NULL THEN NEW.account_id
              ELSE NULL
            END,
            CASE 
              WHEN NEW.contact_id IS NOT NULL THEN 'contact'
              WHEN NEW.account_id IS NOT NULL THEN 'account'
              ELSE NULL
            END,
            NEW.selected_tier, NEW.total_amount, false
          );
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger for template usage tracking
      DROP TRIGGER IF EXISTS trigger_update_template_usage ON estimates;
      CREATE TRIGGER trigger_update_template_usage
        AFTER INSERT ON estimates
        FOR EACH ROW
        EXECUTE FUNCTION update_template_usage_count();

      -- Function to calculate estimate totals from line items
      CREATE OR REPLACE FUNCTION calculate_estimate_totals(estimate_id_param UUID)
      RETURNS TABLE (
        subtotal DECIMAL(10,2),
        total_markup DECIMAL(10,2),
        total_tax DECIMAL(10,2),
        total_amount DECIMAL(10,2)
      ) AS $$
      DECLARE
        est_record RECORD;
        line_subtotal DECIMAL(10,2) := 0;
        markup_amount DECIMAL(10,2) := 0;
        tax_amount DECIMAL(10,2) := 0;
        final_total DECIMAL(10,2) := 0;
      BEGIN
        -- Get estimate details
        SELECT markup_percentage, tax_rate INTO est_record
        FROM estimates e
        WHERE e.id = estimate_id_param;
        
        -- Calculate line items subtotal
        SELECT COALESCE(SUM(total_price), 0) INTO line_subtotal
        FROM estimate_line_items
        WHERE estimate_id = estimate_id_param;
        
        -- Calculate markup
        markup_amount := line_subtotal * (COALESCE(est_record.markup_percentage, 0) / 100);
        
        -- Calculate tax on subtotal + markup
        tax_amount := (line_subtotal + markup_amount) * (COALESCE(est_record.tax_rate, 0) / 100);
        
        -- Calculate final total
        final_total := line_subtotal + markup_amount + tax_amount;
        
        RETURN QUERY SELECT line_subtotal, markup_amount, tax_amount, final_total;
      END;
      $$ LANGUAGE plpgsql;

      -- View for template performance analytics
      CREATE OR REPLACE VIEW template_performance_analytics AS
      SELECT 
        et.id as template_id,
        et.name as template_name,
        et.service_type,
        et.category,
        et.usage_count,
        et.created_at as template_created_at,
        
        -- Usage statistics
        COUNT(tua.id) as total_uses,
        COUNT(CASE WHEN tua.was_sent THEN 1 END) as estimates_sent,
        COUNT(CASE WHEN tua.was_accepted THEN 1 END) as estimates_accepted,
        
        -- Financial metrics
        AVG(tua.final_amount) as avg_estimate_amount,
        SUM(tua.final_amount) as total_estimate_value,
        
        -- Performance metrics
        CASE 
          WHEN COUNT(tua.id) > 0 
          THEN ROUND((COUNT(CASE WHEN tua.was_accepted THEN 1 END)::DECIMAL / COUNT(tua.id)) * 100, 2)
          ELSE 0 
        END as acceptance_rate,
        
        -- Most popular tier
        (
          SELECT selected_tier 
          FROM template_usage_analytics tua2 
          WHERE tua2.template_id = et.id 
          GROUP BY selected_tier 
          ORDER BY COUNT(*) DESC 
          LIMIT 1
        ) as most_popular_tier,
        
        -- Recent usage
        MAX(tua.created_at) as last_used_at
        
      FROM estimate_templates et
      LEFT JOIN template_usage_analytics tua ON et.id = tua.template_id
      GROUP BY et.id, et.name, et.service_type, et.category, et.usage_count, et.created_at;

      -- Grant necessary permissions
      GRANT ALL ON estimate_templates TO authenticated;
      GRANT ALL ON estimate_line_items TO authenticated;
      GRANT ALL ON estimate_variables TO authenticated;
      GRANT ALL ON template_usage_analytics TO authenticated;
      GRANT SELECT ON template_performance_analytics TO authenticated;
    `

    // Execute the schema
    const { error } = await supabaseClient.rpc('exec_sql', { sql: estimateTemplatesSchema })
    
    if (error) {
      console.error('Estimate templates schema error:', error)
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Template-driven estimates system setup completed successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error setting up estimate templates:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
