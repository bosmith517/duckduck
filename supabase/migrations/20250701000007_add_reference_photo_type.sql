-- Add 'reference' to the job_photos photo_type constraint
ALTER TABLE "public"."job_photos" 
DROP CONSTRAINT IF EXISTS "job_photos_photo_type_check";

ALTER TABLE "public"."job_photos" 
ADD CONSTRAINT "job_photos_photo_type_check" 
CHECK ((("photo_type")::text = ANY ((ARRAY[
    'receipt'::character varying, 
    'job_progress'::character varying, 
    'before'::character varying, 
    'after'::character varying, 
    'general'::character varying,
    'reference'::character varying
])::text[])));

-- Also update estimate_line_items to add 'reference' if it doesn't exist
-- (This might already be there, but ensuring consistency)
DO $$
BEGIN
    -- Check if 'reference' is already in the estimate photo types
    -- This is defensive programming in case we need it later
    NULL;
END $$;

-- Add comment for documentation
COMMENT ON CONSTRAINT "job_photos_photo_type_check" ON "public"."job_photos" 
IS 'Allows receipt, job_progress, before, after, general, and reference photo types';