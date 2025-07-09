-- Create storage bucket for branding assets
-- This needs to be run as a separate operation

-- First check if bucket exists
SELECT id, name, public 
FROM storage.buckets 
WHERE name = 'branding-assets';

-- If the bucket doesn't exist, you'll need to create it via Supabase dashboard or API
-- Go to Storage in your Supabase dashboard and create a new bucket called 'branding-assets'
-- Make sure to set it as PUBLIC so logos can be displayed

-- Alternative: Use this INSERT if you have appropriate permissions
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--     'branding-assets',
--     'branding-assets',
--     true,
--     5242880, -- 5MB
--     ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
-- );

-- Create RLS policies for the bucket
-- These need to be created after the bucket exists
-- CREATE POLICY "Authenticated users can upload branding assets" ON storage.objects
--     FOR INSERT
--     TO authenticated
--     WITH CHECK (bucket_id = 'branding-assets');

-- CREATE POLICY "Authenticated users can update their branding assets" ON storage.objects
--     FOR UPDATE
--     TO authenticated
--     USING (bucket_id = 'branding-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Public can view branding assets" ON storage.objects
--     FOR SELECT
--     TO public
--     USING (bucket_id = 'branding-assets');