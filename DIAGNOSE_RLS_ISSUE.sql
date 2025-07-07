-- DIAGNOSE what policies are ACTUALLY in the database

-- 1. Show ALL policies on user_profiles
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles'
ORDER BY policyname;

-- 2. Show if RLS is enabled
SELECT 
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles';

-- 3. Show all functions that might be used in policies
SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
AND prosrc LIKE '%user_profiles%'
ORDER BY proname;

-- 4. Check for policies on OTHER tables that reference user_profiles
SELECT 
    tablename,
    policyname,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND qual LIKE '%user_profiles%'
AND tablename != 'user_profiles'
ORDER BY tablename, policyname;

-- 5. Try a direct query to see the exact error
DO $$
DECLARE
    v_result RECORD;
BEGIN
    -- This will show the exact recursion path
    BEGIN
        SELECT * INTO v_result
        FROM user_profiles 
        WHERE id = auth.uid()
        LIMIT 1;
        
        RAISE NOTICE 'Query succeeded! User found: %', v_result.email;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Query failed with error: % - %', SQLSTATE, SQLERRM;
    END;
END $$;