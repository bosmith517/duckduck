-- Ensure estimates always have proper client relationships
-- This trigger will populate account_id/contact_id from lead if they're missing

-- Create a function to ensure estimate has client references
CREATE OR REPLACE FUNCTION ensure_estimate_client_references()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_record RECORD;
BEGIN
    -- If the estimate has a lead_id but no account/contact, populate them
    IF NEW.lead_id IS NOT NULL THEN
        -- Get the lead record with its relationships
        SELECT 
            l.*,
            a.id as account_id_check,
            c.id as contact_id_check
        INTO v_lead_record 
        FROM leads l
        LEFT JOIN accounts a ON l.account_id = a.id
        LEFT JOIN contacts c ON l.contact_id = c.id
        WHERE l.id = NEW.lead_id;
        
        IF v_lead_record IS NULL THEN
            RAISE EXCEPTION 'Lead % not found', NEW.lead_id;
        END IF;
        
        -- If estimate doesn't have account/contact but lead does, use lead's relationships
        IF NEW.account_id IS NULL AND NEW.contact_id IS NULL THEN
            IF v_lead_record.account_id IS NOT NULL OR v_lead_record.contact_id IS NOT NULL THEN
                NEW.account_id = v_lead_record.account_id;
                NEW.contact_id = v_lead_record.contact_id;
                
                -- Add a note about the source
                IF NEW.notes IS NULL OR NEW.notes = '' THEN
                    NEW.notes = 'Created from lead: ' || COALESCE(v_lead_record.name, v_lead_record.caller_name, 'Unknown');
                END IF;
            ELSE
                -- Lead doesn't have relationships either - this is the problem!
                RAISE EXCEPTION 'Cannot create estimate: Lead % does not have customer relationships (account_id or contact_id)', NEW.lead_id;
            END IF;
        END IF;
    END IF;
    
    -- Final validation - ensure we have at least one client reference
    IF NEW.account_id IS NULL AND NEW.contact_id IS NULL AND NEW.lead_id IS NULL THEN
        RAISE EXCEPTION 'Estimate must have at least one client reference (account, contact, or lead with relationships)';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS ensure_estimate_client_references_trigger ON estimates;

-- Create the trigger
CREATE TRIGGER ensure_estimate_client_references_trigger
BEFORE INSERT OR UPDATE ON estimates
FOR EACH ROW
EXECUTE FUNCTION ensure_estimate_client_references();

-- Add comment to document the trigger
COMMENT ON FUNCTION ensure_estimate_client_references() IS 
'Ensures estimates always have proper client references by validating that leads have relationships';

-- Log current state
DO $$
DECLARE
    lead_count INTEGER;
    lead_with_relationships INTEGER;
BEGIN
    SELECT COUNT(*) INTO lead_count FROM leads;
    
    SELECT COUNT(*) INTO lead_with_relationships 
    FROM leads 
    WHERE account_id IS NOT NULL OR contact_id IS NOT NULL;
    
    RAISE NOTICE 'Total leads: %, Leads with relationships: %', lead_count, lead_with_relationships;
    
    IF lead_count > lead_with_relationships THEN
        RAISE NOTICE 'WARNING: % leads do not have customer relationships!', lead_count - lead_with_relationships;
    END IF;
END $$;