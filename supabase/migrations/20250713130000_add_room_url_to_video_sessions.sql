-- Add room_url column to video_sessions if it doesn't exist
-- This migration safely adds the column without destroying data

DO $$ 
BEGIN
    -- Add room_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'video_sessions' 
        AND column_name = 'room_url'
    ) THEN
        ALTER TABLE video_sessions ADD COLUMN room_url TEXT;
    END IF;

    -- Add metadata column if needed (as JSONB)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'video_sessions' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE video_sessions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;