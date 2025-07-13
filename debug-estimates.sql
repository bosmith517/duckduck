-- Debug query to check estimate data
-- Run this in Supabase SQL Editor to see what's in the database

-- Check specific estimates that show as "Unknown Client"
SELECT 
  e.id,
  e.estimate_number,
  e.project_title,
  e.account_id,
  e.contact_id,
  e.created_at,
  -- Account info
  a.name as account_name,
  -- Contact info
  c.id as contact_id_check,
  c.name as contact_name,
  c.first_name,
  c.last_name,
  c.email as contact_email,
  -- Determine what's missing
  CASE 
    WHEN e.account_id IS NULL AND e.contact_id IS NULL THEN 'No client linked'
    WHEN e.account_id IS NOT NULL AND a.id IS NULL THEN 'Account ID exists but account not found'
    WHEN e.contact_id IS NOT NULL AND c.id IS NULL THEN 'Contact ID exists but contact not found'
    WHEN e.contact_id IS NOT NULL AND c.name IS NULL AND c.first_name IS NULL THEN 'Contact exists but no name'
    ELSE 'Data looks OK'
  END as issue
FROM estimates e
LEFT JOIN accounts a ON e.account_id = a.id
LEFT JOIN contacts c ON e.contact_id = c.id
WHERE e.estimate_number IN ('EST-20250712-0001', 'EST-022516')
ORDER BY e.created_at DESC;

-- Check if those estimates have jobs and what client info the jobs have
SELECT 
  j.id,
  j.job_number,
  j.title,
  j.account_id,
  j.contact_id,
  e.estimate_number,
  a.name as job_account_name,
  c.name as job_contact_name,
  CONCAT(c.first_name, ' ', c.last_name) as job_contact_full_name
FROM jobs j
LEFT JOIN estimates e ON e.job_id = j.id
LEFT JOIN accounts a ON j.account_id = a.id
LEFT JOIN contacts c ON j.contact_id = c.id
WHERE e.estimate_number IN ('EST-20250712-0001', 'EST-022516')
   OR j.contact_id IN (
     SELECT contact_id FROM estimates 
     WHERE estimate_number IN ('EST-20250712-0001', 'EST-022516')
   );

-- Check all estimates with missing client info
SELECT 
  COUNT(*) as total_estimates,
  SUM(CASE WHEN account_id IS NULL AND contact_id IS NULL THEN 1 ELSE 0 END) as no_client,
  SUM(CASE WHEN contact_id IS NOT NULL THEN 1 ELSE 0 END) as has_contact,
  SUM(CASE WHEN account_id IS NOT NULL THEN 1 ELSE 0 END) as has_account
FROM estimates;

-- Check contacts that might be missing name data
SELECT 
  c.id,
  c.name,
  c.first_name,
  c.last_name,
  c.email,
  COUNT(e.id) as estimate_count,
  COUNT(j.id) as job_count
FROM contacts c
LEFT JOIN estimates e ON e.contact_id = c.id
LEFT JOIN jobs j ON j.contact_id = c.id
WHERE c.tenant_id = (SELECT tenant_id FROM estimates WHERE estimate_number = 'EST-20250712-0001' LIMIT 1)
  AND (c.name IS NULL OR c.name = '')
GROUP BY c.id, c.name, c.first_name, c.last_name, c.email
HAVING COUNT(e.id) > 0 OR COUNT(j.id) > 0;