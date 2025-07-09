-- The correct approach: Create a new profile with the right ID first, then migrate data

-- Step 1: Create a new profile with the correct auth user ID (excluding generated columns)
INSERT INTO user_profiles (
    id,
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    created_at,
    updated_at,
    department,
    phone,
    avatar_url
)
SELECT 
    '9f12d209-5998-4a98-b574-44202fe54bc2' as id,
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    COALESCE(is_active, true) as is_active,
    created_at,
    NOW() as updated_at,
    department,
    phone,
    avatar_url
FROM user_profiles
WHERE email = 'bosmith@l7motors.com'
AND role = 'admin'
LIMIT 1;

-- Step 2: Now update all references from the old admin profile to the new one
UPDATE chat_channels 
SET created_by = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE created_by = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Update any other tables that might reference the old ID
UPDATE jobs 
SET assigned_technician_id = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE assigned_technician_id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

UPDATE leads 
SET created_by = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE created_by = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

UPDATE password_reset_logs 
SET user_id = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE user_id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Step 3: Delete the old admin profile
DELETE FROM user_profiles 
WHERE id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Step 4: Delete the agent profile
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND role = 'agent';

-- Step 5: Verify we now have exactly one profile with the correct ID
SELECT 
    up.id,
    up.email,
    up.role,
    up.tenant_id,
    up.first_name,
    up.last_name,
    up.full_name,
    CASE 
        WHEN up.id = '9f12d209-5998-4a98-b574-44202fe54bc2' THEN '✓ SUCCESS - Matches Auth User!'
        ELSE '✗ FAILED - Still Mismatched'
    END as status
FROM user_profiles up
WHERE up.email = 'bosmith@l7motors.com';