-- Template-Driven Estimates Schema - ULTRA SAFE VERSION
-- This handles the case where estimate_templates might already exist

-- First, let's handle the estimate_templates table carefully
DO $$ 
BEGIN
  -- Check if estimate_templates table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estimate_templates') THEN
    -- Create the table if it doesn't exist
    CREATE TABLE estimate_templates (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      service_type TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('installation', 'repair', 'maintenance', 'consultation', 'emergency', 'custom')),
      
      base_price DECIMAL(10,2) DEFAULT 0.00,
      pricing_tiers JSONB NOT NULL DEFAULT '{
        "basic": {"name": "Basic Package", "description": "", "price": 0, "includes": []},
        "standard": {"name": "Standard Package", "description": "", "price": 0, "includes": []},
        "premium": {"name": "Premium Package", "description": "", "price": 0, "includes": []}
      }',
      
      line_items JSONB DEFAULT '[]',
      variables JSONB DEFAULT '[]',
      
      is_default BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      usage_count INTEGER DEFAULT 0,
      estimated_duration_days INTEGER DEFAULT 1,
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- If table exists, add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimate_templates' AND column_name = 'service_type') THEN
      ALTER TABLE estimate_templates ADD COLUMN service_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimate_templates' AND column_name = 'category') THEN
      ALTER TABLE estimate_templates ADD COLUMN category TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimate_templates' AND column_name = 'pricing_tiers') THEN
      ALTER TABLE estimate_templates ADD COLUMN pricing_tiers JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimate_templates' AND column_name = 'line_items') THEN
      ALTER TABLE estimate_templates ADD COLUMN line_items JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimate_templates' AND column_name = 'variables') THEN
      ALTER TABLE estimate_templates ADD COLUMN variables JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimate_templates' AND column_name = 'usage_count') THEN
      ALTER TABLE estimate_templates ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;
  END IF;
END $$;

-- Add columns to existing estimates table safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimates' AND column_name = 'template_id') THEN
    ALTER TABLE estimates ADD COLUMN template_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimates' AND column_name = 'selected_tier') THEN
    ALTER TABLE estimates ADD COLUMN selected_tier TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimates' AND column_name = 'custom_variables') THEN
    ALTER TABLE estimates ADD COLUMN custom_variables JSONB DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimates' AND column_name = 'created_from_template') THEN
    ALTER TABLE estimates ADD COLUMN created_from_template BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create estimate_variables table if it doesn't exist
CREATE TABLE IF NOT EXISTS estimate_variables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT NOT NULL,
  affects_pricing BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create template_usage_analytics table if it doesn't exist  
CREATE TABLE IF NOT EXISTS template_usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES estimate_templates(id) ON DELETE CASCADE,
  
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  customer_id UUID,
  customer_type TEXT,
  
  selected_tier TEXT,
  final_amount DECIMAL(10,2),
  was_sent BOOLEAN DEFAULT false,
  was_accepted BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_estimates_template_id' AND table_name = 'estimates'
  ) THEN
    ALTER TABLE estimates 
    ADD CONSTRAINT fk_estimates_template_id 
    FOREIGN KEY (template_id) REFERENCES estimate_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estimate_templates') THEN
    ALTER TABLE estimate_templates ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estimate_variables') THEN
    ALTER TABLE estimate_variables ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'template_usage_analytics') THEN
    ALTER TABLE template_usage_analytics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;