-- Step 1: Delete password reset logs for the agent profile
DELETE FROM password_reset_logs 
WHERE user_id = '24062fb4-2465-480d-978b-fb93c4fec5f4';

-- Step 2: Now delete the agent profile
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND role = 'agent';

-- Step 3: Update the admin profile to have the correct auth user ID
UPDATE user_profiles 
SET id = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE email = 'bosmith@l7motors.com' 
AND role = 'admin';

-- Step 4: Verify the fix
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