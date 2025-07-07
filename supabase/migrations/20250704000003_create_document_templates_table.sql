-- Create document_templates table for managing company document templates
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Template Information
    template_name VARCHAR(255) NOT NULL,
    template_description TEXT,
    template_type VARCHAR(100) NOT NULL, -- 'contract', 'estimate', 'invoice', 'proposal', 'agreement', 'form', 'checklist', 'report', 'custom'
    
    -- File Storage
    file_url TEXT NOT NULL, -- URL to the template file in Supabase storage
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER, -- File size in bytes
    file_type VARCHAR(50), -- MIME type: 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', etc.
    
    -- Template Configuration
    auto_fill_fields JSONB DEFAULT '[]'::jsonb, -- Array of field names that can be auto-filled: ["customer_name", "address", "date", "job_id", etc.]
    required_signatures JSONB DEFAULT '[]'::jsonb, -- Array of signature requirements: [{"role": "customer", "required": true}, {"role": "technician", "required": false}]
    
    -- Versioning
    version VARCHAR(20) DEFAULT '1.0',
    is_current_version BOOLEAN DEFAULT true,
    parent_template_id UUID REFERENCES public.document_templates(id), -- For version history
    
    -- Usage and Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- If this is the default template for this type
    usage_count INTEGER DEFAULT 0, -- Track how often this template is used
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Categorization
    category VARCHAR(100), -- 'customer_facing', 'internal', 'legal', 'operational'
    tags TEXT[], -- Array of tags for easier filtering: ['hvac', 'warranty', 'service_agreement']
    
    -- Access Control
    created_by UUID REFERENCES auth.users(id),
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Scheduling and Automation
    auto_generate_for JSONB DEFAULT '{}'::jsonb, -- Conditions for auto-generation: {"job_status": ["completed"], "service_type": ["installation"]}
    send_automatically BOOLEAN DEFAULT false,
    delivery_method VARCHAR(50) DEFAULT 'manual', -- 'manual', 'email', 'sms', 'portal'
    
    -- Constraints
    CONSTRAINT valid_template_type CHECK (template_type IN ('contract', 'estimate', 'invoice', 'proposal', 'agreement', 'form', 'checklist', 'report', 'warranty', 'service_agreement', 'custom')),
    CONSTRAINT valid_category CHECK (category IN ('customer_facing', 'internal', 'legal', 'operational', 'marketing')),
    CONSTRAINT valid_delivery_method CHECK (delivery_method IN ('manual', 'email', 'sms', 'portal', 'print')),
    CONSTRAINT unique_default_per_type UNIQUE (tenant_id, template_type) DEFERRABLE INITIALLY DEFERRED -- Only one default per type per tenant
);

-- Remove the unique constraint temporarily to allow multiple templates per type
ALTER TABLE public.document_templates DROP CONSTRAINT IF EXISTS unique_default_per_type;

-- Add a partial unique index instead (only for default templates)
CREATE UNIQUE INDEX idx_document_templates_unique_default 
ON public.document_templates (tenant_id, template_type) 
WHERE is_default = true;

-- Add indexes for performance
CREATE INDEX idx_document_templates_tenant_id ON public.document_templates (tenant_id);
CREATE INDEX idx_document_templates_type ON public.document_templates (tenant_id, template_type);
CREATE INDEX idx_document_templates_active ON public.document_templates (tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_document_templates_category ON public.document_templates (tenant_id, category);
CREATE INDEX idx_document_templates_tags ON public.document_templates USING GIN (tags);
CREATE INDEX idx_document_templates_auto_fill ON public.document_templates USING GIN (auto_fill_fields);
CREATE INDEX idx_document_templates_current_version ON public.document_templates (tenant_id, template_type, is_current_version) WHERE is_current_version = true;

-- Enable Row Level Security
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view templates for their tenant
CREATE POLICY "Users can view their tenant's templates"
    ON public.document_templates FOR SELECT
    USING (
        tenant_id IN (
            SELECT user_profiles.tenant_id 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
        )
    );

-- Admins and agents can manage templates
CREATE POLICY "Users can manage their tenant's templates"
    ON public.document_templates FOR ALL
    USING (
        tenant_id IN (
            SELECT user_profiles.tenant_id 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'agent')
        )
    );

-- Service role can access all templates
CREATE POLICY "Service role can manage all templates"
    ON public.document_templates FOR ALL
    USING (auth.role() = 'service_role');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_document_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_templates_updated_at
    BEFORE UPDATE ON public.document_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_document_templates_updated_at();

-- Create function to update usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.document_templates 
    SET 
        usage_count = COALESCE(usage_count, 0) + 1,
        last_used_at = NOW()
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON TABLE public.document_templates TO authenticated;
GRANT ALL ON TABLE public.document_templates TO service_role;
GRANT EXECUTE ON FUNCTION increment_template_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_template_usage(UUID) TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.document_templates IS 'Stores document templates for contracts, estimates, invoices, and other business documents';
COMMENT ON COLUMN public.document_templates.auto_fill_fields IS 'JSON array of field names that can be automatically populated from job/customer data';
COMMENT ON COLUMN public.document_templates.required_signatures IS 'JSON array defining signature requirements for this template';
COMMENT ON COLUMN public.document_templates.auto_generate_for IS 'JSON object defining conditions when this template should be auto-generated';
COMMENT ON COLUMN public.document_templates.file_url IS 'URL to the template file stored in Supabase storage';
COMMENT ON FUNCTION increment_template_usage(UUID) IS 'Increments usage count and updates last_used_at for a template';