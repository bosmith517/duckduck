-- Create storage buckets for branding assets and document templates

-- Create branding-assets bucket for logos, favicons, and other branding files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'branding-assets',
    'branding-assets',
    true, -- Public bucket so customer portals can access logos
    5242880, -- 5MB limit for branding assets
    ARRAY[
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/svg+xml',
        'image/webp',
        'image/ico',
        'image/x-icon'
    ]
) ON CONFLICT (id) DO NOTHING;

-- Create document-templates bucket for storing template files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'document-templates',
    'document-templates',
    false, -- Private bucket - templates should be access-controlled
    52428800, -- 50MB limit for document templates
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
        'application/msword', -- .doc
        'application/vnd.ms-excel', -- .xls
        'application/vnd.ms-powerpoint', -- .ppt
        'text/plain',
        'text/csv',
        'application/rtf',
        'application/vnd.oasis.opendocument.text', -- .odt
        'application/vnd.oasis.opendocument.spreadsheet', -- .ods
        'image/jpeg',
        'image/png',
        'image/gif'
    ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for branding-assets bucket
-- Allow authenticated users to upload to their tenant folder
CREATE POLICY "Authenticated users can upload branding assets"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'branding-assets' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
        SELECT user_profiles.tenant_id::text 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'agent')
    )
);

-- Allow authenticated users to update their tenant's branding assets
CREATE POLICY "Authenticated users can update their branding assets"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'branding-assets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
        SELECT user_profiles.tenant_id::text 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'agent')
    )
);

-- Allow authenticated users to delete their tenant's branding assets
CREATE POLICY "Authenticated users can delete their branding assets"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'branding-assets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
        SELECT user_profiles.tenant_id::text 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'agent')
    )
);

-- Allow public read access to branding assets (for customer portals)
CREATE POLICY "Public read access to branding assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding-assets');

-- Service role can do everything
CREATE POLICY "Service role can manage branding assets"
ON storage.objects FOR ALL
USING (bucket_id = 'branding-assets' AND auth.role() = 'service_role');

-- Storage policies for document-templates bucket
-- Allow authenticated users to upload templates to their tenant folder
CREATE POLICY "Authenticated users can upload document templates"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'document-templates' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
        SELECT user_profiles.tenant_id::text 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'agent')
    )
);

-- Allow authenticated users to read their tenant's templates
CREATE POLICY "Authenticated users can view their tenant's templates"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'document-templates'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
        SELECT user_profiles.tenant_id::text 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
    )
);

-- Allow authenticated users to update their tenant's templates
CREATE POLICY "Authenticated users can update their tenant's templates"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'document-templates'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
        SELECT user_profiles.tenant_id::text 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'agent')
    )
);

-- Allow authenticated users to delete their tenant's templates
CREATE POLICY "Authenticated users can delete their tenant's templates"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'document-templates'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
        SELECT user_profiles.tenant_id::text 
        FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'agent')
    )
);

-- Service role can do everything
CREATE POLICY "Service role can manage document templates"
ON storage.objects FOR ALL
USING (bucket_id = 'document-templates' AND auth.role() = 'service_role');

-- Create helper function to get tenant branding assets
CREATE OR REPLACE FUNCTION get_tenant_branding_assets(tenant_uuid UUID)
RETURNS TABLE (
    file_name TEXT,
    file_path TEXT,
    file_url TEXT,
    file_size BIGINT,
    file_type TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (storage.foldername(objects.name))[2] as file_name,
        objects.name as file_path,
        CASE 
            WHEN objects.name IS NOT NULL 
            THEN concat('https://eskpnhbemnxkxafjbbdx.supabase.co/storage/v1/object/public/branding-assets/', objects.name)
            ELSE NULL 
        END as file_url,
        objects.metadata->>'size' as file_size,
        objects.metadata->>'mimetype' as file_type,
        objects.created_at
    FROM storage.objects
    WHERE bucket_id = 'branding-assets'
    AND (storage.foldername(objects.name))[1] = tenant_uuid::text
    ORDER BY objects.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get tenant document templates from storage
CREATE OR REPLACE FUNCTION get_tenant_document_files(tenant_uuid UUID)
RETURNS TABLE (
    file_name TEXT,
    file_path TEXT,
    file_size BIGINT,
    file_type TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (storage.foldername(objects.name))[2] as file_name,
        objects.name as file_path,
        objects.metadata->>'size' as file_size,
        objects.metadata->>'mimetype' as file_type,
        objects.created_at
    FROM storage.objects
    WHERE bucket_id = 'document-templates'
    AND (storage.foldername(objects.name))[1] = tenant_uuid::text
    ORDER BY objects.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_tenant_branding_assets(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_branding_assets(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_tenant_document_files(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_document_files(UUID) TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION get_tenant_branding_assets(UUID) IS 'Returns all branding assets (logos, images) for a specific tenant';
COMMENT ON FUNCTION get_tenant_document_files(UUID) IS 'Returns all document template files for a specific tenant';