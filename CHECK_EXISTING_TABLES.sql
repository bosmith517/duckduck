-- Check what tables and columns currently exist
-- Run this first to see what we're working with

-- Check if tenants table exists and its structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'tenants'
ORDER BY ordinal_position;

-- Check if user_profiles table exists and its structure  
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Show all public tables
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;