-- CRITICAL FIX: Missing Tables and Schema Issues
-- Run this immediately to fix lead conversion and site visits

-- 1. Fix leads table - add all missing fields
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS caller_type TEXT,
ADD COLUMN IF NOT EXISTS converted_contact_id UUID REFERENCES contacts(id),
ADD COLUMN IF NOT EXISTS converted_account_id UUID REFERENCES accounts(id),
ADD COLUMN IF NOT EXISTS service_location_address TEXT,
ADD COLUMN IF NOT EXISTS service_location_city TEXT,
ADD COLUMN IF NOT EXISTS service_location_state TEXT,
ADD COLUMN IF NOT EXISTS service_location_zip TEXT,
ADD COLUMN IF NOT EXISTS service_needed TEXT,
ADD COLUMN IF NOT EXISTS urgency_level TEXT,
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT,
ADD COLUMN IF NOT EXISTS best_time_to_contact TEXT,
ADD COLUMN IF NOT EXISTS budget_range TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS number_of_properties INTEGER,
ADD COLUMN IF NOT EXISTS service_frequency TEXT,
ADD COLUMN IF NOT EXISTS decision_timeline TEXT,
ADD COLUMN IF NOT EXISTS existing_vendor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS property_details TEXT,
ADD COLUMN IF NOT EXISTS service_history TEXT,
ADD COLUMN IF NOT EXISTS special_requirements TEXT,
ADD COLUMN IF NOT EXISTS lead_source TEXT,
ADD COLUMN IF NOT EXISTS heard_about_us TEXT,
ADD COLUMN IF NOT EXISTS call_recording_url TEXT;

-- 2. Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT false,
    location TEXT,
    event_type TEXT, -- 'site_visit', 'appointment', 'reminder', etc.
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
    
    -- Related entities
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    
    -- Assignment
    assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    
    -- Metadata
    color TEXT,
    reminder_minutes INTEGER,
    recurring_pattern JSONB,
    attendees JSONB,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add RLS policies for calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events in their tenant" ON calendar_events
    FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create events in their tenant" ON calendar_events
    FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their assigned events" ON calendar_events
    FOR UPDATE
    USING (
        tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND (assigned_to = auth.uid() OR created_by = auth.uid())
    );

CREATE POLICY "Users can delete their created events" ON calendar_events
    FOR DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND created_by = auth.uid()
    );

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_id ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to ON calendar_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead_id ON calendar_events(lead_id);

-- 5. Grant permissions
GRANT ALL ON calendar_events TO authenticated;
GRANT ALL ON calendar_events TO service_role;

-- 6. Fix field name mismatches in contacts table
-- Check if the fields exist with wrong names
DO $$
BEGIN
    -- If address_line1 exists but not address, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'address_line1')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'address') THEN
        ALTER TABLE contacts RENAME COLUMN address_line1 TO address;
    END IF;
    
    -- If zip_code exists but not zip, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'zip_code')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'zip') THEN
        ALTER TABLE contacts RENAME COLUMN zip_code TO zip;
    END IF;
END $$;

-- 7. Fix field name mismatches in accounts table
DO $$
BEGIN
    -- If type exists but not account_type, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'type')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'account_type') THEN
        ALTER TABLE accounts RENAME COLUMN type TO account_type;
    END IF;
    
    -- Add billing address fields if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'billing_address') THEN
        ALTER TABLE accounts 
        ADD COLUMN billing_address TEXT,
        ADD COLUMN billing_city TEXT,
        ADD COLUMN billing_state TEXT,
        ADD COLUMN billing_zip TEXT;
    END IF;
END $$;

-- 8. Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Critical schema fixes applied! Lead conversion and site visits should now work.' as status;