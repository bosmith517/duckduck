-- Marketing Platform & Multi-Tenant Database Schema
-- This extends the existing schema to support B2B service company signups and B2C homeowner accounts

-- Companies table for B2B customers (service companies)
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100) NOT NULL, -- 'HVAC', 'Plumbing', 'Electrical', etc.
  employee_count VARCHAR(50), -- '1-5 employees', '6-15 employees', etc.
  website VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  phone VARCHAR(20),
  
  -- Subscription & Billing
  subscription_plan VARCHAR(50) NOT NULL DEFAULT 'starter', -- 'starter', 'professional', 'enterprise'
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'cancelled', 'past_due'
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  subscription_starts_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  
  -- Owner & Admin
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Settings & Preferences
  settings JSONB DEFAULT '{}', -- Custom settings, integrations, etc.
  branding JSONB DEFAULT '{}', -- Logo, colors, white-label settings
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Search optimization
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(name, '') || ' ' || 
      coalesce(business_type, '') || ' ' || 
      coalesce(city, '') || ' ' || 
      coalesce(state, '')
    )
  ) STORED
);

-- Company users (employees/technicians for service companies)
CREATE TABLE IF NOT EXISTS company_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'technician', -- 'owner', 'admin', 'manager', 'technician', 'dispatcher'
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'invited', 'suspended'
  
  -- Permissions
  permissions JSONB DEFAULT '{}', -- Custom permissions for this user
  
  -- Work details
  employee_id VARCHAR(50), -- Company's internal employee ID
  department VARCHAR(100),
  hire_date DATE,
  
  -- Contact preferences
  notification_preferences JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(company_id, user_id)
);

-- Homeowner profiles for B2C users
CREATE TABLE IF NOT EXISTS homeowner_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  
  -- Home Address
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Home Details
  home_type VARCHAR(100), -- 'Single Family Home', 'Townhouse', 'Condo/Apartment', etc.
  home_age VARCHAR(50), -- 'Less than 5 years', '5-10 years', etc.
  square_footage INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  year_built INTEGER,
  
  -- Preferences & Settings
  preferred_service_radius INTEGER DEFAULT 25, -- Miles
  climate_zone VARCHAR(50), -- Auto-detected based on location
  notification_preferences JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  
  -- Marketing & Analytics
  lead_source VARCHAR(100), -- How they heard about us
  marketing_consent BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Service provider directory (for homeowners to find professionals)
CREATE TABLE IF NOT EXISTS service_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- Links to companies table if they're a TradeWorks customer
  
  -- Basic Information
  name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100) NOT NULL,
  description TEXT,
  website VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  
  -- Location & Service Area
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  service_radius INTEGER DEFAULT 25, -- Miles
  service_areas TEXT[], -- Array of cities/zip codes they serve
  
  -- Business Details
  license_number VARCHAR(100),
  insurance_verified BOOLEAN DEFAULT false,
  years_in_business INTEGER,
  employee_count VARCHAR(50),
  
  -- Reviews & Ratings
  average_rating DECIMAL(3,2) DEFAULT 0.00,
  total_reviews INTEGER DEFAULT 0,
  total_jobs_completed INTEGER DEFAULT 0,
  
  -- TradeWorks Integration
  is_tradeworks_customer BOOLEAN DEFAULT false,
  tradeworks_verified BOOLEAN DEFAULT false,
  accepts_online_bookings BOOLEAN DEFAULT false,
  
  -- Specialties & Services
  services TEXT[], -- Array of services they offer
  specialties TEXT[], -- Special certifications, equipment brands, etc.
  
  -- Availability & Pricing
  business_hours JSONB DEFAULT '{}', -- Operating hours by day
  emergency_services BOOLEAN DEFAULT false,
  pricing_model VARCHAR(50), -- 'hourly', 'flat_rate', 'quote_based'
  minimum_charge DECIMAL(10,2),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'suspended', 'pending_verification'
  verified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Search optimization
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(name, '') || ' ' || 
      coalesce(business_type, '') || ' ' || 
      coalesce(description, '') || ' ' ||
      coalesce(city, '') || ' ' || 
      coalesce(state, '') || ' ' ||
      array_to_string(coalesce(services, ARRAY[]::text[]), ' ') || ' ' ||
      array_to_string(coalesce(specialties, ARRAY[]::text[]), ' ')
    )
  ) STORED
);

-- Homeowner equipment (extends existing customer_equipment for homeowners)
-- This allows homeowners to track their equipment without being tied to a service company
ALTER TABLE customer_equipment ADD COLUMN IF NOT EXISTS homeowner_id UUID REFERENCES homeowner_profiles(id) ON DELETE CASCADE;
ALTER TABLE customer_equipment ADD COLUMN IF NOT EXISTS is_homeowner_owned BOOLEAN DEFAULT false;

-- Service requests from homeowners to providers
CREATE TABLE IF NOT EXISTS homeowner_service_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  homeowner_id UUID NOT NULL REFERENCES homeowner_profiles(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES service_providers(id) ON DELETE SET NULL,
  
  -- Request Details
  service_type VARCHAR(100) NOT NULL,
  equipment_id UUID REFERENCES customer_equipment(id) ON DELETE SET NULL,
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'emergency'
  
  -- Description & Location
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location_details TEXT, -- Specific location within the home
  
  -- Scheduling
  preferred_date_start DATE,
  preferred_date_end DATE,
  preferred_time_start TIME,
  preferred_time_end TIME,
  flexible_scheduling BOOLEAN DEFAULT true,
  
  -- Status & Communication
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'quoted', 'scheduled', 'in_progress', 'completed', 'cancelled'
  urgency_level INTEGER DEFAULT 3, -- 1-5 scale
  
  -- Pricing
  estimated_cost_min DECIMAL(10,2),
  estimated_cost_max DECIMAL(10,2),
  final_cost DECIMAL(10,2),
  
  -- Photos & Documentation
  photos TEXT[], -- Array of photo URLs
  documentation JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Reviews and ratings
CREATE TABLE IF NOT EXISTS service_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  homeowner_id UUID NOT NULL REFERENCES homeowner_profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  service_request_id UUID REFERENCES homeowner_service_requests(id) ON DELETE SET NULL,
  
  -- Review Content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  review_text TEXT,
  
  -- Review Categories
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  
  -- Verification
  verified_purchase BOOLEAN DEFAULT false,
  helpful_votes INTEGER DEFAULT 0,
  
  -- Response from provider
  provider_response TEXT,
  provider_response_date TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(homeowner_id, provider_id, service_request_id)
);

-- Marketing campaigns and lead tracking
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'email', 'social', 'ppc', 'organic', 'referral'
  
  -- Campaign Details
  description TEXT,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(10,2),
  target_audience JSONB DEFAULT '{}',
  
  -- Tracking Parameters
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_term VARCHAR(100),
  utm_content VARCHAR(100),
  
  -- Performance Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead tracking
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Lead Source
  source VARCHAR(100) NOT NULL, -- 'website', 'referral', 'social', 'advertising', etc.
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  
  -- Lead Type
  lead_type VARCHAR(50) NOT NULL, -- 'company_signup', 'homeowner_signup', 'demo_request', 'contact_form'
  
  -- Contact Information
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  company_name VARCHAR(255),
  
  -- Lead Details
  business_type VARCHAR(100),
  employee_count VARCHAR(50),
  pain_points TEXT[],
  budget_range VARCHAR(50),
  timeline VARCHAR(50),
  
  -- Status & Follow-up
  status VARCHAR(50) DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'demo_scheduled', 'proposal_sent', 'closed_won', 'closed_lost'
  score INTEGER DEFAULT 0, -- Lead scoring 0-100
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Conversion
  converted_to_customer BOOLEAN DEFAULT false,
  converted_at TIMESTAMP WITH TIME ZONE,
  customer_id UUID, -- Could reference companies(id) or homeowner_profiles(id)
  customer_type VARCHAR(20), -- 'company' or 'homeowner'
  
  -- Notes & Communication
  notes TEXT[],
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_follow_up_date TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_business_type ON companies(business_type);
CREATE INDEX IF NOT EXISTS idx_companies_search ON companies USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_homeowner_profiles_user_id ON homeowner_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_homeowner_profiles_location ON homeowner_profiles(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_service_providers_location ON service_providers(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_service_providers_business_type ON service_providers(business_type);
CREATE INDEX IF NOT EXISTS idx_service_providers_search ON service_providers USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_service_reviews_provider_id ON service_reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_rating ON service_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeowner_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Companies: Only company owners/admins can manage their company
CREATE POLICY "Companies can be viewed by their members" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can update their company" ON companies
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Company users: Can view their own company's users
CREATE POLICY "Company users can view their company members" ON company_users
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_users cu2 
      WHERE cu2.user_id = auth.uid()
    )
  );

-- Homeowner profiles: Users can only see their own profile
CREATE POLICY "Users can view their own homeowner profile" ON homeowner_profiles
  FOR ALL USING (user_id = auth.uid());

-- Service providers: Public read access, but only companies can manage their listing
CREATE POLICY "Service providers are publicly viewable" ON service_providers
  FOR SELECT USING (true);

CREATE POLICY "Companies can manage their service provider listing" ON service_providers
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Service requests: Homeowners can manage their own requests
CREATE POLICY "Homeowners can manage their service requests" ON homeowner_service_requests
  FOR ALL USING (
    homeowner_id IN (
      SELECT id FROM homeowner_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Reviews: Homeowners can manage their own reviews, providers can view reviews about them
CREATE POLICY "Homeowners can manage their reviews" ON service_reviews
  FOR ALL USING (
    homeowner_id IN (
      SELECT id FROM homeowner_profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Providers can view reviews about them" ON service_reviews
  FOR SELECT USING (
    provider_id IN (
      SELECT id FROM service_providers sp
      JOIN companies c ON sp.company_id = c.id
      JOIN company_users cu ON c.id = cu.company_id
      WHERE cu.user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON homeowner_profiles TO authenticated;
GRANT SELECT ON service_providers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON service_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON homeowner_service_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_reviews TO authenticated;
GRANT SELECT, INSERT ON marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON leads TO authenticated;