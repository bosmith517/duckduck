-- Find the tenant for bosmith@taurusroofingandsiding.com
SELECT 
    up.email,
    up.tenant_id,
    t.name as tenant_name,
    t.company_name
FROM user_profiles up
JOIN tenants t ON up.tenant_id = t.id
WHERE up.email = 'bosmith@taurusroofingandsiding.com';

-- Update bosmith@l7motors.com to use the same tenant
UPDATE user_profiles
SET tenant_id = (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE email = 'bosmith@taurusroofingandsiding.com'
    LIMIT 1
)
WHERE email = 'bosmith@l7motors.com';

-- Verify both users are now in the same tenant
SELECT 
    up.email,
    up.tenant_id,
    up.role,
    t.name as tenant_name,
    t.company_name
FROM user_profiles up
JOIN tenants t ON up.tenant_id = t.id
WHERE up.email IN ('bosmith@l7motors.com', 'bosmith@taurusroofingandsiding.com')
ORDER BY up.email;