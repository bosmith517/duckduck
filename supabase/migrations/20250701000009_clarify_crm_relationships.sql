-- Clarify CRM relationships and add lead-to-contact conversion tracking

-- Add lead_id to contacts table to track lead conversion
ALTER TABLE "public"."contacts" 
ADD COLUMN IF NOT EXISTS "lead_id" uuid;

-- Add foreign key constraint for lead_id
ALTER TABLE "public"."contacts"
ADD CONSTRAINT "contacts_lead_id_fkey" 
FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;

-- Add contact_type to distinguish individual customers vs business contacts
ALTER TABLE "public"."contacts" 
ADD COLUMN IF NOT EXISTS "contact_type" character varying DEFAULT 'individual'::character varying;

-- Add constraint for contact_type
ALTER TABLE "public"."contacts" 
ADD CONSTRAINT "contacts_contact_type_check" 
CHECK ((("contact_type")::text = ANY ((ARRAY[
    'individual'::character varying,
    'business_contact'::character varying
])::text[])));

-- Add converted_contact_id to leads table
ALTER TABLE "public"."leads" 
ADD COLUMN IF NOT EXISTS "converted_contact_id" uuid;

-- Add foreign key constraint for converted_contact_id
ALTER TABLE "public"."leads"
ADD CONSTRAINT "leads_converted_contact_id_fkey" 
FOREIGN KEY ("converted_contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_contacts_lead_id" ON "public"."contacts" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_contacts_contact_type" ON "public"."contacts" USING btree ("contact_type");
CREATE INDEX IF NOT EXISTS "idx_leads_converted_contact_id" ON "public"."leads" USING btree ("converted_contact_id");

-- Add comments for documentation
COMMENT ON COLUMN "public"."contacts"."lead_id" IS 'Original lead that was converted to this contact';
COMMENT ON COLUMN "public"."contacts"."contact_type" IS 'Type: individual (standalone customer) or business_contact (person at a business account)';
COMMENT ON COLUMN "public"."leads"."converted_contact_id" IS 'Contact created when this lead was converted';

-- Update accounts table to clarify it's for businesses only
COMMENT ON TABLE "public"."accounts" IS 'Business entities only (B2B relationships). Individual customers are contacts without accounts.';
COMMENT ON TABLE "public"."contacts" IS 'People (individuals). Can be standalone customers or contacts at business accounts.';
COMMENT ON TABLE "public"."leads" IS 'Unqualified inquiries that should be converted to contacts when qualified.';