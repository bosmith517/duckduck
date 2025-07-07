-- Create public showcase system for two-tier portal
-- This migration extends the existing portal system to support public project showcases

-- Create project showcase table for public portal
CREATE TABLE IF NOT EXISTS project_showcase (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    
    -- Basic showcase information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    
    -- Media content
    before_photos JSONB DEFAULT '[]',
    after_photos JSONB DEFAULT '[]',
    progress_photos JSONB DEFAULT '[]',
    video_url TEXT,
    
    -- Customer testimonial
    testimonial TEXT,
    testimonial_video_url TEXT,
    customer_name VARCHAR(255),
    customer_title VARCHAR(255),
    display_customer_info BOOLEAN DEFAULT false,
    
    -- Project details
    display_budget BOOLEAN DEFAULT false,
    budget_range VARCHAR(50), -- e.g., "$5,000-$10,000"
    actual_cost DECIMAL(10,2),
    duration_days INTEGER,
    completion_date DATE,
    
    -- Team and materials
    team_members JSONB DEFAULT '[]', -- Array of {name, role, photo}
    materials_used JSONB DEFAULT '[]', -- Array of {name, brand, quantity}
    challenges_overcome TEXT,
    
    -- Display settings
    featured BOOLEAN DEFAULT false,
    featured_order INTEGER,
    publish_status VARCHAR(20) DEFAULT 'draft' CHECK (publish_status IN ('draft', 'pending', 'published', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE,
    published_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    inquiry_count INTEGER DEFAULT 0,
    
    -- SEO and metadata
    seo_metadata JSONB DEFAULT '{}', -- {meta_title, meta_description, og_image}
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for showcase
CREATE INDEX idx_showcase_tenant_id ON project_showcase(tenant_id);
CREATE INDEX idx_showcase_publish_status ON project_showcase(publish_status);
CREATE INDEX idx_showcase_featured ON project_showcase(featured) WHERE featured = true;
CREATE INDEX idx_showcase_category ON project_showcase(category);
CREATE INDEX idx_showcase_tags ON project_showcase USING GIN(tags);
CREATE INDEX idx_showcase_published_at ON project_showcase(published_at DESC) WHERE publish_status = 'published';

-- Create showcase inquiries table
CREATE TABLE IF NOT EXISTS showcase_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    showcase_id UUID NOT NULL REFERENCES project_showcase(id) ON DELETE CASCADE,
    
    -- Lead information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    message TEXT,
    
    -- Interest details
    service_interested_in VARCHAR(255),
    preferred_contact_method VARCHAR(50),
    referral_source VARCHAR(100), -- 'showcase', 'referral', 'search', etc.
    referring_customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Conversion tracking
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'archived')),
    contacted_at TIMESTAMP WITH TIME ZONE,
    contacted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    conversion_value DECIMAL(10,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for inquiries
CREATE INDEX idx_inquiries_showcase_id ON showcase_inquiries(showcase_id);
CREATE INDEX idx_inquiries_status ON showcase_inquiries(status);
CREATE INDEX idx_inquiries_created_at ON showcase_inquiries(created_at DESC);

-- Extend existing portal tokens for public access
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS portal_type VARCHAR(20) DEFAULT 'private' CHECK (portal_type IN ('public', 'private'));
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS showcase_id UUID REFERENCES project_showcase(id) ON DELETE CASCADE;
ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Create view for public showcase data (excludes sensitive info)
CREATE OR REPLACE VIEW v_public_showcase AS
SELECT 
    ps.id,
    ps.tenant_id,
    ps.title,
    ps.description,
    ps.category,
    ps.subcategory,
    ps.before_photos,
    ps.after_photos,
    ps.video_url,
    ps.testimonial,
    ps.testimonial_video_url,
    CASE WHEN ps.display_customer_info THEN ps.customer_name ELSE NULL END as customer_name,
    CASE WHEN ps.display_customer_info THEN ps.customer_title ELSE NULL END as customer_title,
    CASE WHEN ps.display_budget THEN ps.budget_range ELSE NULL END as budget_range,
    ps.duration_days,
    ps.completion_date,
    ps.team_members,
    ps.materials_used,
    ps.challenges_overcome,
    ps.tags,
    ps.view_count,
    ps.created_at,
    t.company_name as contractor_name,
    tb.logo_url as contractor_logo
FROM project_showcase ps
JOIN tenants t ON ps.tenant_id = t.id
LEFT JOIN tenant_branding tb ON t.id = tb.tenant_id
WHERE ps.publish_status = 'published';

-- Create RLS policies
ALTER TABLE project_showcase ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_inquiries ENABLE ROW LEVEL SECURITY;

-- Showcase policies
CREATE POLICY "Showcase tenant isolation" ON project_showcase
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY "Public showcase viewing" ON project_showcase
    FOR SELECT USING (publish_status = 'published');

-- Inquiry policies
CREATE POLICY "Inquiries tenant isolation" ON showcase_inquiries
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create function to track showcase views
CREATE OR REPLACE FUNCTION increment_showcase_view_count(p_showcase_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE project_showcase
    SET view_count = view_count + 1
    WHERE id = p_showcase_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to track showcase shares
CREATE OR REPLACE FUNCTION increment_showcase_share_count(p_showcase_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE project_showcase
    SET share_count = share_count + 1
    WHERE id = p_showcase_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update showcase inquiry count
CREATE OR REPLACE FUNCTION update_showcase_inquiry_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE project_showcase
    SET inquiry_count = (
        SELECT COUNT(*) 
        FROM showcase_inquiries 
        WHERE showcase_id = NEW.showcase_id
    )
    WHERE id = NEW.showcase_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_showcase_inquiry_count
    AFTER INSERT ON showcase_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_showcase_inquiry_count();

-- Add comments
COMMENT ON TABLE project_showcase IS 'Public showcase entries for completed projects with customer permission';
COMMENT ON TABLE showcase_inquiries IS 'Leads generated from public showcase views';
COMMENT ON COLUMN project_showcase.budget_range IS 'Displayed budget range like $5,000-$10,000 when display_budget is true';
COMMENT ON COLUMN project_showcase.seo_metadata IS 'SEO fields like meta_title, meta_description, og_image for better search visibility';