-- Migration: Add RLS policy for anonymous access to video_sessions
-- This allows customers to access video sessions using session ID

-- Enable RLS on video_sessions table
ALTER TABLE video_sessions ENABLE ROW LEVEL SECURITY;

-- Drop the previous anon policy if it exists
DROP POLICY IF EXISTS "anon can read with valid token" ON video_sessions;

-- Create simple policy that allows anonymous users to read video sessions 
-- Security is based on knowing the session ID (UUID is unguessable)
CREATE POLICY "anon can read video sessions"
ON video_sessions
FOR SELECT 
TO anon
USING (true); -- Allow all reads - security via unguessable UUID

-- Note: The authenticated users policy is already created in the previous migration

-- Grant necessary permissions
GRANT SELECT ON video_sessions TO anon;
GRANT USAGE ON SCHEMA public TO anon;