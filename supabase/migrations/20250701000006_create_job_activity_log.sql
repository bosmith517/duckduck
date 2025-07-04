-- Create job activity log table for comprehensive job tracking
CREATE TABLE IF NOT EXISTS "public"."job_activity_log" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL,
    "job_id" uuid NOT NULL,
    "user_id" uuid, -- Can be null for system-generated activities
    "activity_type" character varying NOT NULL,
    "activity_category" character varying DEFAULT 'system'::character varying NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "reference_id" uuid, -- Points to related record (estimate_id, invoice_id, etc.)
    "reference_type" character varying, -- 'estimate', 'invoice', 'photo', etc.
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "is_visible_to_customer" boolean DEFAULT false,
    "is_milestone" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "job_activity_log_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_activity_log_activity_type_check" CHECK (
        ("activity_type"::text = ANY (ARRAY[
            'job_created'::character varying,
            'estimate_created'::character varying, 
            'estimate_sent'::character varying,
            'estimate_viewed'::character varying,
            'estimate_accepted'::character varying,
            'estimate_declined'::character varying,
            'work_started'::character varying,
            'work_completed'::character varying,
            'work_paused'::character varying,
            'photo_uploaded'::character varying,
            'note_added'::character varying,
            'status_changed'::character varying,
            'payment_received'::character varying,
            'invoice_created'::character varying,
            'invoice_sent'::character varying,
            'technician_assigned'::character varying,
            'location_update'::character varying,
            'call_made'::character varying,
            'sms_sent'::character varying,
            'other'::character varying
        ]::text[]))
    ),
    CONSTRAINT "job_activity_log_activity_category_check" CHECK (
        ("activity_category"::text = ANY (ARRAY[
            'system'::character varying,
            'user'::character varying, 
            'customer'::character varying,
            'technician'::character varying,
            'admin'::character varying
        ]::text[]))
    )
);

-- Add foreign key constraints
ALTER TABLE ONLY "public"."job_activity_log"
    ADD CONSTRAINT "job_activity_log_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."job_activity_log"
    ADD CONSTRAINT "job_activity_log_job_id_fkey" 
    FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."job_activity_log"
    ADD CONSTRAINT "job_activity_log_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX "idx_job_activity_log_job_id" ON "public"."job_activity_log" USING btree ("job_id");
CREATE INDEX "idx_job_activity_log_tenant_id" ON "public"."job_activity_log" USING btree ("tenant_id");
CREATE INDEX "idx_job_activity_log_created_at" ON "public"."job_activity_log" USING btree ("created_at");
CREATE INDEX "idx_job_activity_log_activity_type" ON "public"."job_activity_log" USING btree ("activity_type");
CREATE INDEX "idx_job_activity_log_customer_visible" ON "public"."job_activity_log" USING btree ("is_visible_to_customer");

-- Enable RLS
ALTER TABLE "public"."job_activity_log" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view activity logs for their own tenant" ON "public"."job_activity_log" 
FOR SELECT USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can create activity logs for their own tenant" ON "public"."job_activity_log" 
FOR INSERT WITH CHECK ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can update activity logs for their own tenant" ON "public"."job_activity_log" 
FOR UPDATE USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

-- Grant permissions
GRANT ALL ON TABLE "public"."job_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."job_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."job_activity_log" TO "service_role";

-- Add comment for documentation
COMMENT ON TABLE "public"."job_activity_log" IS 'Comprehensive activity tracking for jobs with customer visibility controls';

