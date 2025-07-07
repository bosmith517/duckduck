-- Fix function conflicts by dropping existing functions before recreating them

-- 1. Drop existing invite_team_member function with all its variants
DROP FUNCTION IF EXISTS invite_team_member(UUID, TEXT);
DROP FUNCTION IF EXISTS invite_team_member(UUID);
DROP FUNCTION IF EXISTS invite_team_member(TEXT, TEXT);
DROP FUNCTION IF EXISTS invite_team_member CASCADE;

-- 2. Drop other conflicting functions that might exist
DROP FUNCTION IF EXISTS create_auth_user_for_profile(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS send_password_reset_for_profile(TEXT);
DROP FUNCTION IF EXISTS admin_create_auth_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS link_orphaned_profile_on_signup();

-- 3. Also clean up the functions from previous attempts
DROP FUNCTION IF EXISTS get_current_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS is_user_admin() CASCADE;
DROP FUNCTION IF EXISTS temp_allow_all_access() CASCADE;
DROP FUNCTION IF EXISTS get_user_tenant_and_role() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_role() CASCADE;
DROP FUNCTION IF EXISTS auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS current_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS validate_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS ensure_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS ensure_user_profile_tenant_id() CASCADE;

-- 4. Drop existing triggers that might conflict
DROP TRIGGER IF EXISTS link_orphaned_profile_trigger ON auth.users;

-- 5. Now we can safely apply the other migrations
-- The subsequent migrations will recreate these functions properly