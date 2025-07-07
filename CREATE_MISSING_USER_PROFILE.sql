-- Create a user profile for the invited user who is stuck
-- Replace the values below with the actual user information

-- First, check if this user exists in auth.users
SELECT 
    id,
    email,
    raw_user_meta_data
FROM auth.users 
WHERE id = '9f12d209-5998-4a98-b574-44202fe54bc2';

-- Check if they have an invitation
SELECT 
    *
FROM team_invitations 
WHERE email IN (
    SELECT email FROM auth.users WHERE id = '9f12d209-5998-4a98-b574-44202fe54bc2'
)
ORDER BY created_at DESC;

-- Create the user profile manually
-- You'll need to update the tenant_id based on the invitation
INSERT INTO user_profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    tenant_id,
    created_at,
    updated_at
)
SELECT 
    '9f12d209-5998-4a98-b574-44202fe54bc2',
    au.email,
    COALESCE(ti.first_name, split_part(au.email, '@', 1)),
    COALESCE(ti.last_name, ''),
    COALESCE(ti.role, 'agent'),
    ti.tenant_id,
    NOW(),
    NOW()
FROM auth.users au
LEFT JOIN team_invitations ti ON ti.email = au.email
WHERE au.id = '9f12d209-5998-4a98-b574-44202fe54bc2'
AND ti.tenant_id IS NOT NULL
ORDER BY ti.created_at DESC
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;

-- Update the invitation to accepted if it exists
UPDATE team_invitations 
SET 
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = '9f12d209-5998-4a98-b574-44202fe54bc2'
WHERE email = (
    SELECT email FROM auth.users WHERE id = '9f12d209-5998-4a98-b574-44202fe54bc2'
)
AND (status = 'pending' OR status IS NULL);

-- Verify the profile was created
SELECT * FROM user_profiles WHERE id = '9f12d209-5998-4a98-b574-44202fe54bc2';