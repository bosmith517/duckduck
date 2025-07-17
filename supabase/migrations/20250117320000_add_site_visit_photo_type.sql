-- Add 'site_visit' to the job_photos photo_type constraint
ALTER TABLE "public"."job_photos" 
DROP CONSTRAINT IF EXISTS "job_photos_photo_type_check";

ALTER TABLE "public"."job_photos" 
ADD CONSTRAINT "job_photos_photo_type_check" 
CHECK (photo_type IN (
    'receipt', 
    'job_progress', 
    'before', 
    'after', 
    'general', 
    'reference',
    'site_assessment',
    'damage',
    'measurement',
    'site_visit'
));

-- Add comment for documentation
COMMENT ON CONSTRAINT "job_photos_photo_type_check" ON "public"."job_photos" 
IS 'Allows receipt, job_progress, before, after, general, reference, site_assessment, damage, measurement, and site_visit photo types';

-- Create a function to bulk update photos for a specific job
CREATE OR REPLACE FUNCTION bulk_update_job_photos_type(
    p_job_number TEXT,
    p_new_photo_type TEXT DEFAULT 'site_visit'
) 
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job_id UUID;
    v_updated_count INTEGER;
BEGIN
    -- Get the job_id from job_number
    SELECT id INTO v_job_id
    FROM jobs
    WHERE job_number = p_job_number
    LIMIT 1;
    
    IF v_job_id IS NULL THEN
        RAISE EXCEPTION 'Job not found with job_number: %', p_job_number;
    END IF;
    
    -- Update all photos for this job to the new type
    UPDATE job_photos
    SET 
        photo_type = p_new_photo_type,
        updated_at = NOW()
    WHERE job_id = v_job_id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RETURN v_updated_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION bulk_update_job_photos_type(TEXT, TEXT) TO authenticated;

-- Now bulk update photos for JOB-1751414767664 to 'site_visit'
SELECT bulk_update_job_photos_type('JOB-1751414767664', 'site_visit');

-- Add comment
COMMENT ON FUNCTION bulk_update_job_photos_type IS 'Bulk update photo types for all photos in a specific job';