-- Complete fix script that handles all references properly

-- Step 1: First, clean up password_reset_logs for the agent profile
DELETE FROM password_reset_logs 
WHERE user_id = '24062fb4-2465-480d-978b-fb93c4fec5f4';

-- Step 2: Create a new profile with the correct auth user ID
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

-- Step 3: Update all references from the old admin profile to the new one
UPDATE chat_channels 
SET created_by = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE created_by = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

UPDATE jobs 
SET assigned_technician_id = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE assigned_technician_id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

UPDATE leads 
SET created_by = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE created_by = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

UPDATE password_reset_logs 
SET user_id = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE user_id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Step 4: Check for any other references before deleting
SELECT 
    'About to delete admin profile: ' || id as action,
    email,
    role
FROM user_profiles 
WHERE id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Step 5: Delete the old admin profile
DELETE FROM user_profiles 
WHERE id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Step 6: Delete the agent profile
DELETE FROM user_profiles 
WHERE id = '24062fb4-2465-480d-978b-fb93c4fec5f4';

-- Step 7: Final verification
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
    END as status,
    COUNT(*) OVER() as total_profiles_for_email
FROM user_profiles up
WHERE up.email = 'bosmith@l7motors.com';