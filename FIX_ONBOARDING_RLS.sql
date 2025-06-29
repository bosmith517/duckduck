-- Fix onboarding_progress table RLS policies
-- This script ensures the onboarding_progress table exists and has proper permissions

-- Ensure onboarding_progress table exists (from onboarding_schema.sql)
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  current_step character varying NOT NULL DEFAULT 'welcome',
  completed_steps text[] DEFAULT '{}',
  onboarding_data jsonb DEFAULT '{}'::jsonb,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id),
  CONSTRAINT onboarding_progress_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Enable RLS
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their tenant onboarding progress" ON public.onboarding_progress;
DROP POLICY IF EXISTS "Users can manage their tenant onboarding progress" ON public.onboarding_progress;

-- Create updated RLS policies that work with current user_profiles structure
CREATE POLICY "Users can view their tenant onboarding progress" ON public.onboarding_progress
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their tenant onboarding progress" ON public.onboarding_progress
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their tenant onboarding progress" ON public.onboarding_progress
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their tenant onboarding progress" ON public.onboarding_progress
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Service role can manage all onboarding progress
CREATE POLICY "Service role can manage all onboarding progress" ON public.onboarding_progress
  FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_progress TO service_role;

-- Also ensure service_types table is properly accessible
CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  code character varying NOT NULL UNIQUE,
  parent_id uuid,
  description text,
  default_workflow jsonb,
  default_fields jsonb,
  icon character varying,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_types_pkey PRIMARY KEY (id),
  CONSTRAINT service_types_parent_fkey FOREIGN KEY (parent_id) REFERENCES public.service_types(id)
);

-- Ensure service types data exists
INSERT INTO public.service_types (name, code, description, icon, default_workflow, sort_order) VALUES
('HVAC', 'hvac', 'Heating, Ventilation, and Air Conditioning', 'temperature', '{"require_equipment_details": true, "track_warranties": true}', 1),
('Plumbing', 'plumbing', 'Plumbing services', 'water', '{"require_permits": true, "track_fixtures": true}', 2),
('Electrical', 'electrical', 'Electrical services', 'flash', '{"require_permits": true, "track_circuits": true}', 3),
('Roofing', 'roofing', 'Roofing services', 'home-2', '{"require_measurements": true, "track_materials": true}', 4),
('General Contractor', 'general', 'General contracting', 'abstract-26', '{"multi_trade": true, "subcontractor_management": true}', 5),
('Landscaping', 'landscaping', 'Landscaping and lawn care', 'flower', '{"seasonal_scheduling": true, "recurring_services": true}', 6),
('Painting', 'painting', 'Interior and exterior painting', 'color-palette', '{"track_paint_colors": true, "surface_measurements": true}', 7),
('Flooring', 'flooring', 'Flooring installation', 'category', '{"track_square_footage": true, "material_calculator": true}', 8),
('Solar', 'solar', 'Solar panel installation', 'sun', '{"require_permits": true, "energy_calculations": true}', 9),
('Pool & Spa', 'pool', 'Pool and spa services', 'drop', '{"chemical_tracking": true, "maintenance_schedules": true}', 10)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  default_workflow = EXCLUDED.default_workflow,
  sort_order = EXCLUDED.sort_order;

-- Enable RLS for service_types and make them publicly readable
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service types are viewable by everyone" ON public.service_types;
CREATE POLICY "Service types are viewable by everyone" ON public.service_types
  FOR SELECT USING (true);

-- Grant permissions for service_types
GRANT SELECT ON public.service_types TO authenticated;
GRANT SELECT ON public.service_types TO anon;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_tenant_id ON public.onboarding_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_types_code ON public.service_types(code);
CREATE INDEX IF NOT EXISTS idx_service_types_sort_order ON public.service_types(sort_order);

COMMENT ON TABLE public.onboarding_progress IS 'Tracks contractor onboarding progress and data';
COMMENT ON TABLE public.service_types IS 'Service type definitions for contractor specializations';