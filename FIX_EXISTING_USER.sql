-- Fix the existing user to have proper tenant association
-- Run this AFTER running DEPLOY_COMPLETE_SCHEMA.sql

-- First, create a user profile for the existing user
-- Replace 'cc5fcb27-dd3e-4ba7-adab-9a472180e328' with your actual user ID if different

INSERT INTO user_profiles (
    id, 
    tenant_id, 
    email, 
    first_name, 
    last_name, 
    role
)
SELECT 
    'cc5fcb27-dd3e-4ba7-adab-9a472180e328'::UUID,
    '10076fd5-e70f-4062-8192-e42173cf57fd'::UUID,
    'test@tradeworkspro.com',
    'Test',
    'User',
    'admin'
WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = 'cc5fcb27-dd3e-4ba7-adab-9a472180e328'::UUID
);

-- Verify the setup
SELECT 
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    t.id as tenant_id,
    t.name as tenant_name
FROM user_profiles u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.id = 'cc5fcb27-dd3e-4ba7-adab-9a472180e328'::UUID;