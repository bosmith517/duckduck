-- Check the current situation
SELECT 
    up.id,
    up.email,
    up.tenant_id,
    up.role,
    t.id as tenant_exists,
    t.name as tenant_name
FROM user_profiles up
LEFT JOIN tenants t ON up.tenant_id = t.id
WHERE up.email = 'bosmith@l7motors.com';

-- Check if any tenants exist
SELECT id, name, company_name, created_at 
FROM tenants 
ORDER BY created_at DESC
LIMIT 5;

-- Fix Option 1: Create the missing tenant
/*
INSERT INTO tenants (
    id,
    name,
    company_name,
    created_at,
    updated_at
) VALUES (
    'bd0c8c7c-ac54-4870-a461-24d797113b67',
    'L7 Motors',
    'L7 Motors',
    NOW(),
    NOW()
);
*/

-- Fix Option 2: Update user profile to use an existing tenant
/*
UPDATE user_profiles
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE email = 'bosmith@l7motors.com';
*/

-- Fix Option 3: Create a new tenant and update the profile
/*
WITH new_tenant AS (
    INSERT INTO tenants (name, company_name)
    VALUES ('L7 Motors', 'L7 Motors')
    RETURNING id
)
UPDATE user_profiles
SET tenant_id = (SELECT id FROM new_tenant)
WHERE email = 'bosmith@l7motors.com';
*/