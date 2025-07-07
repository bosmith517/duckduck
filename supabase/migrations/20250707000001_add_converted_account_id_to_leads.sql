-- Add converted_account_id to leads table for business lead conversions

-- Add converted_account_id column to leads table
ALTER TABLE "public"."leads" 
ADD COLUMN IF NOT EXISTS "converted_account_id" uuid;

-- Add foreign key constraint for converted_account_id
ALTER TABLE "public"."leads"
ADD CONSTRAINT "leads_converted_account_id_fkey" 
FOREIGN KEY ("converted_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS "idx_leads_converted_account_id" ON "public"."leads" USING btree ("converted_account_id");

-- Add comment for documentation
COMMENT ON COLUMN "public"."leads"."converted_account_id" IS 'Account created when this business lead was converted';

-- Add check constraint to ensure only one conversion type is used
ALTER TABLE "public"."leads"
ADD CONSTRAINT "leads_single_conversion_check" 
CHECK (
    (converted_contact_id IS NULL AND converted_account_id IS NULL) OR 
    (converted_contact_id IS NOT NULL AND converted_account_id IS NULL) OR 
    (converted_contact_id IS NULL AND converted_account_id IS NOT NULL)
);

COMMENT ON CONSTRAINT "leads_single_conversion_check" ON "public"."leads" 
IS 'Ensures a lead is converted to either a contact OR an account, not both';