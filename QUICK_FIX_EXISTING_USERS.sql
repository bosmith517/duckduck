-- Quick fix for existing users without dealing with triggers

-- ========================================
-- STEP 1: CREATE DEFAULT TENANT
-- ========================================

-- Based on the error, it looks like the column is company_name not name
INSERT INTO tenants (id, company_name, plan, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'Default Company', 'basic', true)
ON CONFLICT (id) DO UPDATE 
SET company_name = 'Default Company';

-- ========================================
-- STEP 2: CREATE PROFILES FOR ALL EXISTING USERS
-- ========================================

-- testuser123@anydomain.com
INSERT INTO user_profiles (id, tenant_id, email, first_name, last_name, role, is_active)
VALUES (
    '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3',
    '11111111-1111-1111-1111-111111111111',
    'testuser123@anydomain.com',
    'John',
    'Smith',
    'admin',
    true
) ON CONFLICT (id) DO NOTHING;

-- admin@testcompany.com
INSERT INTO user_profiles (id, tenant_id, email, first_name, last_name, role, is_active)
VALUES (
    '280d0ee3-59a9-4c9e-be2a-85c7af6603fc',
    '11111111-1111-1111-1111-111111111111',
    'admin@testcompany.com',
    'Admin',
    'User',
    'admin',
    true
) ON CONFLICT (id) DO NOTHING;

-- john.simpson@automationfire.com
INSERT INTO user_profiles (id, tenant_id, email, first_name, last_name, role, is_active)
VALUES (
    '1e244c7d-5393-4997-af8e-7c82706468b6',
    '11111111-1111-1111-1111-111111111111',
    'john.simpson@automationfire.com',
    'John',
    'Simpson',
    'admin',
    true
) ON CONFLICT (id) DO NOTHING;

-- ========================================
-- STEP 3: VERIFY USERS NOW HAVE PROFILES
-- ========================================

SELECT 'USERS WITH PROFILES' as status;
SELECT 
    u.email,
    p.first_name,
    p.last_name,
    t.company_name,
    p.role
FROM auth.users u
JOIN user_profiles p ON u.id = p.id
JOIN tenants t ON p.tenant_id = t.id;

-- ========================================
-- STEP 4: CHECK IF ANYONE IS STILL MISSING
-- ========================================

SELECT 'USERS STILL WITHOUT PROFILES' as status;
SELECT 
    u.id,
    u.email
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE p.id IS NULL;