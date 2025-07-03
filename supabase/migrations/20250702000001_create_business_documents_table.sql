-- Create business_documents table for storing company documents
CREATE TABLE IF NOT EXISTS business_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('license', 'insurance', 'contract', 'policy', 'certification', 'tax', 'permit', 'other')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add RLS policies
ALTER TABLE business_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their company documents" ON business_documents;
DROP POLICY IF EXISTS "Users can upload documents for their company" ON business_documents;
DROP POLICY IF EXISTS "Users can update their company documents" ON business_documents;
DROP POLICY IF EXISTS "Users can delete their company documents" ON business_documents;

-- Policy for users to access their company's documents
CREATE POLICY "Users can view their company documents" ON business_documents
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy for users to insert documents for their company
CREATE POLICY "Users can upload documents for their company" ON business_documents
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy for users to update documents for their company
CREATE POLICY "Users can update their company documents" ON business_documents
    FOR UPDATE USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy for users to delete documents for their company
CREATE POLICY "Users can delete their company documents" ON business_documents
    FOR DELETE USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_documents_tenant_id ON business_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_documents_uploaded_by ON business_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_business_documents_document_type ON business_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_business_documents_created_at ON business_documents(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_business_documents_updated_at ON business_documents;

CREATE TRIGGER update_business_documents_updated_at 
    BEFORE UPDATE ON business_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();