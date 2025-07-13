-- Helper functions and procedures for manually fixing client connections
-- This migration provides tools for admins to fix "Unknown Client" issues

-- Function to manually fix a specific estimate's client connection
CREATE OR REPLACE FUNCTION fix_estimate_by_number(
  p_estimate_number TEXT,
  p_client_name TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_estimate_id UUID;
  v_account_id UUID;
  v_contact_id UUID;
  v_tenant_id UUID;
  v_result TEXT;
BEGIN
  -- Find the estimate
  SELECT id, tenant_id INTO v_estimate_id, v_tenant_id
  FROM estimates
  WHERE estimate_number = p_estimate_number;
  
  IF v_estimate_id IS NULL THEN
    RETURN 'Error: Estimate not found with number: ' || p_estimate_number;
  END IF;
  
  -- Try to find a matching account
  SELECT id INTO v_account_id
  FROM accounts
  WHERE tenant_id = v_tenant_id
    AND LOWER(name) = LOWER(p_client_name)
  LIMIT 1;
  
  -- If no account found, try to find a contact
  IF v_account_id IS NULL THEN
    SELECT id INTO v_contact_id
    FROM contacts
    WHERE tenant_id = v_tenant_id
      AND (
        LOWER(name) = LOWER(p_client_name)
        OR LOWER(CONCAT(first_name, ' ', last_name)) = LOWER(p_client_name)
        OR LOWER(email) = LOWER(p_client_name)
      )
    LIMIT 1;
  END IF;
  
  -- Update the estimate
  IF v_account_id IS NOT NULL THEN
    UPDATE estimates
    SET account_id = v_account_id, contact_id = NULL
    WHERE id = v_estimate_id;
    v_result := 'Success: Connected estimate ' || p_estimate_number || ' to business account: ' || p_client_name;
  ELSIF v_contact_id IS NOT NULL THEN
    UPDATE estimates
    SET contact_id = v_contact_id, account_id = NULL
    WHERE id = v_estimate_id;
    v_result := 'Success: Connected estimate ' || p_estimate_number || ' to individual contact: ' || p_client_name;
  ELSE
    v_result := 'Error: No client found with name: ' || p_client_name;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to list all potential matches for an orphaned estimate
CREATE OR REPLACE FUNCTION find_potential_clients_for_estimate(p_estimate_number TEXT)
RETURNS TABLE(
  client_type TEXT,
  client_id UUID,
  client_name TEXT,
  match_confidence TEXT,
  match_reason TEXT
) AS $$
DECLARE
  v_estimate RECORD;
BEGIN
  -- Get estimate details
  SELECT * INTO v_estimate
  FROM estimates
  WHERE estimate_number = p_estimate_number;
  
  IF v_estimate IS NULL THEN
    RAISE EXCEPTION 'Estimate not found: %', p_estimate_number;
  END IF;
  
  -- Find potential matches based on various criteria
  RETURN QUERY
  -- Check jobs table for connections
  WITH job_clients AS (
    SELECT 
      CASE WHEN j.account_id IS NOT NULL THEN 'Business' ELSE 'Individual' END as client_type,
      COALESCE(j.account_id, j.contact_id) as client_id,
      COALESCE(a.name, CONCAT(c.first_name, ' ', c.last_name), c.name, c.email) as client_name
    FROM jobs j
    LEFT JOIN accounts a ON j.account_id = a.id
    LEFT JOIN contacts c ON j.contact_id = c.id
    WHERE j.id = v_estimate.job_id
      AND (j.account_id IS NOT NULL OR j.contact_id IS NOT NULL)
  )
  SELECT 
    jc.client_type::TEXT,
    jc.client_id,
    jc.client_name::TEXT,
    'High'::TEXT as match_confidence,
    'Connected via job'::TEXT as match_reason
  FROM job_clients jc
  
  UNION ALL
  
  -- Check for similar project titles
  SELECT DISTINCT
    CASE WHEN e2.account_id IS NOT NULL THEN 'Business' ELSE 'Individual' END::TEXT,
    COALESCE(e2.account_id, e2.contact_id),
    COALESCE(a2.name, CONCAT(c2.first_name, ' ', c2.last_name), c2.name, c2.email)::TEXT,
    'Medium'::TEXT,
    'Similar project title'::TEXT
  FROM estimates e2
  LEFT JOIN accounts a2 ON e2.account_id = a2.id
  LEFT JOIN contacts c2 ON e2.contact_id = c2.id
  WHERE e2.tenant_id = v_estimate.tenant_id
    AND e2.id != v_estimate.id
    AND (e2.account_id IS NOT NULL OR e2.contact_id IS NOT NULL)
    AND LOWER(e2.project_title) = LOWER(v_estimate.project_title)
  
  UNION ALL
  
  -- Check for estimates created around the same time
  SELECT DISTINCT
    CASE WHEN e3.account_id IS NOT NULL THEN 'Business' ELSE 'Individual' END::TEXT,
    COALESCE(e3.account_id, e3.contact_id),
    COALESCE(a3.name, CONCAT(c3.first_name, ' ', c3.last_name), c3.name, c3.email)::TEXT,
    'Low'::TEXT,
    'Created within 1 hour'::TEXT
  FROM estimates e3
  LEFT JOIN accounts a3 ON e3.account_id = a3.id
  LEFT JOIN contacts c3 ON e3.contact_id = c3.id
  WHERE e3.tenant_id = v_estimate.tenant_id
    AND e3.id != v_estimate.id
    AND (e3.account_id IS NOT NULL OR e3.contact_id IS NOT NULL)
    AND ABS(EXTRACT(EPOCH FROM (e3.created_at - v_estimate.created_at))) < 3600
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create a summary view of all orphaned records
CREATE OR REPLACE VIEW v_orphaned_records_summary AS
WITH orphaned_estimates AS (
  SELECT 
    'Estimate' as record_type,
    id,
    estimate_number as identifier,
    project_title as description,
    total_amount as amount,
    created_at,
    tenant_id
  FROM estimates
  WHERE account_id IS NULL AND contact_id IS NULL
),
orphaned_jobs AS (
  SELECT 
    'Job' as record_type,
    id,
    job_number as identifier,
    title as description,
    estimated_cost as amount,
    created_at,
    tenant_id
  FROM jobs
  WHERE account_id IS NULL AND contact_id IS NULL
),
orphaned_invoices AS (
  SELECT 
    'Invoice' as record_type,
    id,
    invoice_number as identifier,
    '' as description,
    total_amount as amount,
    created_at,
    tenant_id
  FROM invoices
  WHERE account_id IS NULL
)
SELECT * FROM orphaned_estimates
UNION ALL
SELECT * FROM orphaned_jobs
UNION ALL
SELECT * FROM orphaned_invoices
ORDER BY created_at DESC;

-- Admin procedure to bulk fix common patterns
CREATE OR REPLACE PROCEDURE bulk_fix_orphaned_records()
LANGUAGE plpgsql
AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_record RECORD;
BEGIN
  -- Fix estimates that have matching jobs with client info
  UPDATE estimates e
  SET 
    account_id = j.account_id,
    contact_id = j.contact_id,
    updated_at = NOW()
  FROM jobs j
  WHERE e.job_id = j.id
    AND e.account_id IS NULL
    AND e.contact_id IS NULL
    AND (j.account_id IS NOT NULL OR j.contact_id IS NOT NULL);
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % estimates via job connections', v_fixed_count;
  
  -- Fix jobs that have matching estimates with client info
  UPDATE jobs j
  SET 
    account_id = e.account_id,
    contact_id = e.contact_id,
    updated_at = NOW()
  FROM estimates e
  WHERE e.job_id = j.id
    AND j.account_id IS NULL
    AND j.contact_id IS NULL
    AND (e.account_id IS NOT NULL OR e.contact_id IS NOT NULL);
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % jobs via estimate connections', v_fixed_count;
  
  -- Fix invoices that have matching jobs with client info
  UPDATE invoices i
  SET 
    account_id = j.account_id,
    updated_at = NOW()
  FROM jobs j
  WHERE i.job_id = j.id
    AND i.account_id IS NULL
    AND j.account_id IS NOT NULL;
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % invoices via job connections', v_fixed_count;
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION fix_estimate_by_number IS 'Manually connect an estimate to a client by estimate number and client name';
COMMENT ON FUNCTION find_potential_clients_for_estimate IS 'Find all potential client matches for an orphaned estimate';
COMMENT ON VIEW v_orphaned_records_summary IS 'Summary of all estimates, jobs, and invoices missing client connections';
COMMENT ON PROCEDURE bulk_fix_orphaned_records IS 'Bulk fix orphaned records using common patterns';

-- Print usage instructions
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Manual Fix Instructions ===';
  RAISE NOTICE '';
  RAISE NOTICE '1. View all orphaned records:';
  RAISE NOTICE '   SELECT * FROM v_orphaned_records_summary;';
  RAISE NOTICE '';
  RAISE NOTICE '2. Find potential clients for a specific estimate:';
  RAISE NOTICE '   SELECT * FROM find_potential_clients_for_estimate(''EST-123456'');';
  RAISE NOTICE '';
  RAISE NOTICE '3. Manually fix an estimate:';
  RAISE NOTICE '   SELECT fix_estimate_by_number(''EST-123456'', ''John Smith'');';
  RAISE NOTICE '';
  RAISE NOTICE '4. Run bulk fixes:';
  RAISE NOTICE '   CALL bulk_fix_orphaned_records();';
  RAISE NOTICE '';
END $$;