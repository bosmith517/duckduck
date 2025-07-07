-- Add missing columns to user_profiles table for team member management

-- Add full_name column (computed from first_name and last_name)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT GENERATED ALWAYS AS 
    (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED;

-- Add phone column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add department column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS department TEXT;

-- Add avatar_url column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create index on full_name for better search performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON public.user_profiles(full_name);

-- Add comment to document the purpose of these columns
COMMENT ON COLUMN public.user_profiles.phone IS 'Team member phone number';
COMMENT ON COLUMN public.user_profiles.department IS 'Team member department (e.g., Operations, Construction, Sales, Administration)';
COMMENT ON COLUMN public.user_profiles.avatar_url IS 'URL to team member avatar image';
COMMENT ON COLUMN public.user_profiles.full_name IS 'Computed full name from first_name and last_name';