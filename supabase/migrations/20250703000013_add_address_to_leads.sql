-- Add address fields to leads table for when customers call in
-- This is essential for scheduling site visits and creating accurate estimates

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS street_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS full_address TEXT GENERATED ALWAYS AS (
    CASE 
        WHEN street_address IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL AND zip_code IS NOT NULL 
        THEN street_address || ', ' || city || ', ' || state || ' ' || zip_code
        WHEN street_address IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL 
        THEN street_address || ', ' || city || ', ' || state
        WHEN street_address IS NOT NULL 
        THEN street_address
        ELSE NULL
    END
) STORED,
ADD COLUMN IF NOT EXISTS property_type TEXT CHECK (property_type IN ('residential', 'commercial', 'industrial', 'other')),
ADD COLUMN IF NOT EXISTS property_size TEXT,
ADD COLUMN IF NOT EXISTS lot_size TEXT,
ADD COLUMN IF NOT EXISTS year_built INTEGER,
ADD COLUMN IF NOT EXISTS additional_property_info JSONB DEFAULT '{}'::jsonb;

-- Add indexes for address searching
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);
CREATE INDEX IF NOT EXISTS idx_leads_zip_code ON leads(zip_code);
CREATE INDEX IF NOT EXISTS idx_leads_full_address ON leads USING gin(to_tsvector('english', full_address));

-- Add comment to explain the fields
COMMENT ON COLUMN leads.street_address IS 'Property street address for the lead';
COMMENT ON COLUMN leads.full_address IS 'Auto-generated full address for easy searching and display';
COMMENT ON COLUMN leads.property_type IS 'Type of property (residential, commercial, etc.)';
COMMENT ON COLUMN leads.additional_property_info IS 'JSON field for flexible property details like bedrooms, bathrooms, special features, etc.';