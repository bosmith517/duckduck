-- Add proper foreign key constraint name for business_documents.uploaded_by
ALTER TABLE business_documents 
DROP CONSTRAINT IF EXISTS business_documents_uploaded_by_fkey;

ALTER TABLE business_documents
ADD CONSTRAINT business_documents_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) 
REFERENCES user_profiles(id) 
ON DELETE CASCADE;