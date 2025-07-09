-- 1. First, let's see all the profiles for this email
SELECT 
    up.id,
    up.email,
    up.first_name,
    up.last_name,
    up.role,
    up.role_name,
    up.tenant_id,
    t.name as tenant_name,
    up.created_at,
    up.updated_at,
    CASE 
        WHEN up.id IN (SELECT id FROM auth.users WHERE email = 'bosmith@l7motors.com')
        THEN 'YES - MATCHES AUTH USER'
        ELSE 'NO - ORPHANED PROFILE'
    END as matches_auth_user
FROM user_profiles up
LEFT JOIN tenants t ON up.tenant_id = t.id
WHERE up.email = 'bosmith@l7motors.com'
ORDER BY up.created_at;

-- 2. Check the auth.users table
SELECT 
    id as auth_user_id,
    email,
    created_at,
    last_sign_in_at,
    updated_at
FROM auth.users
WHERE email = 'bosmith@l7motors.com';

-- 3. Check which profile ID matches the auth.users ID
SELECT 
    'AUTH USER ID' as type,
    id::text as value
FROM auth.users 
WHERE email = 'bosmith@l7motors.com'
UNION ALL
SELECT 
    'PROFILE IDs' as type,
    string_agg(id::text, ', ') as value
FROM user_profiles 
WHERE email = 'bosmith@l7motors.com';

-- 4. To fix this, you need to:
-- a) Identify which profile should be kept (likely the one matching auth.users.id)
-- b) Delete the duplicate profile
-- c) Ensure the remaining profile has the correct role

-- Here's the fix script (REVIEW BEFORE RUNNING):
/*
-- Option 1: Keep the profile that matches auth.users.id
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND id NOT IN (SELECT id FROM auth.users WHERE email = 'bosmith@l7motors.com');

-- Option 2: If you want to keep the admin profile specifically
-- First update the auth user ID to match the admin profile
UPDATE user_profiles 
SET id = (SELECT id FROM auth.users WHERE email = 'bosmith@l7motors.com')
WHERE email = 'bosmith@l7motors.com' 
AND role = 'admin';

-- Then delete the other profile
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND role != 'admin';
*/