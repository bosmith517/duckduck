-- Script to bulk update photos for JOB-1751414767664 to site_visit type
-- Run this after the migration if needed

-- First check how many photos exist for this job
SELECT 
    j.job_number,
    j.id as job_id,
    COUNT(jp.id) as photo_count,
    STRING_AGG(DISTINCT jp.photo_type, ', ') as current_types
FROM jobs j
LEFT JOIN job_photos jp ON jp.job_id = j.id
WHERE j.job_number = 'JOB-1751414767664'
GROUP BY j.job_number, j.id;

-- Update all photos for this job to 'site_visit' type
UPDATE job_photos
SET 
    photo_type = 'site_visit',
    updated_at = NOW()
WHERE job_id IN (
    SELECT id 
    FROM jobs 
    WHERE job_number = 'JOB-1751414767664'
);

-- Verify the update
SELECT 
    jp.id,
    jp.photo_type,
    jp.description,
    jp.taken_at,
    jp.updated_at
FROM job_photos jp
INNER JOIN jobs j ON j.id = jp.job_id
WHERE j.job_number = 'JOB-1751414767664'
ORDER BY jp.taken_at DESC;