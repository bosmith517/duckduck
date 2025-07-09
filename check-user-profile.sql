-- Check if user profile exists for bosmith@l7motors.com
SELECT 
    up.id,
    up.email,
    up.first_name,
    up.last_name,
    up.tenant_id,
    up.role,
    up.created_at,
    t.name as tenant_name
FROM user_profiles up
LEFT JOIN tenants t ON up.tenant_id = t.id
WHERE up.email = 'bosmith@l7motors.com';

-- Check if there's a user in auth.users
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email = 'bosmith@l7motors.com';

-- Check for any invitations
SELECT 
    id,
    email,
    tenant_id,
    status,
    created_at
FROM user_invitations
WHERE email = 'bosmith@l7motors.com';