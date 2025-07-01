-- Add caller_type column to leads table to distinguish between business clients and individual customers
ALTER TABLE "public"."leads" 
ADD COLUMN "caller_type" character varying DEFAULT 'individual'::character varying;

-- Add constraint to ensure valid values
ALTER TABLE "public"."leads" 
ADD CONSTRAINT "leads_caller_type_check" 
CHECK ((("caller_type")::text = ANY ((ARRAY[
    'business'::character varying,
    'individual'::character varying
])::text[])));

-- Add index for performance
CREATE INDEX "idx_leads_caller_type" ON "public"."leads" USING btree ("caller_type");

-- Add comment for documentation
COMMENT ON COLUMN "public"."leads"."caller_type" IS 'Type of caller: business (client) or individual (customer)';