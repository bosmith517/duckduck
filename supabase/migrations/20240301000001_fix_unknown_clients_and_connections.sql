-- Fix existing "Unknown Client" entries and client-job connection issues
-- This migration addresses:
-- 1. Estimates showing "Unknown Client" 
-- 2. Jobs that cannot be connected to clients
-- 3. Missing relationships between estimates, jobs, and clients

-- First, let's analyze the problem
DO $$
BEGIN
  RAISE NOTICE 'Starting fix for Unknown Client entries and connection issues...';
END $$;

-- Step 1: Fix estimates that have neither account_id nor contact_id
-- These are likely the ones showing as "Unknown Client"
WITH orphaned_estimates AS (
  SELECT e.id, e.estimate_number, e.project_title
  FROM estimates e
  WHERE e.account_id IS NULL 
    AND e.contact_id IS NULL
)
SELECT COUNT(*) as orphaned_count FROM orphaned_estimates;

-- Step 2: Try to reconnect estimates to clients via jobs table
-- Many estimates might be linked to jobs that have client information
UPDATE estimates e
SET 
  account_id = j.account_id,
  contact_id = j.contact_id
FROM jobs j
WHERE e.job_id = j.id
  AND e.account_id IS NULL
  AND e.contact_id IS NULL
  AND (j.account_id IS NOT NULL OR j.contact_id IS NOT NULL);

-- Step 3: Fix jobs that have missing client connections
-- Try to recover client info from related estimates
UPDATE jobs j
SET 
  account_id = COALESCE(j.account_id, e.account_id),
  contact_id = COALESCE(j.contact_id, e.contact_id)
FROM estimates e
WHERE e.job_id = j.id
  AND j.account_id IS NULL
  AND j.contact_id IS NULL
  AND (e.account_id IS NOT NULL OR e.contact_id IS NOT NULL);

-- Step 4: Fix estimates by matching on similar project titles/descriptions
-- This helps when estimates were created separately from jobs
UPDATE estimates e1
SET 
  account_id = COALESCE(e1.account_id, e2.account_id),
  contact_id = COALESCE(e1.contact_id, e2.contact_id)
FROM estimates e2
WHERE e1.id != e2.id
  AND e1.tenant_id = e2.tenant_id
  AND e1.account_id IS NULL
  AND e1.contact_id IS NULL
  AND (e2.account_id IS NOT NULL OR e2.contact_id IS NOT NULL)
  AND (
    -- Match on similar project titles
    LOWER(e1.project_title) = LOWER(e2.project_title)
    OR 
    -- Match on estimate numbers that might be related (e.g., EST-123 and EST-123-R1)
    e1.estimate_number LIKE e2.estimate_number || '%'
  );

-- Step 5: Create a function to find potential client matches
CREATE OR REPLACE FUNCTION find_client_for_estimate(estimate_id UUID)
RETURNS TABLE(suggested_account_id UUID, suggested_contact_id UUID, match_reason TEXT) AS $$
DECLARE
  est_record RECORD;
BEGIN
  -- Get the estimate details
  SELECT * INTO est_record FROM estimates WHERE id = estimate_id;
  
  -- Try to find matches based on various criteria
  RETURN QUERY
  -- Match by job connection
  SELECT 
    j.account_id,
    j.contact_id,
    'Matched via job connection' as match_reason
  FROM jobs j
  WHERE j.id = est_record.job_id
    AND (j.account_id IS NOT NULL OR j.contact_id IS NOT NULL)
  
  UNION
  
  -- Match by similar project title in same tenant
  SELECT 
    e.account_id,
    e.contact_id,
    'Matched via similar project title' as match_reason
  FROM estimates e
  WHERE e.tenant_id = est_record.tenant_id
    AND e.id != estimate_id
    AND (e.account_id IS NOT NULL OR e.contact_id IS NOT NULL)
    AND LOWER(e.project_title) = LOWER(est_record.project_title)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Log remaining orphaned estimates for manual review
CREATE TABLE IF NOT EXISTS estimate_client_fixes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID REFERENCES estimates(id),
  estimate_number TEXT,
  project_title TEXT,
  suggested_account_id UUID,
  suggested_contact_id UUID,
  match_reason TEXT,
  fixed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate the fixes table with suggestions
INSERT INTO estimate_client_fixes (
  estimate_id, 
  estimate_number, 
  project_title,
  suggested_account_id,
  suggested_contact_id,
  match_reason
)
SELECT DISTINCT
  e.id,
  e.estimate_number,
  e.project_title,
  f.suggested_account_id,
  f.suggested_contact_id,
  f.match_reason
FROM estimates e
CROSS JOIN LATERAL find_client_for_estimate(e.id) f
WHERE e.account_id IS NULL 
  AND e.contact_id IS NULL;

-- Step 7: Create a helper function to fix client connections
CREATE OR REPLACE FUNCTION fix_estimate_client_connection(
  p_estimate_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Validate that at least one client ID is provided
  IF p_account_id IS NULL AND p_contact_id IS NULL THEN
    RAISE EXCEPTION 'Either account_id or contact_id must be provided';
  END IF;
  
  -- Update the estimate
  UPDATE estimates
  SET 
    account_id = COALESCE(p_account_id, account_id),
    contact_id = COALESCE(p_contact_id, contact_id),
    updated_at = NOW()
  WHERE id = p_estimate_id;
  
  -- Mark as fixed in the fixes table
  UPDATE estimate_client_fixes
  SET fixed = TRUE
  WHERE estimate_id = p_estimate_id;
  
  -- Also update related job if it exists and needs fixing
  UPDATE jobs j
  SET 
    account_id = COALESCE(p_account_id, j.account_id),
    contact_id = COALESCE(p_contact_id, j.contact_id),
    updated_at = NOW()
  FROM estimates e
  WHERE e.job_id = j.id
    AND e.id = p_estimate_id
    AND (j.account_id IS NULL AND j.contact_id IS NULL);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Add a view to easily see problematic records
CREATE OR REPLACE VIEW v_estimates_missing_clients AS
SELECT 
  e.id,
  e.estimate_number,
  e.project_title,
  e.total_amount,
  e.status,
  e.created_at,
  j.job_number,
  j.title as job_title,
  -- Try to extract any client info from related data
  COALESCE(
    a.name,
    CONCAT(c.first_name, ' ', c.last_name),
    'No Client Found'
  ) as potential_client,
  CASE 
    WHEN e.account_id IS NULL AND e.contact_id IS NULL THEN 'Missing Client'
    WHEN j.id IS NOT NULL AND j.account_id IS NULL AND j.contact_id IS NULL THEN 'Job Missing Client'
    ELSE 'Other Issue'
  END as issue_type
FROM estimates e
LEFT JOIN jobs j ON e.job_id = j.id
LEFT JOIN accounts a ON e.account_id = a.id OR j.account_id = a.id
LEFT JOIN contacts c ON e.contact_id = c.id OR j.contact_id = c.id
WHERE (e.account_id IS NULL AND e.contact_id IS NULL)
   OR (j.id IS NOT NULL AND j.account_id IS NULL AND j.contact_id IS NULL);

-- Step 9: Create an audit report
DO $$
DECLARE
  orphaned_estimates_count INTEGER;
  orphaned_jobs_count INTEGER;
  fixed_count INTEGER;
BEGIN
  -- Count remaining orphaned estimates
  SELECT COUNT(*) INTO orphaned_estimates_count
  FROM estimates
  WHERE account_id IS NULL AND contact_id IS NULL;
  
  -- Count orphaned jobs
  SELECT COUNT(*) INTO orphaned_jobs_count
  FROM jobs
  WHERE account_id IS NULL AND contact_id IS NULL;
  
  -- Count how many we fixed
  SELECT COUNT(*) INTO fixed_count
  FROM estimate_client_fixes
  WHERE fixed = TRUE;
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '- Orphaned estimates remaining: %', orphaned_estimates_count;
  RAISE NOTICE '- Orphaned jobs remaining: %', orphaned_jobs_count;
  RAISE NOTICE '- Connections fixed: %', fixed_count;
  RAISE NOTICE '';
  RAISE NOTICE 'To view remaining issues, query: SELECT * FROM v_estimates_missing_clients;';
  RAISE NOTICE 'To view fix suggestions, query: SELECT * FROM estimate_client_fixes WHERE fixed = FALSE;';
END $$;

-- Step 10: Add comments for documentation
COMMENT ON TABLE estimate_client_fixes IS 'Tracks estimates with missing client connections and suggested fixes';
COMMENT ON FUNCTION fix_estimate_client_connection IS 'Helper function to fix missing client connections on estimates';
COMMENT ON VIEW v_estimates_missing_clients IS 'View showing estimates and jobs with missing client connections';