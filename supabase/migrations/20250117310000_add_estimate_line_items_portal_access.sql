-- Add RLS policy for anonymous access to estimate_line_items via portal
CREATE POLICY "Allow anonymous portal access to estimate line items"
ON estimate_line_items
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1 
        FROM client_portal_tokens cpt
        INNER JOIN jobs j ON j.id = cpt.job_id
        INNER JOIN estimates e ON (e.job_id = j.id OR j.estimate_id = e.id)
        WHERE cpt.is_active = true
        AND estimate_line_items.estimate_id = e.id
        AND estimate_line_items.tenant_id = cpt.tenant_id
    )
);