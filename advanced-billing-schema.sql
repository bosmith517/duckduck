-- Advanced Billing System Schema Extensions for TradeWorks Pro
-- This file extends the existing schema to support the blueprint features

-- Product & Service Library
CREATE TABLE public.service_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  category_id uuid,
  name text NOT NULL,
  description text,
  unit_type character varying NOT NULL DEFAULT 'hour' CHECK (unit_type IN ('hour', 'unit', 'sq_ft', 'linear_ft', 'each')),
  default_rate numeric NOT NULL,
  labor_rate numeric,
  material_rate numeric,
  markup_percentage numeric DEFAULT 0.00,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT service_catalog_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Service Categories for organization
CREATE TABLE public.service_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  parent_category_id uuid,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_categories_pkey PRIMARY KEY (id),
  CONSTRAINT service_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT service_categories_parent_fkey FOREIGN KEY (parent_category_id) REFERENCES public.service_categories(id)
);

-- Add category reference to service catalog
ALTER TABLE public.service_catalog 
ADD CONSTRAINT service_catalog_category_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id);

-- Enhanced Estimates table with template support
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS estimate_number character varying;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS project_title text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS valid_until date;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS labor_cost numeric DEFAULT 0.00;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS material_cost numeric DEFAULT 0.00;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS markup_percentage numeric DEFAULT 0.00;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS template_type character varying CHECK (template_type IN ('single', 'tiered'));
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS signature_status character varying DEFAULT 'pending' CHECK (signature_status IN ('pending', 'signed', 'declined'));
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS signed_by_name text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS signature_ip_address inet;

-- Estimate Templates for Good/Better/Best
CREATE TABLE public.estimate_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  template_type character varying NOT NULL DEFAULT 'tiered' CHECK (template_type IN ('single', 'tiered')),
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estimate_templates_pkey PRIMARY KEY (id),
  CONSTRAINT estimate_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Estimate Tiers (Good, Better, Best)
CREATE TABLE public.estimate_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  tier_level character varying NOT NULL CHECK (tier_level IN ('good', 'better', 'best', 'custom')),
  tier_name text NOT NULL,
  description text,
  total_amount numeric NOT NULL,
  labor_cost numeric DEFAULT 0.00,
  material_cost numeric DEFAULT 0.00,
  markup_amount numeric DEFAULT 0.00,
  is_selected boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estimate_tiers_pkey PRIMARY KEY (id),
  CONSTRAINT estimate_tiers_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE,
  CONSTRAINT estimate_tiers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Estimate Line Items (for both single and tiered estimates)
CREATE TABLE public.estimate_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  estimate_id uuid,
  estimate_tier_id uuid,
  tenant_id uuid NOT NULL,
  service_catalog_id uuid,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  line_total numeric NOT NULL,
  item_type character varying DEFAULT 'service' CHECK (item_type IN ('service', 'material', 'labor', 'other')),
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estimate_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT estimate_line_items_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE,
  CONSTRAINT estimate_line_items_tier_id_fkey FOREIGN KEY (estimate_tier_id) REFERENCES public.estimate_tiers(id) ON DELETE CASCADE,
  CONSTRAINT estimate_line_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT estimate_line_items_service_fkey FOREIGN KEY (service_catalog_id) REFERENCES public.service_catalog(id),
  CONSTRAINT estimate_line_items_check CHECK ((estimate_id IS NOT NULL) OR (estimate_tier_id IS NOT NULL))
);

-- Enhanced Invoice table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number character varying;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS project_title text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_terms character varying DEFAULT 'net_30';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS viewed_at timestamp with time zone;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_status character varying DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue'));

-- Invoice Payments
CREATE TABLE public.invoice_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  payment_method character varying NOT NULL CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'other')),
  amount numeric NOT NULL,
  payment_date date NOT NULL,
  transaction_id text,
  processor character varying, -- 'stripe', 'square', etc.
  processor_fee numeric DEFAULT 0.00,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_payments_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT invoice_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Automated Invoice Reminders
CREATE TABLE public.invoice_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  reminder_type character varying NOT NULL CHECK (reminder_type IN ('due_soon', 'overdue_3', 'overdue_15', 'overdue_30', 'final_notice')),
  scheduled_for timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  email_subject text,
  email_body text,
  status character varying DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_reminders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT invoice_reminders_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);

-- Client Portal Access Tokens
CREATE TABLE public.client_portal_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  last_accessed timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_portal_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT client_portal_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT client_portal_tokens_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id)
);

-- Portal Activity Log
CREATE TABLE public.portal_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  activity_type character varying NOT NULL CHECK (activity_type IN ('login', 'view_estimate', 'accept_estimate', 'decline_estimate', 'view_invoice', 'pay_invoice', 'comment')),
  reference_id uuid, -- estimate_id or invoice_id
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT portal_activity_log_pkey PRIMARY KEY (id),
  CONSTRAINT portal_activity_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT portal_activity_log_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id)
);

-- Client Portal Comments/Chat
CREATE TABLE public.portal_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid,
  user_id uuid,
  reference_type character varying NOT NULL CHECK (reference_type IN ('estimate', 'invoice', 'job')),
  reference_id uuid NOT NULL,
  comment_text text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT portal_comments_pkey PRIMARY KEY (id),
  CONSTRAINT portal_comments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT portal_comments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT portal_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

-- Enhanced Jobs table for better costing
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS labor_hours_estimated numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS labor_hours_actual numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS labor_rate numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS material_cost_estimated numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS material_cost_actual numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS overhead_percentage numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS profit_margin_percentage numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS total_invoiced numeric DEFAULT 0;

-- Job Cost Tracking
CREATE TABLE public.job_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  cost_type character varying NOT NULL CHECK (cost_type IN ('labor', 'material', 'equipment', 'subcontractor', 'overhead', 'other')),
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_cost numeric NOT NULL,
  total_cost numeric NOT NULL,
  cost_date date NOT NULL,
  receipt_url text,
  vendor text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_costs_pkey PRIMARY KEY (id),
  CONSTRAINT job_costs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT job_costs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT job_costs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id)
);

-- Payment Processor Settings
CREATE TABLE public.payment_processor_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  processor character varying NOT NULL CHECK (processor IN ('stripe', 'square', 'paypal')),
  is_active boolean DEFAULT false,
  public_key text,
  private_key_encrypted text,
  webhook_secret_encrypted text,
  processing_fee_percentage numeric DEFAULT 2.9,
  processing_fee_fixed numeric DEFAULT 0.30,
  settings jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_processor_settings_pkey PRIMARY KEY (id),
  CONSTRAINT payment_processor_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Create indexes for performance
CREATE INDEX idx_service_catalog_tenant_id ON public.service_catalog(tenant_id);
CREATE INDEX idx_service_catalog_category_id ON public.service_catalog(category_id);
CREATE INDEX idx_estimate_tiers_estimate_id ON public.estimate_tiers(estimate_id);
CREATE INDEX idx_estimate_line_items_estimate_id ON public.estimate_line_items(estimate_id);
CREATE INDEX idx_estimate_line_items_tier_id ON public.estimate_line_items(estimate_tier_id);
CREATE INDEX idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_reminders_invoice_id ON public.invoice_reminders(invoice_id);
CREATE INDEX idx_invoice_reminders_scheduled_for ON public.invoice_reminders(scheduled_for);
CREATE INDEX idx_client_portal_tokens_token ON public.client_portal_tokens(token);
CREATE INDEX idx_portal_activity_log_contact_id ON public.portal_activity_log(contact_id);
CREATE INDEX idx_job_costs_job_id ON public.job_costs(job_id);

-- Enable RLS on all new tables
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_processor_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY service_catalog_tenant_policy ON public.service_catalog FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY service_categories_tenant_policy ON public.service_categories FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY estimate_templates_tenant_policy ON public.estimate_templates FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY estimate_tiers_tenant_policy ON public.estimate_tiers FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY estimate_line_items_tenant_policy ON public.estimate_line_items FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY invoice_payments_tenant_policy ON public.invoice_payments FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY invoice_reminders_tenant_policy ON public.invoice_reminders FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY client_portal_tokens_tenant_policy ON public.client_portal_tokens FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY portal_activity_log_tenant_policy ON public.portal_activity_log FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY portal_comments_tenant_policy ON public.portal_comments FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY job_costs_tenant_policy ON public.job_costs FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);
CREATE POLICY payment_processor_settings_tenant_policy ON public.payment_processor_settings FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);