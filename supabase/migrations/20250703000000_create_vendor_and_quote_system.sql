-- Create vendor management and quote request system

-- Vendors table for managing supplier relationships
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  website TEXT,
  trade_specialties TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['electrical', 'plumbing', 'hvac', 'general']
  preferred_vendor BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  payment_terms TEXT, -- 'net_30', 'net_15', 'cod', etc.
  tax_id TEXT,
  license_number TEXT,
  insurance_expiry DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quote requests table for sending RFQs to vendors
CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  trade_category TEXT, -- 'electrical', 'plumbing', 'hvac', 'general'
  requested_delivery_date DATE,
  site_address TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'responses_received', 'awarded', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  response_deadline TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES user_profiles(id),
  awarded_to UUID REFERENCES vendors(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quote request items - specific materials/services being requested
CREATE TABLE IF NOT EXISTS quote_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'each', -- 'each', 'linear_ft', 'sq_ft', 'hours', etc.
  specifications TEXT,
  brand_preference TEXT,
  model_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor quotes - responses from vendors
CREATE TABLE IF NOT EXISTS vendor_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  quote_number TEXT,
  total_amount DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  delivery_fee DECIMAL(10,2),
  quoted_delivery_date DATE,
  validity_period INTEGER DEFAULT 30, -- days
  payment_terms TEXT,
  warranty_terms TEXT,
  notes TEXT,
  attachments JSONB DEFAULT '[]'::JSONB, -- file URLs and metadata
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor quote items - line items for each quote
CREATE TABLE IF NOT EXISTS vendor_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_quote_id UUID NOT NULL REFERENCES vendor_quotes(id) ON DELETE CASCADE,
  quote_request_item_id UUID NOT NULL REFERENCES quote_request_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  brand TEXT,
  model_number TEXT,
  specifications TEXT,
  lead_time_days INTEGER,
  availability_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subcontractor companies table for free tier accounts
CREATE TABLE IF NOT EXISTS subcontractor_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, -- The main contractor who invited them
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  trade_specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
  license_number TEXT,
  insurance_expiry DATE,
  hourly_rates JSONB DEFAULT '{}'::JSONB, -- {"electrician": 55, "helper": 25}
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
  signup_token TEXT UNIQUE, -- For invitation-based signup
  signup_completed BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  signup_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subcontractor users table (linked to auth.users)
CREATE TABLE IF NOT EXISTS subcontractor_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subcontractor_company_id UUID NOT NULL REFERENCES subcontractor_companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'worker' CHECK (role IN ('owner', 'manager', 'worker')),
  trade_specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
  hourly_rate DECIMAL(8,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, subcontractor_company_id)
);

-- Job assignments for subcontractors
CREATE TABLE IF NOT EXISTS subcontractor_job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  subcontractor_company_id UUID NOT NULL REFERENCES subcontractor_companies(id) ON DELETE CASCADE,
  assigned_user_id UUID REFERENCES subcontractor_users(id),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('company', 'individual')),
  trade TEXT,
  hourly_rate DECIMAL(8,2),
  estimated_hours INTEGER,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled')),
  invitation_message TEXT,
  response_message TEXT,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_trade_specialties ON vendors USING GIN(trade_specialties);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_quote_requests_tenant_id ON quote_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_id ON quote_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);

CREATE INDEX IF NOT EXISTS idx_vendor_quotes_quote_request_id ON vendor_quotes(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_vendor_id ON vendor_quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_status ON vendor_quotes(status);

CREATE INDEX IF NOT EXISTS idx_subcontractor_companies_parent_tenant ON subcontractor_companies(parent_tenant_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_companies_signup_token ON subcontractor_companies(signup_token) WHERE signup_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subcontractor_users_company_id ON subcontractor_users(subcontractor_company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_users_user_id ON subcontractor_users(user_id);

CREATE INDEX IF NOT EXISTS idx_subcontractor_job_assignments_job_id ON subcontractor_job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_job_assignments_company_id ON subcontractor_job_assignments(subcontractor_company_id);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_job_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendors
CREATE POLICY "Users can view vendors in their tenant" ON vendors
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage vendors in their tenant" ON vendors
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for quote requests
CREATE POLICY "Users can view quote requests in their tenant" ON quote_requests
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage quote requests in their tenant" ON quote_requests
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for quote request items
CREATE POLICY "Users can view quote request items for their tenant" ON quote_request_items
  FOR SELECT USING (
    quote_request_id IN (
      SELECT id FROM quote_requests 
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage quote request items for their tenant" ON quote_request_items
  FOR ALL USING (
    quote_request_id IN (
      SELECT id FROM quote_requests 
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for vendor quotes (vendors can see their own quotes, main tenants can see all)
CREATE POLICY "Vendors can view their own quotes" ON vendor_quotes
  FOR SELECT USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE email = auth.email()
    )
    OR
    quote_request_id IN (
      SELECT id FROM quote_requests 
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Vendors can submit quotes" ON vendor_quotes
  FOR INSERT WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE email = auth.email()
    )
  );

CREATE POLICY "Main tenants can manage all quotes" ON vendor_quotes
  FOR ALL USING (
    quote_request_id IN (
      SELECT id FROM quote_requests 
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for vendor quote items
CREATE POLICY "Users can view vendor quote items" ON vendor_quote_items
  FOR SELECT USING (
    vendor_quote_id IN (
      SELECT id FROM vendor_quotes 
      WHERE vendor_id IN (
        SELECT id FROM vendors WHERE email = auth.email()
      )
      OR quote_request_id IN (
        SELECT id FROM quote_requests 
        WHERE tenant_id IN (
          SELECT tenant_id FROM user_profiles 
          WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Vendors can manage their quote items" ON vendor_quote_items
  FOR ALL USING (
    vendor_quote_id IN (
      SELECT id FROM vendor_quotes 
      WHERE vendor_id IN (
        SELECT id FROM vendors WHERE email = auth.email()
      )
      OR quote_request_id IN (
        SELECT id FROM quote_requests 
        WHERE tenant_id IN (
          SELECT tenant_id FROM user_profiles 
          WHERE id = auth.uid()
        )
      )
    )
  );

-- RLS Policies for subcontractor companies
CREATE POLICY "Main tenants can view their subcontractor companies" ON subcontractor_companies
  FOR SELECT USING (
    parent_tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
    OR
    id IN (
      SELECT subcontractor_company_id FROM subcontractor_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Main tenants can manage their subcontractor companies" ON subcontractor_companies
  FOR ALL USING (
    parent_tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for subcontractor users
CREATE POLICY "Users can view subcontractor users" ON subcontractor_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    subcontractor_company_id IN (
      SELECT id FROM subcontractor_companies 
      WHERE parent_tenant_id IN (
        SELECT tenant_id FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their own subcontractor profile" ON subcontractor_users
  FOR ALL USING (
    user_id = auth.uid()
    OR
    subcontractor_company_id IN (
      SELECT id FROM subcontractor_companies 
      WHERE parent_tenant_id IN (
        SELECT tenant_id FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for subcontractor job assignments
CREATE POLICY "Users can view subcontractor job assignments" ON subcontractor_job_assignments
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM jobs 
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
    OR
    subcontractor_company_id IN (
      SELECT subcontractor_company_id FROM subcontractor_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Main tenants can manage job assignments" ON subcontractor_job_assignments
  FOR ALL USING (
    job_id IN (
      SELECT id FROM jobs 
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles 
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Subcontractors can update their assignment status" ON subcontractor_job_assignments
  FOR UPDATE USING (
    subcontractor_company_id IN (
      SELECT subcontractor_company_id FROM subcontractor_users 
      WHERE user_id = auth.uid()
    )
  );

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_requests_updated_at BEFORE UPDATE ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_quotes_updated_at BEFORE UPDATE ON vendor_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcontractor_companies_updated_at BEFORE UPDATE ON subcontractor_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcontractor_users_updated_at BEFORE UPDATE ON subcontractor_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcontractor_job_assignments_updated_at BEFORE UPDATE ON subcontractor_job_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();