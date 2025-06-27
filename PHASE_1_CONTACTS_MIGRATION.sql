-- PHASE 1: Enhanced Contacts Table for AI-Ready Customer Management
-- This migration adds essential fields to support both current operations and future AI integration

-- Add new columns to contacts table
ALTER TABLE contacts 
-- Name fields (splitting existing name)
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS company VARCHAR(255),
ADD COLUMN IF NOT EXISTS job_title VARCHAR(255),

-- Communication preferences
ADD COLUMN IF NOT EXISTS preferred_contact_method VARCHAR(50) DEFAULT 'phone' CHECK (preferred_contact_method IN ('phone', 'sms', 'email', 'any')),
ADD COLUMN IF NOT EXISTS preferred_contact_time VARCHAR(100), -- "mornings", "after 5pm", "weekends", etc.
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'en',

-- Address information
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(50),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'US',
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),

-- AI-relevant fields
ADD COLUMN IF NOT EXISTS communication_notes TEXT, -- "Hard of hearing", "Prefers texts", "Spanish speaker", etc.
ADD COLUMN IF NOT EXISTS ai_interaction_preferences JSONB DEFAULT '{"allow_ai_scheduling": true, "requires_human_confirmation": false}'::jsonb,
ADD COLUMN IF NOT EXISTS customer_lifetime_value NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100), -- "referral", "google", "facebook", "word_of_mouth", etc.
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array of tags for categorization

-- Relationship tracking
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES contacts(id),
ADD COLUMN IF NOT EXISTS is_decision_maker BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_followup_date DATE,

-- Metadata
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create an index on tags for faster searching
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);

-- Create an index on lead_source for analytics
CREATE INDEX IF NOT EXISTS idx_contacts_lead_source ON contacts(lead_source);

-- Create an index on next_followup_date for scheduling
CREATE INDEX IF NOT EXISTS idx_contacts_next_followup ON contacts(next_followup_date) WHERE next_followup_date IS NOT NULL;

-- Split existing name into first_name and last_name
UPDATE contacts
SET 
    first_name = CASE 
        WHEN name IS NULL THEN NULL
        WHEN TRIM(name) = '' THEN NULL
        WHEN POSITION(' ' IN TRIM(name)) = 0 THEN TRIM(name)
        ELSE TRIM(SUBSTRING(name FROM 1 FOR POSITION(' ' IN TRIM(name)) - 1))
    END,
    last_name = CASE 
        WHEN name IS NULL THEN NULL
        WHEN TRIM(name) = '' THEN NULL
        WHEN POSITION(' ' IN TRIM(name)) = 0 THEN NULL
        ELSE TRIM(SUBSTRING(name FROM POSITION(' ' IN TRIM(name)) + 1))
    END
WHERE (first_name IS NULL OR last_name IS NULL) AND name IS NOT NULL;

-- Handle special cases where name might have middle names or suffixes
-- For example: "John Jacob Smith Jr." becomes first_name: "John", last_name: "Jacob Smith Jr."
-- You can manually adjust these later if needed

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contacts_updated_at_trigger ON contacts;
CREATE TRIGGER update_contacts_updated_at_trigger
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_contacts_updated_at();

-- Add some helpful views for the AI system to use later
CREATE OR REPLACE VIEW contacts_with_preferences AS
SELECT 
    c.*,
    COALESCE(c.first_name || ' ' || c.last_name, c.name) as full_name,
    CASE 
        WHEN c.preferred_contact_time IS NOT NULL THEN c.preferred_contact_time
        ELSE 'business_hours'
    END as contact_time_preference,
    COALESCE((c.ai_interaction_preferences->>'allow_ai_scheduling')::boolean, true) as allows_ai_scheduling
FROM contacts c;

-- Grant appropriate permissions
GRANT SELECT ON contacts_with_preferences TO authenticated;

-- Add helpful comments for documentation
COMMENT ON COLUMN contacts.ai_interaction_preferences IS 'JSON object storing AI interaction preferences like allow_ai_scheduling, requires_human_confirmation, etc.';
COMMENT ON COLUMN contacts.communication_notes IS 'Free text field for special communication requirements or preferences';
COMMENT ON COLUMN contacts.tags IS 'Array of tags for categorization, e.g. {"vip", "commercial", "residential", "repeat_customer"}';
COMMENT ON COLUMN contacts.customer_lifetime_value IS 'Total revenue generated by this contact across all jobs/invoices';

-- Verify the migration
SELECT 
    COUNT(*) as total_contacts,
    COUNT(first_name) as contacts_with_first_name,
    COUNT(last_name) as contacts_with_last_name,
    COUNT(DISTINCT lead_source) as unique_lead_sources
FROM contacts;

-- Show sample of migrated data
SELECT 
    id,
    name as original_name,
    first_name,
    last_name,
    email,
    phone,
    preferred_contact_method,
    tags
FROM contacts
ORDER BY created_at DESC
LIMIT 5;