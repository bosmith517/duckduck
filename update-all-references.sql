-- This script updates all references from the old admin profile ID to the new auth user ID

-- Step 1: Update chat_channels references
UPDATE chat_channels 
SET created_by = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE created_by = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Step 2: Check for other references to the admin profile
-- (Run this to see what else might need updating)
SELECT 
    'jobs' as table_name,
    COUNT(*) as reference_count
FROM jobs 
WHERE assigned_technician_id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171'
UNION ALL
SELECT 
    'leads' as table_name,
    COUNT(*) as reference_count
FROM leads 
WHERE created_by = '3819a282-68b4-49ac-a2b6-6ecd40b2c171'
UNION ALL
SELECT 
    'password_reset_logs' as table_name,
    COUNT(*) as reference_count
FROM password_reset_logs 
WHERE user_id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Step 3: After updating all references, we can safely update the profile ID
UPDATE user_profiles 
SET id = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE id = '3819a282-68b4-49ac-a2b6-6ecd40b2c171';

-- Step 4: Now we can delete the agent profile (since we already deleted its password_reset_logs)
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND role = 'agent';

-- Step 5: Verify everything is fixed
SELECT 
    up.id,
    up.email,
    up.role,
    up.tenant_id,
    CASE 
        WHEN up.id = '9f12d209-5998-4a98-b574-44202fe54bc2' THEN '✓ YES - Matches Auth User!'
        ELSE '✗ NO - Still Mismatched'
    END as matches_auth
FROM user_profiles up
WHERE up.email = 'bosmith@l7motors.com';