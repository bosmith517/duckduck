-- Complete Contractor Workflow System
-- Supporting 18-stage job lifecycle with inspections, milestones, and automation

-- ===== UPDATE EXISTING TABLES =====

-- Update leads table with site visit workflow
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS site_visit_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS site_visit_notes TEXT,
ADD COLUMN IF NOT EXISTS assigned_rep UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS site_photos_url TEXT[];

-- Update job statuses to support full 18-stage lifecycle  
UPDATE public.jobs SET status = 'new' WHERE status = 'draft';

-- Comment existing status field to document the full workflow
COMMENT ON COLUMN public.jobs.status IS '18-stage workflow: new, site_visit_scheduled, site_visit_completed, estimate_draft, estimate_sent, under_negotiation, approved, deposit_paid, permitting, team_assigned, materials_ordered, scheduled, in_progress, milestone_reached, awaiting_inspection, final_review, invoice_sent, completed';

-- ===== NEW WORKFLOW TABLES =====

-- Job Milestones - Payment and progress tracking
CREATE TABLE IF NOT EXISTS public.job_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    
    -- Milestone definition
    milestone_name TEXT NOT NULL, -- 'deposit', 'material_delivery', 'rough_complete', 'final_completion'
    milestone_type TEXT NOT NULL, -- 'payment', 'progress', 'inspection', 'approval'
    sequence_order INTEGER NOT NULL,
    
    -- Payment details (if payment milestone)
    amount DECIMAL(10,2),
    percentage_of_total DECIMAL(5,2),
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'
    target_date DATE,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.user_profiles(id),
    
    -- Documentation
    requirements TEXT,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Job Inspections - Trade-based inspection tracking
CREATE TABLE IF NOT EXISTS public.job_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    
    -- Inspection definition
    trade TEXT NOT NULL, -- 'electrical', 'plumbing', 'hvac', 'structural', 'final'
    phase TEXT NOT NULL, -- 'rough', 'final'
    inspection_type TEXT NOT NULL, -- 'city', 'internal', 'third_party'
    
    -- Requirements
    required BOOLEAN NOT NULL DEFAULT true,
    prerequisites TEXT[], -- ['framing_complete', 'electrical_rough_in']
    
    -- Scheduling
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'scheduled', 'passed', 'failed', 'waived'
    scheduled_date TIMESTAMPTZ,
    completed_date TIMESTAMPTZ,
    
    -- Results
    inspector_name TEXT,
    inspector_contact TEXT,
    result TEXT, -- 'pass', 'fail', 'conditional'
    notes TEXT,
    punch_list TEXT[],
    certificate_number TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Job Permits - Permit tracking and approvals
CREATE TABLE IF NOT EXISTS public.job_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    
    -- Permit details
    permit_type TEXT NOT NULL, -- 'building', 'electrical', 'plumbing', 'mechanical'
    permit_number TEXT,
    authority TEXT, -- City, County, etc.
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'required', -- 'required', 'submitted', 'approved', 'rejected', 'expired'
    submitted_date DATE,
    approved_date DATE,
    expiry_date DATE,
    
    -- Costs and details
    permit_fee DECIMAL(10,2),
    application_fee DECIMAL(10,2),
    description TEXT,
    conditions TEXT[],
    
    -- Documentation
    documents JSONB DEFAULT '[]'::jsonb, -- URLs to permit docs
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Team Assignments - Staff and contractor assignments per job
CREATE TABLE IF NOT EXISTS public.job_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    
    -- Team member details
    user_id UUID REFERENCES public.user_profiles(id),
    role TEXT NOT NULL, -- 'project_manager', 'lead_tech', 'electrician', 'plumber', 'helper'
    trade TEXT, -- 'electrical', 'plumbing', 'hvac', 'general'
    
    -- Assignment details
    assignment_type TEXT NOT NULL DEFAULT 'internal', -- 'internal', 'subcontractor'
    hourly_rate DECIMAL(10,2),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'assigned', -- 'assigned', 'active', 'completed', 'removed'
    start_date DATE,
    end_date DATE,
    
    -- External contractor details (if subcontractor)
    contractor_name TEXT,
    contractor_contact TEXT,
    contractor_license TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Material Orders - Material procurement tracking
CREATE TABLE IF NOT EXISTS public.job_material_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    
    -- Order details
    order_number TEXT,
    vendor_name TEXT NOT NULL,
    vendor_contact TEXT,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'ordered', 'partial', 'delivered', 'cancelled'
    order_date DATE,
    expected_delivery DATE,
    actual_delivery DATE,
    
    -- Financial
    order_total DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    delivery_fee DECIMAL(10,2),
    
    -- Items (detailed breakdown)
    items JSONB DEFAULT '[]'::jsonb,
    
    -- Documentation
    purchase_order_url TEXT,
    delivery_receipt_url TEXT,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workflow Rules - Configurable workflow automation
CREATE TABLE IF NOT EXISTS public.workflow_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    
    -- Rule definition
    rule_name TEXT NOT NULL,
    trigger_status TEXT NOT NULL, -- Status that triggers this rule
    target_entity TEXT NOT NULL, -- 'job', 'lead', 'estimate'
    
    -- Conditions
    conditions JSONB DEFAULT '{}'::jsonb, -- Job type, value thresholds, etc.
    
    -- Actions
    auto_advance_to TEXT, -- Next status to automatically advance to
    create_milestones BOOLEAN DEFAULT false,
    create_inspections BOOLEAN DEFAULT false,
    send_notifications BOOLEAN DEFAULT false,
    
    -- Notification settings
    notify_roles TEXT[], -- Roles to notify
    notification_template TEXT,
    
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== INDEXES FOR PERFORMANCE =====

-- Job workflow indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status_tenant ON public.jobs(status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_workflow_dates ON public.jobs(start_date, due_date);

-- Milestone indexes
CREATE INDEX IF NOT EXISTS idx_milestones_job_status ON public.job_milestones(job_id, status);
CREATE INDEX IF NOT EXISTS idx_milestones_tenant_status ON public.job_milestones(tenant_id, status);

-- Inspection indexes  
CREATE INDEX IF NOT EXISTS idx_inspections_job_trade ON public.job_inspections(job_id, trade, phase);
CREATE INDEX IF NOT EXISTS idx_inspections_status_date ON public.job_inspections(status, scheduled_date);

-- Team assignment indexes
CREATE INDEX IF NOT EXISTS idx_team_assignments_job ON public.job_team_assignments(job_id, status);
CREATE INDEX IF NOT EXISTS idx_team_assignments_user ON public.job_team_assignments(user_id, status);

-- ===== ROW LEVEL SECURITY =====

-- Enable RLS on new tables
ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;

-- Create tenant-based RLS policies using Supabase standard approach
CREATE POLICY "job_milestones_tenant_policy" ON public.job_milestones 
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "job_inspections_tenant_policy" ON public.job_inspections 
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "job_permits_tenant_policy" ON public.job_permits 
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "job_team_assignments_tenant_policy" ON public.job_team_assignments 
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "job_material_orders_tenant_policy" ON public.job_material_orders 
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "workflow_rules_tenant_policy" ON public.workflow_rules 
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );