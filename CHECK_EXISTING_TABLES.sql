-- Check what already exists in the database
-- Run this first to see what's already there

-- Check if estimate_templates table exists and what columns it has
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'estimate_templates' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if any of our target tables already exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('estimate_templates', 'estimate_variables', 'template_usage_analytics');

-- Check what columns estimates table has
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'estimates' 
AND table_schema = 'public'
ORDER BY ordinal_position;