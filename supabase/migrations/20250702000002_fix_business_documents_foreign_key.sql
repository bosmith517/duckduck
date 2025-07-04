-- Add proper foreign key constraint name for business_documents.uploaded_by
-- Only execute if business_documents table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_documents') THEN
        ALTER TABLE business_documents 
        DROP CONSTRAINT IF EXISTS business_documents_uploaded_by_fkey;

        ALTER TABLE business_documents
        ADD CONSTRAINT business_documents_uploaded_by_fkey 
        FOREIGN KEY (uploaded_by) 
        REFERENCES user_profiles(id) 
        ON DELETE CASCADE;
    END IF;
END $$;