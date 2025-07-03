-- Create job_documents table for storing job-related documents
CREATE TABLE IF NOT EXISTS job_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- File information
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    
    -- Document categorization
    document_type TEXT NOT NULL CHECK (document_type IN (
        'contract', 'estimate', 'invoice', 'permit', 'inspection', 
        'warranty', 'compliance', 'other'
    )),
    description TEXT,
    
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

-- Enable RLS
ALTER TABLE job_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view job documents for their tenant" ON job_documents;
DROP POLICY IF EXISTS "Users can upload job documents for their tenant" ON job_documents;
DROP POLICY IF EXISTS "Users can update job documents for their tenant" ON job_documents;
DROP POLICY IF EXISTS "Users can delete job documents for their tenant" ON job_documents;
DROP POLICY IF EXISTS "service_role_job_documents_access" ON job_documents;

-- RLS policies
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

-- Allow service role full access for Edge Functions (AI analysis)
CREATE POLICY "service_role_job_documents_access" ON job_documents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_documents_job_id ON job_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_tenant_id ON job_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_uploaded_by ON job_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_job_documents_document_type ON job_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_job_documents_ai_status ON job_documents(ai_analysis_status);
CREATE INDEX IF NOT EXISTS idx_job_documents_created_at ON job_documents(created_at DESC);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_job_documents_updated_at ON job_documents;

CREATE TRIGGER update_job_documents_updated_at 
    BEFORE UPDATE ON job_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON job_documents TO authenticated;
GRANT ALL ON job_documents TO service_role;

-- Create storage bucket for job documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-documents', 'job-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
DROP POLICY IF EXISTS "Users can upload job documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view job documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete job documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage job documents" ON storage.objects;

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

CREATE POLICY "Service role can manage job documents" ON storage.objects
    FOR ALL TO service_role USING (bucket_id = 'job-documents');

-- Add helpful comments
COMMENT ON TABLE job_documents IS 'Stores job-related documents with AI analysis capabilities';
COMMENT ON COLUMN job_documents.document_type IS 'Type of document for categorization and filtering';
COMMENT ON COLUMN job_documents.is_ai_accessible IS 'Whether this document can be processed by AI for data extraction';
COMMENT ON COLUMN job_documents.ai_analysis_status IS 'Current status of AI analysis for this document';
COMMENT ON COLUMN job_documents.ai_extracted_data IS 'Structured data extracted by AI from the document';