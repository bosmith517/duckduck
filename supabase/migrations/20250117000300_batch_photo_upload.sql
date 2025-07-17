-- Migration: Add batch upload support to job_photos table

-- Add new columns for batch upload tracking
ALTER TABLE job_photos
ADD COLUMN IF NOT EXISTS batch_upload BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS batch_index INTEGER,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for batch uploads
CREATE INDEX IF NOT EXISTS idx_job_photos_batch_upload ON job_photos(batch_upload) WHERE batch_upload = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_photos_job_type ON job_photos(job_id, photo_type);
CREATE INDEX IF NOT EXISTS idx_job_photos_taken_at ON job_photos(taken_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_job_photos_updated_at_trigger') THEN
        CREATE TRIGGER update_job_photos_updated_at_trigger
        BEFORE UPDATE ON job_photos
        FOR EACH ROW
        EXECUTE FUNCTION update_job_photos_updated_at();
    END IF;
END
$$;

-- Update job_activity_log to support batch photo uploads
ALTER TABLE job_activity_log
ADD COLUMN IF NOT EXISTS activity_type VARCHAR(50) DEFAULT 'general';

-- Add new activity type constraint if not exists
DO $$
BEGIN
    -- Check if the constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'job_activity_log_activity_type_check'
    ) THEN
        -- Add the constraint
        ALTER TABLE job_activity_log
        ADD CONSTRAINT job_activity_log_activity_type_check 
        CHECK (activity_type IN (
            'general', 'status_change', 'assignment', 'schedule_change',
            'photo_uploaded', 'photo_batch_uploaded', 'photo_deleted',
            'note_added', 'estimate_created', 'invoice_created',
            'payment_received', 'customer_update'
        ));
    END IF;
END
$$;

-- Create view for photo statistics by job
CREATE OR REPLACE VIEW job_photo_stats AS
SELECT 
    job_id,
    COUNT(*) as total_photos,
    COUNT(DISTINCT photo_type) as photo_types_count,
    COUNT(CASE WHEN photo_type = 'before' THEN 1 END) as before_photos,
    COUNT(CASE WHEN photo_type = 'after' THEN 1 END) as after_photos,
    COUNT(CASE WHEN photo_type = 'job_progress' THEN 1 END) as progress_photos,
    COUNT(CASE WHEN batch_upload = TRUE THEN 1 END) as batch_uploaded,
    SUM(file_size) as total_size_bytes,
    MAX(taken_at) as last_photo_date,
    MIN(taken_at) as first_photo_date
FROM job_photos
GROUP BY job_id;

-- Grant permissions
GRANT SELECT ON job_photo_stats TO authenticated;

-- Add comment
COMMENT ON TABLE job_photos IS 'Stores all photos associated with jobs, including batch uploads';
COMMENT ON COLUMN job_photos.batch_upload IS 'Indicates if photo was part of a batch upload';
COMMENT ON COLUMN job_photos.batch_index IS 'Index position within a batch upload';
COMMENT ON COLUMN job_photos.file_size IS 'File size in bytes';
COMMENT ON COLUMN job_photos.metadata IS 'Additional metadata for the photo (EXIF data, custom tags, etc.)';