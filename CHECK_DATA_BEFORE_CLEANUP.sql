-- CHECK CURRENT DATA COUNTS BEFORE CLEANUP
-- Run this first to see what data exists

SELECT 'tenants' as table_name, COUNT(*) as current_count FROM tenants
UNION ALL
SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL
SELECT 'estimates', COUNT(*) FROM estimates
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'calls', COUNT(*) FROM calls
UNION ALL
SELECT 'equipment', COUNT(*) FROM equipment
UNION ALL
SELECT 'technicians', COUNT(*) FROM technicians
UNION ALL
SELECT 'tenant_phone_numbers', COUNT(*) FROM tenant_phone_numbers
UNION ALL
SELECT 'sip_configurations', COUNT(*) FROM sip_configurations
UNION ALL
SELECT 'automated_communication_triggers', COUNT(*) FROM automated_communication_triggers
UNION ALL
SELECT 'communications', COUNT(*) FROM communications
UNION ALL
SELECT 'technician_locations', COUNT(*) FROM technician_locations
UNION ALL
SELECT 'customer_portal_activity', COUNT(*) FROM customer_portal_activity
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
ORDER BY table_name;

-- Show sample data to identify what looks like dummy/test data
SELECT 'Sample Contacts:' as info;
SELECT company_name, email, created_at FROM contacts ORDER BY created_at LIMIT 5;

SELECT 'Sample Accounts:' as info;
SELECT name, account_type, created_at FROM accounts ORDER BY created_at LIMIT 5;

SELECT 'Sample Jobs:' as info;
SELECT title, status, created_at FROM jobs ORDER BY created_at LIMIT 5;

SELECT 'Sample Technicians:' as info;
SELECT name, email, created_at FROM technicians ORDER BY created_at LIMIT 5;