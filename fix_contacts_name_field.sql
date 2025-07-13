-- Fix contacts that have null name field by generating it from first_name and last_name
UPDATE contacts 
SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE name IS NULL 
  AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- For contacts with no name, first_name, or last_name, set a default
UPDATE contacts 
SET name = 'Unnamed Contact'
WHERE name IS NULL 
  AND first_name IS NULL 
  AND last_name IS NULL;

-- Make sure name field is populated going forward by adding a check constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_name_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_name_check 
  CHECK (name IS NOT NULL AND name != '');

-- Add a trigger to automatically populate name from first_name and last_name if not provided
CREATE OR REPLACE FUNCTION populate_contact_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If name is not provided but first_name or last_name are, generate name
  IF (NEW.name IS NULL OR NEW.name = '') AND (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
    NEW.name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  END IF;
  
  -- If still no name, use a default
  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := 'Unnamed Contact';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for inserts and updates
DROP TRIGGER IF EXISTS ensure_contact_name ON contacts;
CREATE TRIGGER ensure_contact_name
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION populate_contact_name();

-- Report on the changes
SELECT 
  COUNT(*) FILTER (WHERE name IS NULL) as null_names_before,
  COUNT(*) as total_contacts
FROM contacts;