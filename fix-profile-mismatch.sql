-- 1. First, let's see the exact situation
SELECT 
    'Auth User ID' as type,
    id::text as id,
    email,
    created_at::text as created_at
FROM auth.users 
WHERE email = 'bosmith@l7motors.com'
UNION ALL
SELECT 
    'Profile ' || row_number() OVER (ORDER BY created_at) || ' (' || role || ')' as type,
    id::text as id,
    email,
    created_at::text as created_at
FROM user_profiles 
WHERE email = 'bosmith@l7motors.com'
ORDER BY created_at;

-- 2. OPTION A: Update one of the existing profiles to match the auth.users ID
-- This is the safest approach - choose which role you want to keep (admin or agent)

-- To keep the ADMIN profile:
/*
UPDATE user_profiles 
SET id = (SELECT id FROM auth.users WHERE email = 'bosmith@l7motors.com')
WHERE email = 'bosmith@l7motors.com' 
AND role = 'admin';

-- Then delete the agent profile
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND role = 'agent';
*/

-- To keep the AGENT profile:
/*
UPDATE user_profiles 
SET id = (SELECT id FROM auth.users WHERE email = 'bosmith@l7motors.com')
WHERE email = 'bosmith@l7motors.com' 
AND role = 'agent';

-- Then delete the admin profile
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND role = 'admin';
*/

-- 3. OPTION B: Delete both profiles and create a fresh one
/*
-- Delete both existing profiles
DELETE FROM user_profiles WHERE email = 'bosmith@l7motors.com';

-- Create a new profile with the correct ID
INSERT INTO user_profiles (
    id,
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    role_name
)
SELECT 
    au.id,
    (SELECT tenant_id FROM user_profiles LIMIT 1), -- Use any existing tenant for now
    'bosmith@l7motors.com',
    'Bo',
    'Smith',
    'admin',
    'owner'
FROM auth.users au
WHERE au.email = 'bosmith@l7motors.com';
*/