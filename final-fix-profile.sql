-- Step 1: Delete the agent profile (assuming it has no foreign key references)
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND role = 'agent';

-- Step 2: Update the admin profile to have the correct auth user ID
UPDATE user_profiles 
SET id = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE email = 'bosmith@l7motors.com' 
AND role = 'admin';

-- Step 3: Verify the fix
SELECT 
    up.id,
    up.email,
    up.role,
    up.tenant_id,
    CASE 
        WHEN up.id = '9f12d209-5998-4a98-b574-44202fe54bc2' THEN 'YES - Matches Auth User!'
        ELSE 'NO - Still Mismatched'
    END as matches_auth
FROM user_profiles up
WHERE up.email = 'bosmith@l7motors.com';