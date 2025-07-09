-- 1. First, let's see which profile has references and which doesn't
SELECT 
    up.id,
    up.role,
    up.created_at,
    (SELECT COUNT(*) FROM chat_channels WHERE created_by = up.id) as chat_channels_count,
    (SELECT COUNT(*) FROM jobs WHERE assigned_technician_id = up.id) as jobs_count,
    (SELECT COUNT(*) FROM leads WHERE created_by = up.id) as leads_count
FROM user_profiles up
WHERE up.email = 'bosmith@l7motors.com';

-- 2. Get the auth user ID we need to update to
SELECT id as auth_user_id, email 
FROM auth.users 
WHERE email = 'bosmith@l7motors.com';

-- 3. Safe approach - update the agent profile (which likely has no references) to the correct ID
-- Then delete the admin profile that has references

-- First, delete the agent profile (assuming it has no references)
/*
DELETE FROM user_profiles 
WHERE email = 'bosmith@l7motors.com' 
AND role = 'agent';
*/

-- Then update the admin profile to have the correct auth user ID
/*
UPDATE user_profiles 
SET id = (SELECT id FROM auth.users WHERE email = 'bosmith@l7motors.com')
WHERE email = 'bosmith@l7motors.com' 
AND role = 'admin';
*/

-- 4. Alternative: If both profiles have references, we need to update the references first
-- This script will show you what needs to be updated:
/*
-- Update all references from the old admin profile ID to the new auth user ID
WITH auth_user AS (
    SELECT id FROM auth.users WHERE email = 'bosmith@l7motors.com'
),
admin_profile AS (
    SELECT id FROM user_profiles WHERE email = 'bosmith@l7motors.com' AND role = 'admin'
)
SELECT 
    'UPDATE chat_channels SET created_by = ''' || au.id || ''' WHERE created_by = ''' || ap.id || ''';' as update_statement
FROM auth_user au, admin_profile ap
UNION ALL
SELECT 
    'UPDATE jobs SET assigned_technician_id = ''' || au.id || ''' WHERE assigned_technician_id = ''' || ap.id || ''';'
FROM auth_user au, admin_profile ap
UNION ALL
SELECT 
    'UPDATE leads SET created_by = ''' || au.id || ''' WHERE created_by = ''' || ap.id || ''';'
FROM auth_user au, admin_profile ap;
*/