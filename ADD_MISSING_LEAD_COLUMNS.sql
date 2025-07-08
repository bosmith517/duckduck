-- ADD ANY MISSING COLUMNS TO LEADS TABLE
-- The frontend expects these columns

-- Add name column if it doesn't exist
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Add any other potentially missing columns
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update any existing leads without names to use email or phone as name
UPDATE leads 
SET name = COALESCE(email, phone, 'Unnamed Lead')
WHERE name IS NULL;

-- Create an update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at 
BEFORE UPDATE ON leads 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

SELECT 'Added missing columns to leads table' as status;