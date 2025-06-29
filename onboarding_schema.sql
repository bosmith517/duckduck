-- Service contractor onboarding schema enhancements

-- Add service type and customization to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS service_type character varying,
ADD COLUMN IF NOT EXISTS service_subtypes text[],
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS workflow_preferences jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS business_info jsonb DEFAULT '{}'::jsonb;

-- Service types lookup table
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

-- Insert common service types
INSERT INTO public.service_types (name, code, description, icon, default_workflow) VALUES
('HVAC', 'hvac', 'Heating, Ventilation, and Air Conditioning', 'temperature', '{"require_equipment_details": true, "track_warranties": true}'),
('Plumbing', 'plumbing', 'Plumbing services', 'water', '{"require_permits": true, "track_fixtures": true}'),
('Electrical', 'electrical', 'Electrical services', 'flash', '{"require_permits": true, "track_circuits": true}'),
('Roofing', 'roofing', 'Roofing services', 'home-2', '{"require_measurements": true, "track_materials": true}'),
('General Contractor', 'general', 'General contracting', 'abstract-26', '{"multi_trade": true, "subcontractor_management": true}'),
('Landscaping', 'landscaping', 'Landscaping and lawn care', 'flower', '{"seasonal_scheduling": true, "recurring_services": true}'),
('Painting', 'painting', 'Interior and exterior painting', 'color-palette', '{"track_paint_colors": true, "surface_measurements": true}'),
('Flooring', 'flooring', 'Flooring installation', 'category', '{"track_square_footage": true, "material_calculator": true}'),
('Solar', 'solar', 'Solar panel installation', 'sun', '{"require_permits": true, "energy_calculations": true}'),
('Pool & Spa', 'pool', 'Pool and spa services', 'drop', '{"chemical_tracking": true, "maintenance_schedules": true}')
ON CONFLICT (code) DO NOTHING;

-- Quick add templates for different service types
CREATE TABLE IF NOT EXISTS public.quick_add_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  service_type_id uuid,
  name character varying NOT NULL,
  template_type character varying NOT NULL CHECK (template_type IN ('client', 'project', 'both')),
  form_fields jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quick_add_templates_pkey PRIMARY KEY (id),
  CONSTRAINT quick_add_templates_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT quick_add_templates_service_type_fkey FOREIGN KEY (service_type_id) REFERENCES public.service_types(id)
);

-- Onboarding progress tracking
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

-- Project templates for different service types
CREATE TABLE IF NOT EXISTS public.project_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid,
  service_type_id uuid,
  name character varying NOT NULL,
  description text,
  default_tasks jsonb,
  default_milestones jsonb,
  default_duration_days integer,
  required_fields jsonb,
  is_global boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_templates_pkey PRIMARY KEY (id),
  CONSTRAINT project_templates_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT project_templates_service_type_fkey FOREIGN KEY (service_type_id) REFERENCES public.service_types(id)
);

-- Add project template reference to jobs
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS project_template_id uuid,
ADD COLUMN IF NOT EXISTS project_data jsonb DEFAULT '{}'::jsonb,
ADD CONSTRAINT jobs_project_template_fkey FOREIGN KEY (project_template_id) REFERENCES public.project_templates(id);

-- Add quick entry fields to contacts for smoother onboarding
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS source character varying DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS property_address text,
ADD COLUMN IF NOT EXISTS property_type character varying,
ADD COLUMN IF NOT EXISTS project_interest text,
ADD COLUMN IF NOT EXISTS urgency character varying,
ADD COLUMN IF NOT EXISTS budget_range character varying;

-- RLS Policies
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_add_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

-- Service types are public read
CREATE POLICY "Service types are viewable by everyone" ON public.service_types
  FOR SELECT USING (true);

-- Quick add templates tenant isolation
CREATE POLICY "Users can view their tenant quick add templates" ON public.quick_add_templates
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM public.user_profiles WHERE tenant_id = quick_add_templates.tenant_id
  ));

CREATE POLICY "Users can manage their tenant quick add templates" ON public.quick_add_templates
  FOR ALL USING (auth.uid() IN (
    SELECT id FROM public.user_profiles WHERE tenant_id = quick_add_templates.tenant_id
  ));

-- Onboarding progress tenant isolation
CREATE POLICY "Users can view their tenant onboarding progress" ON public.onboarding_progress
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM public.user_profiles WHERE tenant_id = onboarding_progress.tenant_id
  ));

CREATE POLICY "Users can manage their tenant onboarding progress" ON public.onboarding_progress
  FOR ALL USING (auth.uid() IN (
    SELECT id FROM public.user_profiles WHERE tenant_id = onboarding_progress.tenant_id
  ));

-- Project templates policies
CREATE POLICY "Users can view global and tenant project templates" ON public.project_templates
  FOR SELECT USING (
    is_global = true OR 
    auth.uid() IN (
      SELECT id FROM public.user_profiles WHERE tenant_id = project_templates.tenant_id
    )
  );

CREATE POLICY "Users can manage their tenant project templates" ON public.project_templates
  FOR ALL USING (
    is_global = false AND
    auth.uid() IN (
      SELECT id FROM public.user_profiles WHERE tenant_id = project_templates.tenant_id
    )
  );