-- Create dummy customer data with real address and comprehensive information
-- Run this after the Phase 1 contacts migration

-- First, update the existing contact with comprehensive dummy data
UPDATE contacts 
SET 
    first_name = 'Sarah',
    last_name = 'Johnson',
    name = 'Sarah Johnson',
    email = 'sarah.johnson@email.com',
    phone = '(555) 123-4567',
    company = 'Johnson Family Trust',
    job_title = 'Homeowner',
    
    -- Real address in Austin, TX for testing
    address_line1 = '2101 S Lamar Blvd',
    address_line2 = 'Unit 205',
    city = 'Austin',
    state = 'TX',
    zip_code = '78704',
    country = 'US',
    latitude = 30.2500,
    longitude = -97.7667,
    
    -- Communication preferences
    preferred_contact_method = 'phone',
    preferred_contact_time = 'weekday mornings',
    timezone = 'America/Chicago',
    language_preference = 'en',
    
    -- AI-relevant fields
    communication_notes = 'Prefers advance notice for appointments. Has a friendly golden retriever named Max.',
    ai_interaction_preferences = '{"allow_ai_scheduling": true, "requires_human_confirmation": false, "preferred_appointment_window": "9am-2pm"}',
    customer_lifetime_value = 3850.00,
    lead_source = 'google_search',
    tags = ARRAY['residential', 'hvac_customer', 'repeat_customer', 'high_value', 'pet_owner'],
    
    -- Relationship tracking
    is_decision_maker = true,
    birthday = '1985-03-15',
    last_contacted_at = NOW() - INTERVAL '2 days',
    next_followup_date = CURRENT_DATE + INTERVAL '6 months',
    
    updated_at = NOW()
WHERE id = 'c9882d63-65d4-4b5c-9a51-c26f5b18649b';

-- First create an account for our customer if it doesn't exist
INSERT INTO accounts (
    id,
    tenant_id,
    name,
    address_line1,
    city,
    state,
    zip_code,
    phone,
    email,
    type,
    industry,
    account_status
) VALUES (
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'Johnson Family Trust',
    '2101 S Lamar Blvd, Unit 205',
    'Austin',
    'TX',
    '78704',
    '(555) 123-4567',
    'sarah.johnson@email.com',
    'residential',
    'homeowner',
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Update the contact to link to the account
UPDATE contacts 
SET account_id = 'a1b2c3d4-e5f6-7890-1234-567890abcdef'
WHERE id = 'c9882d63-65d4-4b5c-9a51-c26f5b18649b';

-- Clear any existing jobs for this contact to start fresh
DELETE FROM job_status_updates WHERE job_id IN (
    SELECT id FROM jobs WHERE contact_id = 'c9882d63-65d4-4b5c-9a51-c26f5b18649b'
);
DELETE FROM jobs WHERE contact_id = 'c9882d63-65d4-4b5c-9a51-c26f5b18649b';

-- Create some realistic job history
INSERT INTO jobs (
    id,
    tenant_id,
    account_id,
    contact_id,
    title,
    description,
    status,
    start_date,
    estimated_hours,
    estimated_cost,
    actual_cost,
    priority,
    location_address,
    location_city,
    location_state,
    location_zip,
    notes,
    created_at
) VALUES 
-- Current upcoming job
(
    gen_random_uuid(),
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    'c9882d63-65d4-4b5c-9a51-c26f5b18649b',
    'Annual HVAC Maintenance',
    'Comprehensive inspection and maintenance of central air conditioning and heating system. Includes filter replacement, coil cleaning, and system diagnostics.',
    'Scheduled',
    CURRENT_DATE + INTERVAL '3 days' + TIME '10:00:00',
    3.0,
    295.00,
    null,
    'medium',
    '2101 S Lamar Blvd, Unit 205',
    'Austin',
    'TX',
    '78704',
    'Customer mentioned some unusual noises from the unit. Check belt tension and fan motor.',
    NOW() - INTERVAL '5 days'
),

-- Completed job from 3 months ago
(
    gen_random_uuid(),
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    'c9882d63-65d4-4b5c-9a51-c26f5b18649b',
    'Emergency AC Repair',
    'AC unit stopped cooling. Diagnosed faulty capacitor and replaced. Also cleaned evaporator coils and checked refrigerant levels.',
    'Completed',
    CURRENT_DATE - INTERVAL '3 months' + TIME '14:30:00',
    2.5,
    385.00,
    385.00,
    'high',
    '2101 S Lamar Blvd, Unit 205',
    'Austin',
    'TX',
    '78704',
    'Emergency call - customer very satisfied with quick response time.',
    NOW() - INTERVAL '3 months'
),

-- Completed job from 8 months ago
(
    gen_random_uuid(),
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    'c9882d63-65d4-4b5c-9a51-c26f5b18649b',
    'Furnace Tune-Up',
    'Pre-winter furnace inspection and tune-up. Replaced air filter, cleaned heat exchanger, and tested safety controls.',
    'Completed',
    CURRENT_DATE - INTERVAL '8 months' + TIME '09:00:00',
    2.0,
    185.00,
    185.00,
    'medium',
    '2101 S Lamar Blvd, Unit 205',
    'Austin',
    'TX',
    '78704',
    'All systems operating efficiently. Recommended annual service plan.',
    NOW() - INTERVAL '8 months'
),

-- Completed job from 1 year ago
(
    gen_random_uuid(),
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    'c9882d63-65d4-4b5c-9a51-c26f5b18649b',
    'Ductwork Inspection & Sealing',
    'Comprehensive ductwork inspection revealed several leaks. Sealed ducts and improved system efficiency by 15%.',
    'Completed',
    CURRENT_DATE - INTERVAL '12 months' + TIME '11:00:00',
    4.5,
    575.00,
    575.00,
    'medium',
    '2101 S Lamar Blvd, Unit 205',
    'Austin',
    'TX',
    '78704',
    'Significant energy savings achieved. Customer enrolled in annual maintenance plan.',
    NOW() - INTERVAL '12 months'
),

-- Completed job from 1.5 years ago (initial service)
(
    gen_random_uuid(),
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    'c9882d63-65d4-4b5c-9a51-c26f5b18649b',
    'New Customer System Evaluation',
    'Complete HVAC system evaluation for new customer. System in good condition but recommended regular maintenance.',
    'Completed',
    CURRENT_DATE - INTERVAL '18 months' + TIME '13:00:00',
    1.5,
    125.00,
    125.00,
    'low',
    '2101 S Lamar Blvd, Unit 205',
    'Austin',
    'TX',
    '78704',
    'New customer - referred by neighbor. Very satisfied with thorough evaluation.',
    NOW() - INTERVAL '18 months'
);

-- Job status updates will be created automatically by the system
-- No need to manually insert them here as they reference specific job IDs

-- Verify the data
SELECT 
    'Customer Data Updated' as result,
    first_name,
    last_name,
    address_line1,
    city,
    state,
    phone,
    tags
FROM contacts 
WHERE id = 'c9882d63-65d4-4b5c-9a51-c26f5b18649b';

-- Show job history
SELECT 
    'Job History Created' as result,
    title,
    status,
    start_date,
    estimated_cost
FROM jobs 
WHERE contact_id = 'c9882d63-65d4-4b5c-9a51-c26f5b18649b'
ORDER BY start_date DESC;