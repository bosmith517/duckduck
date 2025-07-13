-- Ensure session_invitations table exists
CREATE TABLE IF NOT EXISTS session_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  phone_number TEXT,
  email_address TEXT,
  magic_link TEXT NOT NULL,
  sent_via TEXT[] DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_invitations_session_id ON session_invitations(session_id);

-- Enable RLS
ALTER TABLE session_invitations ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage invitations
CREATE POLICY "Service role can manage invitations" ON session_invitations
  FOR ALL
  TO service_role
  USING (true);