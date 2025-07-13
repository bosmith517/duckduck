-- Fix contacts name field to ensure it's always populated
-- This migration will:
-- 1. Update existing contacts to have a name field if it's null
-- 2. Add a constraint to ensure name is never null
-- 3. Create a trigger to automatically populate name from first/last name

-- Step 1: Update existing contacts where name is null
UPDATE contacts
SET name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE name IS NULL OR name = '';

-- Step 2: Update any remaining null names to use email or 'Unknown Contact'
UPDATE contacts
SET name = COALESCE(email, 'Unknown Contact')
WHERE name IS NULL OR name = '' OR TRIM(name) = '';

-- Step 3: Add a check constraint to ensure name is never null or empty
ALTER TABLE contacts
ADD CONSTRAINT contacts_name_not_empty CHECK (name IS NOT NULL AND TRIM(name) != '');

-- Step 4: Create a function to automatically populate name from first/last name
CREATE OR REPLACE FUNCTION populate_contact_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If name is not provided or is empty, generate it from first_name and last_name
  IF NEW.name IS NULL OR TRIM(NEW.name) = '' THEN
    -- Try to construct from first and last name
    IF NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL THEN
      NEW.name := TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
    -- If no first/last name, use email
    ELSIF NEW.email IS NOT NULL THEN
      NEW.name := NEW.email;
    -- Last resort
    ELSE
      NEW.name := 'Unknown Contact';
    END IF;
  END IF;
  
  -- Ensure name is never just whitespace
  NEW.name := TRIM(NEW.name);
  IF NEW.name = '' THEN
    NEW.name := 'Unknown Contact';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger for insert operations
CREATE TRIGGER ensure_contact_name_on_insert
BEFORE INSERT ON contacts
FOR EACH ROW
EXECUTE FUNCTION populate_contact_name();

-- Step 6: Create trigger for update operations
CREATE TRIGGER ensure_contact_name_on_update
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION populate_contact_name();

-- Step 7: Add comment to document the purpose
COMMENT ON COLUMN contacts.name IS 'Display name for the contact. Automatically populated from first_name + last_name if not provided.';