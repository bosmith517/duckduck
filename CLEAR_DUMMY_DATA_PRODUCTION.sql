-- CLEAR DUMMY DATA FROM PRODUCTION ENVIRONMENT
-- WARNING: This will delete most test/dummy data but preserve one sample for each table
-- Run this ONLY on production database after backup

-- 1. Clear dummy customers/contacts (keep 1 sample)
DELETE FROM contacts 
WHERE id NOT IN (
  SELECT id FROM contacts 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 2. Clear dummy accounts (keep 1 sample)
DELETE FROM accounts 
WHERE id NOT IN (
  SELECT id FROM accounts 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 3. Clear dummy jobs (keep 1 sample)
DELETE FROM jobs 
WHERE id NOT IN (
  SELECT id FROM jobs 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 4. Clear dummy estimates (keep 1 sample)
DELETE FROM estimates 
WHERE id NOT IN (
  SELECT id FROM estimates 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 5. Clear dummy invoices (keep 1 sample)
DELETE FROM invoices 
WHERE id NOT IN (
  SELECT id FROM invoices 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 6. Clear dummy calls data (keep last 5 for testing)
DELETE FROM calls 
WHERE id NOT IN (
  SELECT id FROM calls 
  ORDER BY created_at DESC 
  LIMIT 5
);

-- 7. Clear dummy equipment data (keep 1 sample per tenant)
DELETE FROM equipment 
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id) id 
  FROM equipment 
  ORDER BY tenant_id, created_at DESC
);

-- 8. Clear dummy technicians (keep 1 per tenant)
DELETE FROM technicians 
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id) id 
  FROM technicians 
  ORDER BY tenant_id, created_at DESC
);

-- 9. Clear dummy phone numbers (keep 1 per tenant)
DELETE FROM tenant_phone_numbers 
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id) id 
  FROM tenant_phone_numbers 
  ORDER BY tenant_id, created_at DESC
);

-- 10. Clear dummy SIP configurations (keep 1 per tenant)
DELETE FROM sip_configurations 
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id) id 
  FROM sip_configurations 
  ORDER BY tenant_id, created_at DESC
);

-- 11. Clear dummy automated triggers (keep 1 per tenant)
DELETE FROM automated_communication_triggers 
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id) id 
  FROM automated_communication_triggers 
  ORDER BY tenant_id, created_at DESC
);

-- 12. Clear old communications (keep last 10)
DELETE FROM communications 
WHERE id NOT IN (
  SELECT id FROM communications 
  ORDER BY created_at DESC 
  LIMIT 10
);

-- 13. Clear job costs if any exist (keep 1 sample)
DELETE FROM job_costs 
WHERE id NOT IN (
  SELECT id FROM job_costs 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- 14. Clear estimate templates (keep 2 samples per tenant)
DELETE FROM estimate_templates 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) as rn
    FROM estimate_templates
  ) ranked WHERE rn <= 2
);

-- 15. Clear tracking locations (keep last 20 points)
DELETE FROM technician_locations 
WHERE id NOT IN (
  SELECT id FROM technician_locations 
  ORDER BY created_at DESC 
  LIMIT 20
);

-- 16. Clear portal activity logs (keep last 10)
DELETE FROM customer_portal_activity 
WHERE id NOT IN (
  SELECT id FROM customer_portal_activity 
  ORDER BY created_at DESC 
  LIMIT 10
);

-- 17. Clear old notifications (keep last 5)
DELETE FROM notifications 
WHERE id NOT IN (
  SELECT id FROM notifications 
  ORDER BY created_at DESC 
  LIMIT 5
);

-- Show remaining counts for verification
SELECT 'contacts' as table_name, COUNT(*) as remaining_count FROM contacts
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
ORDER BY table_name;