-- Safely handle job_documents table and policies that may already exist

-- Step 1: Check if table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_documents') THEN
        CREATE TABLE job_documents (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
            uploaded_by_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
            
            -- File information
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_type TEXT NOT NULL,
            
            -- Document categorization
            document_type TEXT NOT NULL CHECK (document_type IN (
                'contract', 'estimate', 'invoice', 'permit', 'inspection', 
                'warranty', 'compliance', 'customer_upload', 'other'
            )),
            description TEXT,
            
            -- Customer portal support
            is_shared_with_customer BOOLEAN DEFAULT false,
            
            -- AI Integration
            is_ai_accessible BOOLEAN DEFAULT true,
            ai_analysis_status TEXT CHECK (ai_analysis_status IN (
                'pending', 'processing', 'completed', 'failed'
            )),
            ai_extracted_data JSONB DEFAULT '{}',
            
            -- Timestamps
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
    END IF;
END $$;

-- Step 2: Add missing columns if table exists
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS uploaded_by_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS is_shared_with_customer BOOLEAN DEFAULT false;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS is_ai_accessible BOOLEAN DEFAULT true;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS ai_analysis_status TEXT;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS ai_extracted_data JSONB DEFAULT '{}';

-- Update document_type constraint to include customer_upload
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'job_documents_document_type_check' 
        AND conrelid = 'job_documents'::regclass
    ) THEN
        ALTER TABLE job_documents DROP CONSTRAINT job_documents_document_type_check;
    END IF;
    
    -- Add updated constraint
    ALTER TABLE job_documents ADD CONSTRAINT job_documents_document_type_check 
    CHECK (document_type IN (
        'contract', 'estimate', 'invoice', 'permit', 'inspection', 
        'warranty', 'compliance', 'customer_upload', 'other'
    ));
END $$;

-- Step 3: Enable RLS
ALTER TABLE job_documents ENABLE ROW LEVEL SECURITY;

-- Step 4: Create or replace the access function
CREATE OR REPLACE FUNCTION can_access_job_with_token(job_id UUID, portal_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_valid BOOLEAN;
BEGIN
  -- Check if the token is valid and matches the job
  SELECT EXISTS (
    SELECT 1 
    FROM client_portal_tokens 
    WHERE token = portal_token 
      AND client_portal_tokens.job_id = can_access_job_with_token.job_id
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO token_valid;
  
  RETURN token_valid;
END;
$$;

-- Grant permissions on function
GRANT EXECUTE ON FUNCTION can_access_job_with_token TO anon;
GRANT EXECUTE ON FUNCTION can_access_job_with_token TO authenticated;

-- Step 5: Drop and recreate policies (to avoid conflicts)
DO $$
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view job documents for their tenant" ON job_documents;
    DROP POLICY IF EXISTS "Users can upload job documents for their tenant" ON job_documents;
    DROP POLICY IF EXISTS "Users can update job documents for their tenant" ON job_documents;
    DROP POLICY IF EXISTS "Users can delete job documents for their tenant" ON job_documents;
    DROP POLICY IF EXISTS "Portal users can view shared job documents" ON job_documents;
    DROP POLICY IF EXISTS "Portal users can upload job documents" ON job_documents;
    DROP POLICY IF EXISTS "service_role_job_documents_access" ON job_documents;
END $$;

-- Create policies for authenticated users
CREATE POLICY "Users can view job documents for their tenant" ON job_documents
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can upload job documents for their tenant" ON job_documents
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update job documents for their tenant" ON job_documents
    FOR UPDATE USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete job documents for their tenant" ON job_documents
    FOR DELETE USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Create anonymous access policies
CREATE POLICY "Portal users can view shared job documents" ON job_documents
    FOR SELECT TO anon
    USING (
        is_shared_with_customer = true AND
        can_access_job_with_token(
            job_id, 
            COALESCE(
                current_setting('request.headers', true)::json->>'authorization',
                current_setting('request.headers', true)::json->>'Authorization',
                ''
            )
        ) = true
    );

CREATE POLICY "Portal users can upload job documents" ON job_documents
    FOR INSERT TO anon
    WITH CHECK (
        can_access_job_with_token(
            job_id, 
            COALESCE(
                current_setting('request.headers', true)::json->>'authorization',
                current_setting('request.headers', true)::json->>'Authorization',
                ''
            )
        ) = true AND
        is_shared_with_customer = true AND
        document_type = 'customer_upload'
    );

-- Service role access
CREATE POLICY "service_role_job_documents_access" ON job_documents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_job_documents_job_id ON job_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_tenant_id ON job_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_uploaded_by ON job_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_job_documents_uploaded_by_contact_id ON job_documents(uploaded_by_contact_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_document_type ON job_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_job_documents_is_shared_with_customer ON job_documents(is_shared_with_customer);
CREATE INDEX IF NOT EXISTS idx_job_documents_ai_status ON job_documents(ai_analysis_status);
CREATE INDEX IF NOT EXISTS idx_job_documents_created_at ON job_documents(created_at DESC);

-- Step 7: Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_job_documents_updated_at ON job_documents;
CREATE TRIGGER update_job_documents_updated_at 
    BEFORE UPDATE ON job_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Grant permissions
GRANT ALL ON job_documents TO authenticated;
GRANT ALL ON job_documents TO service_role;

-- Step 9: Handle storage bucket and policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-documents', 'job-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can upload job documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view job documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete job documents" ON storage.objects;
    DROP POLICY IF EXISTS "Portal users can upload to job documents bucket" ON storage.objects;
    DROP POLICY IF EXISTS "Portal users can view shared job documents in storage" ON storage.objects;
    DROP POLICY IF EXISTS "Service role can manage job documents" ON storage.objects;
EXCEPTION
    WHEN undefined_table THEN
        NULL; -- storage.objects might not exist in some environments
END $$;

-- Create storage policies (wrapped in DO block for safety)
DO $$
BEGIN
    -- Only create if storage.objects exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        CREATE POLICY "Users can upload job documents" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'job-documents' AND
                auth.role() = 'authenticated'
            );

        CREATE POLICY "Users can view job documents" ON storage.objects
            FOR SELECT USING (
                bucket_id = 'job-documents' AND
                auth.role() = 'authenticated'
            );

        CREATE POLICY "Users can delete job documents" ON storage.objects
            FOR DELETE USING (
                bucket_id = 'job-documents' AND
                auth.role() = 'authenticated'
            );

        CREATE POLICY "Portal users can upload to job documents bucket" ON storage.objects
            FOR INSERT TO anon 
            WITH CHECK (
                bucket_id = 'job-documents' AND
                name LIKE 'customer-uploads/%'
            );

        CREATE POLICY "Portal users can view shared job documents in storage" ON storage.objects
            FOR SELECT TO anon
            USING (
                bucket_id = 'job-documents'
            );

        CREATE POLICY "Service role can manage job documents" ON storage.objects
            FOR ALL TO service_role USING (bucket_id = 'job-documents');
    END IF;
END $$;

-- Add comments
COMMENT ON TABLE job_documents IS 'Stores job-related documents with AI analysis capabilities and customer portal support';
COMMENT ON COLUMN job_documents.document_type IS 'Type of document for categorization and filtering';
COMMENT ON COLUMN job_documents.uploaded_by_contact_id IS 'Contact who uploaded the document (for customer uploads)';
COMMENT ON COLUMN job_documents.is_shared_with_customer IS 'Whether this document is visible in the customer portal';
COMMENT ON FUNCTION can_access_job_with_token IS 'Checks if a job can be accessed using a portal token';