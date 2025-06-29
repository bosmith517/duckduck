-- Template-Driven Estimates Database Schema (STEP BY STEP)
-- Run this one section at a time in the Supabase SQL Editor

-- STEP 1: Create estimate_templates table ONLY
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

-- STOP HERE AND RUN FIRST - If this works, continue to next step