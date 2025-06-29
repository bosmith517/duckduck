-- STEP 4: Add foreign key constraint (run after step 3 succeeds)

-- Add the foreign key constraint to estimates table
ALTER TABLE estimates 
ADD CONSTRAINT fk_estimates_template_id 
FOREIGN KEY (template_id) REFERENCES estimate_templates(id) ON DELETE SET NULL;