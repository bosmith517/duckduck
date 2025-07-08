-- SHOW CURRENT LEADS TABLE STRUCTURE
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'leads'
ORDER BY ordinal_position;

-- FIX THE LEADS TABLE PROPERLY
-- Only add columns that don't exist

-- First check and add name column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'name') THEN
        ALTER TABLE leads ADD COLUMN name TEXT;
    END IF;
END $$;

-- Update leads without names - check what columns actually exist
UPDATE leads 
SET name = COALESCE(
    email, 
    CASE WHEN phone_number IS NOT NULL THEN phone_number ELSE 'Unnamed Lead' END
)
WHERE name IS NULL 
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone_number');

-- If phone_number doesn't exist, just use email
UPDATE leads 
SET name = COALESCE(email, 'Unnamed Lead')
WHERE name IS NULL 
AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone_number');

SELECT 'Leads table fixed!' as status;