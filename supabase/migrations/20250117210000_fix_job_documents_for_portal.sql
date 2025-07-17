-- Fix job_documents table for customer portal access
-- Add missing columns and update foreign key relationships

-- Add columns for customer portal functionality
ALTER TABLE job_documents 
ADD COLUMN IF NOT EXISTS uploaded_by_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_shared_with_customer BOOLEAN DEFAULT false;

-- Update document_type enum to include customer_upload
ALTER TABLE job_documents 
DROP CONSTRAINT IF EXISTS job_documents_document_type_check;

ALTER TABLE job_documents 
ADD CONSTRAINT job_documents_document_type_check 
CHECK (document_type IN (
    'contract', 'estimate', 'invoice', 'permit', 'inspection', 
    'warranty', 'compliance', 'customer_upload', 'other'
));

-- Add anonymous access policy for portal users with valid tokens
CREATE POLICY "Portal users can view shared job documents" ON job_documents
    FOR SELECT TO anon
    USING (
        is_shared_with_customer = true AND
        EXISTS (
            SELECT 1 FROM can_access_job_with_token(job_id, 
                COALESCE(
                    current_setting('request.headers', true)::json->>'authorization',
                    current_setting('request.headers', true)::json->>'Authorization',
                    ''
                )
            ) WHERE can_access = true
        )
    );

-- Allow portal users to upload documents
CREATE POLICY "Portal users can upload job documents" ON job_documents
    FOR INSERT TO anon
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM can_access_job_with_token(job_id, 
                COALESCE(
                    current_setting('request.headers', true)::json->>'authorization',
                    current_setting('request.headers', true)::json->>'Authorization',
                    ''
                )
            ) WHERE can_access = true
        ) AND
        is_shared_with_customer = true AND
        document_type = 'customer_upload'
    );

-- Create index for the new columns
CREATE INDEX IF NOT EXISTS idx_job_documents_uploaded_by_contact_id ON job_documents(uploaded_by_contact_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_is_shared_with_customer ON job_documents(is_shared_with_customer);

-- Update storage policies for anonymous portal access
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

-- Add helpful comments
COMMENT ON COLUMN job_documents.uploaded_by_contact_id IS 'Contact who uploaded the document (for customer uploads)';
COMMENT ON COLUMN job_documents.is_shared_with_customer IS 'Whether this document is visible in the customer portal';