-- First, identify which profile ID matches the auth.users ID
SELECT 
    up.id,
    up.role,
    up.tenant_id,
    CASE 
        WHEN up.id = au.id THEN 'KEEP THIS ONE - Matches Auth User'
        ELSE 'DELETE THIS ONE'
    END as action
FROM user_profiles up
CROSS JOIN (SELECT id FROM auth.users WHERE email = 'bosmith@l7motors.com') au
WHERE up.email = 'bosmith@l7motors.com';

-- Once you've identified which one to delete, run:
-- DELETE FROM user_profiles WHERE id = 'THE_ID_TO_DELETE';