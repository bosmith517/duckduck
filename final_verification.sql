-- Final verification of all workflow automation tables and data

-- Check all tables exist
SELECT 'Tables Created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'workflow_rules', 
  'workflow_executions', 
  'notification_templates', 
  'notifications', 
  'notification_preferences',
  'automated_reminders'
)
ORDER BY table_name;

-- Check workflow_rules has all required columns
SELECT 'Workflow Rules Columns:' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workflow_rules' 
ORDER BY ordinal_position;

-- Check default templates were inserted
SELECT 'Default Templates Count:' as status;
SELECT COUNT(*) as template_count 
FROM notification_templates 
WHERE default_template = true;

-- List all default templates
SELECT 'Default Templates:' as status;
SELECT template_name, template_type, category 
FROM notification_templates 
WHERE default_template = true
ORDER BY template_name;

-- Check triggers exist
SELECT 'Database Triggers:' as status;
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE '%workflow%'
ORDER BY trigger_name;

-- Check workflow automation function exists
SELECT 'Workflow Function:' as status;
SELECT proname as function_name
FROM pg_proc 
WHERE proname = 'trigger_workflow_automation';

SELECT 'Migration Status: COMPLETE' as final_status;