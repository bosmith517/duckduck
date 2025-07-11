

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_sip_usage"("tenant_uuid" "uuid", "period_start" "date", "period_end" "date") RETURNS TABLE("total_calls" bigint, "total_minutes" bigint, "total_cost" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_calls,
        COALESCE(SUM(duration_seconds), 0)::BIGINT / 60 as total_minutes,
        COALESCE(SUM(total_cost), 0.00)::DECIMAL as total_cost
    FROM sip_call_logs
    WHERE tenant_id = tenant_uuid
    AND start_time >= period_start::TIMESTAMP WITH TIME ZONE
    AND start_time < (period_end + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE
    AND call_status = 'answered';
END;
$$;


ALTER FUNCTION "public"."calculate_sip_usage"("tenant_uuid" "uuid", "period_start" "date", "period_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_admin_notification"("p_tenant_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_severity" character varying DEFAULT 'info'::character varying, "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO admin_notifications (
        tenant_id,
        type,
        title,
        message,
        severity,
        metadata
    ) VALUES (
        p_tenant_id,
        p_type,
        p_title,
        p_message,
        p_severity,
        p_metadata
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_admin_notification"("p_tenant_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_severity" character varying, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_sip_config"("tenant_uuid" "uuid") RETURNS TABLE("config_id" "uuid", "sip_username" character varying, "sip_domain" character varying, "sip_proxy" character varying, "display_name" character varying, "is_active" boolean, "service_plan" character varying, "primary_phone_number" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id,
        sc.sip_username,
        sc.sip_domain,
        sc.sip_proxy,
        sc.display_name,
        sc.is_active,
        sc.service_plan,
        sc.primary_phone_number
    FROM sip_configurations sc
    WHERE sc.tenant_id = tenant_uuid
    AND sc.is_active = true;
END;
$$;


ALTER FUNCTION "public"."get_tenant_sip_config"("tenant_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_subproject_info"("tenant_uuid" "uuid") RETURNS TABLE("subproject_id" character varying, "subproject_token" "text", "subproject_space" character varying, "subproject_status" character varying, "subproject_created_at" timestamp with time zone, "subproject_error" "text", "retry_needed" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.signalwire_subproject_id,
        t.signalwire_subproject_token,
        t.signalwire_subproject_space,
        t.subproject_status,
        t.subproject_created_at,
        t.subproject_error,
        t.subproject_retry_needed
    FROM tenants t
    WHERE t.id = tenant_uuid;
END;
$$;


ALTER FUNCTION "public"."get_tenant_subproject_info"("tenant_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenant"("user_uuid" "uuid") RETURNS TABLE("tenant_id" "uuid", "tenant_name" character varying, "user_role" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
     BEGIN
         RETURN QUERY
         SELECT
             up.tenant_id,
             t.name,
             up.role
         FROM user_profiles up
         JOIN tenants t ON t.id = up.tenant_id
         WHERE up.id = user_uuid;
     END;
     $$;


ALTER FUNCTION "public"."get_user_tenant"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    new_tenant_id UUID;
    tenant_name TEXT;
BEGIN
    -- Get company name from metadata
    tenant_name := COALESCE(
        NEW.raw_user_meta_data->>'company_name',
        split_part(NEW.email, '@', 2)
    );
    
    -- Create tenant with ALL required fields
    INSERT INTO public.tenants (
        company_name, 
        subscription_status,
        subdomain,
        plan, 
        is_active,
        name
    )
    VALUES (
        tenant_name,
        'active',  -- Required field!
        LOWER(REGEXP_REPLACE(tenant_name, '[^a-z0-9]', '', 'g')),
        'basic', 
        true,
        tenant_name
    )
    RETURNING id INTO new_tenant_id;
    
    -- Create user profile
    INSERT INTO public.user_profiles (
        id, 
        tenant_id, 
        email, 
        first_name, 
        last_name, 
        role, 
        is_active
    )
    VALUES (
        NEW.id,
        new_tenant_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
        'admin',
        true
    );
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail signup
    RAISE WARNING 'Signup trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE admin_notifications 
    SET is_read = true, read_at = NOW()
    WHERE id = notification_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_subproject_credentials"("tenant_uuid" "uuid", "subproject_id" character varying, "subproject_token" "text", "subproject_space" character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE tenants 
    SET 
        signalwire_subproject_id = subproject_id,
        signalwire_subproject_token = subproject_token,
        signalwire_subproject_space = subproject_space,
        subproject_status = 'created',
        subproject_created_at = NOW(),
        subproject_error = NULL,
        subproject_retry_needed = false,
        updated_at = NOW()
    WHERE id = tenant_uuid;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."set_subproject_credentials"("tenant_uuid" "uuid", "subproject_id" character varying, "subproject_token" "text", "subproject_space" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."system_start_tracking_session"("p_job_id" "uuid", "p_technician_id" "uuid", "p_initial_latitude" numeric, "p_initial_longitude" numeric, "p_duration_hours" integer DEFAULT 4) RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    tracking_token VARCHAR(255);
    expires_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Generate a unique tracking token
    tracking_token := 'track_' || encode(gen_random_bytes(16), 'hex');
    
    -- Calculate expiration time
    expires_time := NOW() + (p_duration_hours || ' hours')::interval;
    
    -- Insert or update tracking session
    INSERT INTO job_technician_locations (
        job_id,
        user_id,
        technician_id,
        tracking_token,
        latitude,
        longitude,
        is_active,
        started_at,
        expires_at,
        last_updated,
        updated_at
    ) VALUES (
        p_job_id,
        p_technician_id,
        p_technician_id,
        tracking_token,
        p_initial_latitude,
        p_initial_longitude,
        true,
        NOW(),
        expires_time,
        NOW(),
        NOW()
    )
    ON CONFLICT (job_id, user_id) 
    DO UPDATE SET
        tracking_token = EXCLUDED.tracking_token,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_active = true,
        expires_at = EXCLUDED.expires_at,
        last_updated = NOW(),
        updated_at = NOW();
    
    -- Log the initial location
    INSERT INTO location_logs (
        job_id,
        user_id,
        tracking_token,
        latitude,
        longitude,
        logged_at,
        data_retention_category
    ) VALUES (
        p_job_id,
        p_technician_id,
        tracking_token,
        p_initial_latitude,
        p_initial_longitude,
        NOW(),
        'business_records'
    );
    
    RETURN tracking_token;
END;
$$;


ALTER FUNCTION "public"."system_start_tracking_session"("p_job_id" "uuid", "p_technician_id" "uuid", "p_initial_latitude" numeric, "p_initial_longitude" numeric, "p_duration_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."system_update_technician_location"("p_job_id" "uuid", "p_technician_id" "uuid", "p_tracking_token" character varying, "p_latitude" numeric, "p_longitude" numeric, "p_accuracy" numeric DEFAULT NULL::numeric, "p_speed" numeric DEFAULT NULL::numeric, "p_heading" integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Update the current tracking session
    UPDATE job_technician_locations 
    SET 
        latitude = p_latitude,
        longitude = p_longitude,
        last_updated = NOW(),
        updated_at = NOW()
    WHERE 
        job_id = p_job_id 
        AND user_id = p_technician_id 
        AND tracking_token = p_tracking_token
        AND is_active = true
        AND expires_at > NOW();
    
    -- Check if update was successful
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Log the location update
    INSERT INTO location_logs (
        job_id,
        user_id,
        tracking_token,
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        logged_at,
        data_retention_category
    ) VALUES (
        p_job_id,
        p_technician_id,
        p_tracking_token,
        p_latitude,
        p_longitude,
        p_speed,
        p_heading,
        p_accuracy,
        NOW(),
        'business_records'
    );
    
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."system_update_technician_location"("p_job_id" "uuid", "p_technician_id" "uuid", "p_tracking_token" character varying, "p_latitude" numeric, "p_longitude" numeric, "p_accuracy" numeric, "p_speed" numeric, "p_heading" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_calls_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Update answered_at when status changes to active
    IF NEW.status = 'active' AND OLD.status != 'active' THEN
        NEW.answered_at = NOW();
    END IF;
    
    -- Update ended_at when call ends
    IF NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status NOT IN ('completed', 'failed', 'cancelled') THEN
        NEW.ended_at = NOW();
        -- Calculate duration if answered_at exists
        IF NEW.answered_at IS NOT NULL THEN
            NEW.duration = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.answered_at))::INTEGER;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_calls_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_contacts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_contacts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_photos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_job_photos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subproject_status"("tenant_uuid" "uuid", "status" character varying, "error_message" "text" DEFAULT NULL::"text", "retry_needed" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE tenants 
    SET 
        subproject_status = status,
        subproject_error = error_message,
        subproject_retry_needed = retry_needed,
        updated_at = NOW()
    WHERE id = tenant_uuid;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_subproject_status"("tenant_uuid" "uuid", "status" character varying, "error_message" "text", "retry_needed" boolean) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address_line1" "text",
    "billing_address" "text",
    "account_status" character varying DEFAULT '''ACTIVE'''::character varying NOT NULL,
    "type" character varying(50),
    "industry" character varying(100),
    "phone" character varying(50),
    "email" character varying(255),
    "website" character varying(255),
    "address_line2" "text",
    "city" character varying(100),
    "state" character varying(100),
    "zip_code" character varying(20),
    "country" character varying(100),
    "notes" "text"
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "type" character varying(50) NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "severity" character varying(20) DEFAULT 'info'::character varying,
    "is_read" boolean DEFAULT false,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    CONSTRAINT "admin_notifications_severity_check" CHECK ((("severity")::"text" = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying, 'critical'::character varying])::"text"[]))),
    CONSTRAINT "admin_notifications_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['subproject_failed'::character varying, 'subproject_retry_needed'::character varying, 'system_alert'::character varying, 'billing_issue'::character varying])::"text"[])))
);


ALTER TABLE "public"."admin_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_notifications" IS 'Tracks administrative notifications including subproject creation failures';



CREATE TABLE IF NOT EXISTS "public"."call_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "contact_id" "uuid",
    "call_sid" "text" NOT NULL,
    "direction" character varying,
    "recording_url" "text",
    "is_read" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."call_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "call_sid" "text",
    "from_number" "text" NOT NULL,
    "to_number" "text" NOT NULL,
    "status" "text" DEFAULT 'ringing'::"text" NOT NULL,
    "direction" "text" NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "duration" integer DEFAULT 0,
    "recording_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "answered_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "contact_id" "uuid",
    "is_read" boolean DEFAULT false,
    "provider_id" "text",
    CONSTRAINT "calls_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."calls" OWNER TO "postgres";


COMMENT ON TABLE "public"."calls" IS 'Real-time call tracking for SignalWire voice calls and voicemail storage';



COMMENT ON COLUMN "public"."calls"."call_sid" IS 'SignalWire call ID (nullable until call is initiated)';



COMMENT ON COLUMN "public"."calls"."status" IS 'Call status: ringing, active, completed, failed, cancelled';



COMMENT ON COLUMN "public"."calls"."direction" IS 'Call direction: inbound or outbound';



COMMENT ON COLUMN "public"."calls"."duration" IS 'Call duration in seconds';



COMMENT ON COLUMN "public"."calls"."contact_id" IS 'Reference to the contact associated with this call';



COMMENT ON COLUMN "public"."calls"."is_read" IS 'Whether the voicemail has been read/played';



COMMENT ON COLUMN "public"."calls"."provider_id" IS 'Provider-specific identifier for the call';



CREATE OR REPLACE VIEW "public"."call_statistics" AS
 SELECT "calls"."tenant_id",
    "count"(*) AS "total_calls",
    "count"(*) FILTER (WHERE ("calls"."direction" = 'inbound'::"text")) AS "inbound_calls",
    "count"(*) FILTER (WHERE ("calls"."direction" = 'outbound'::"text")) AS "outbound_calls",
    "count"(*) FILTER (WHERE ("calls"."status" = 'completed'::"text")) AS "completed_calls",
    "count"(*) FILTER (WHERE ("calls"."status" = 'failed'::"text")) AS "failed_calls",
    "avg"("calls"."duration") FILTER (WHERE ("calls"."duration" > 0)) AS "avg_duration",
    "sum"("calls"."duration") AS "total_duration",
    "date_trunc"('day'::"text", "calls"."created_at") AS "call_date"
   FROM "public"."calls"
  GROUP BY "calls"."tenant_id", ("date_trunc"('day'::"text", "calls"."created_at"))
  ORDER BY ("date_trunc"('day'::"text", "calls"."created_at")) DESC;


ALTER TABLE "public"."call_statistics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "name" "text",
    "channel_type" character varying(50) DEFAULT 'group'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."chat_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "message_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_portal_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "last_accessed" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_portal_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "account_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "first_name" character varying(255),
    "last_name" character varying(255),
    "company" character varying(255),
    "job_title" character varying(255),
    "preferred_contact_method" character varying(50) DEFAULT 'phone'::character varying,
    "preferred_contact_time" character varying(100),
    "timezone" character varying(50) DEFAULT 'America/New_York'::character varying,
    "language_preference" character varying(10) DEFAULT 'en'::character varying,
    "address_line1" "text",
    "address_line2" "text",
    "city" character varying(100),
    "state" character varying(50),
    "zip_code" character varying(20),
    "country" character varying(2) DEFAULT 'US'::character varying,
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "communication_notes" "text",
    "ai_interaction_preferences" "jsonb" DEFAULT '{"allow_ai_scheduling": true, "requires_human_confirmation": false}'::"jsonb",
    "customer_lifetime_value" numeric(10,2) DEFAULT 0.00,
    "lead_source" character varying(100),
    "tags" "text"[],
    "referred_by" "uuid",
    "is_decision_maker" boolean DEFAULT true,
    "birthday" "date",
    "last_contacted_at" timestamp with time zone,
    "next_followup_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mobile" character varying(20),
    "title" character varying(100),
    "source" character varying DEFAULT 'manual'::character varying,
    "property_address" "text",
    "property_type" character varying,
    "project_interest" "text",
    "urgency" character varying,
    "budget_range" character varying,
    CONSTRAINT "contacts_preferred_contact_method_check" CHECK ((("preferred_contact_method")::"text" = ANY ((ARRAY['phone'::character varying, 'sms'::character varying, 'email'::character varying, 'any'::character varying])::"text"[])))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."contacts"."name" IS 'Full name (computed from first_name + last_name)';



COMMENT ON COLUMN "public"."contacts"."company" IS 'Company name if different from account';



COMMENT ON COLUMN "public"."contacts"."communication_notes" IS 'Free text field for special communication requirements or preferences';



COMMENT ON COLUMN "public"."contacts"."ai_interaction_preferences" IS 'JSON object storing AI interaction preferences like allow_ai_scheduling, requires_human_confirmation, etc.';



COMMENT ON COLUMN "public"."contacts"."customer_lifetime_value" IS 'Total revenue generated by this contact across all jobs/invoices';



COMMENT ON COLUMN "public"."contacts"."tags" IS 'Array of tags for categorization, e.g. {"vip", "commercial", "residential", "repeat_customer"}';



COMMENT ON COLUMN "public"."contacts"."mobile" IS 'Mobile phone number for contact';



COMMENT ON COLUMN "public"."contacts"."title" IS 'Job title or position';



CREATE OR REPLACE VIEW "public"."contacts_with_preferences" AS
 SELECT "c"."id",
    "c"."created_at",
    "c"."tenant_id",
    "c"."account_id",
    "c"."name",
    "c"."email",
    "c"."phone",
    "c"."first_name",
    "c"."last_name",
    "c"."company",
    "c"."job_title",
    "c"."preferred_contact_method",
    "c"."preferred_contact_time",
    "c"."timezone",
    "c"."language_preference",
    "c"."address_line1",
    "c"."address_line2",
    "c"."city",
    "c"."state",
    "c"."zip_code",
    "c"."country",
    "c"."latitude",
    "c"."longitude",
    "c"."communication_notes",
    "c"."ai_interaction_preferences",
    "c"."customer_lifetime_value",
    "c"."lead_source",
    "c"."tags",
    "c"."referred_by",
    "c"."is_decision_maker",
    "c"."birthday",
    "c"."last_contacted_at",
    "c"."next_followup_date",
    "c"."updated_at",
    COALESCE(((("c"."first_name")::"text" || ' '::"text") || ("c"."last_name")::"text"), "c"."name") AS "full_name",
        CASE
            WHEN ("c"."preferred_contact_time" IS NOT NULL) THEN "c"."preferred_contact_time"
            ELSE 'business_hours'::character varying
        END AS "contact_time_preference",
    COALESCE((("c"."ai_interaction_preferences" ->> 'allow_ai_scheduling'::"text"))::boolean, true) AS "allows_ai_scheduling"
   FROM "public"."contacts" "c";


ALTER TABLE "public"."contacts_with_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_approval_workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "cost_id" "uuid" NOT NULL,
    "workflow_step" integer DEFAULT 1 NOT NULL,
    "approver_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cost_approval_workflows_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."cost_approval_workflows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimate_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "estimate_id" "uuid",
    "estimate_tier_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "service_catalog_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit_price" numeric NOT NULL,
    "line_total" numeric NOT NULL,
    "item_type" character varying DEFAULT 'service'::character varying,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "estimate_line_items_check" CHECK ((("estimate_id" IS NOT NULL) OR ("estimate_tier_id" IS NOT NULL))),
    CONSTRAINT "estimate_line_items_item_type_check" CHECK ((("item_type")::"text" = ANY ((ARRAY['service'::character varying, 'material'::character varying, 'labor'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."estimate_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimate_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "template_type" character varying DEFAULT 'tiered'::character varying NOT NULL,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "service_type" "text",
    "category" "text",
    "pricing_tiers" "jsonb" DEFAULT '{}'::"jsonb",
    "line_items" "jsonb" DEFAULT '[]'::"jsonb",
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "usage_count" integer DEFAULT 0,
    CONSTRAINT "estimate_templates_template_type_check" CHECK ((("template_type")::"text" = ANY ((ARRAY['single'::character varying, 'tiered'::character varying])::"text"[])))
);


ALTER TABLE "public"."estimate_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimate_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "estimate_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "tier_level" character varying NOT NULL,
    "tier_name" "text" NOT NULL,
    "description" "text",
    "total_amount" numeric NOT NULL,
    "labor_cost" numeric DEFAULT 0.00,
    "material_cost" numeric DEFAULT 0.00,
    "markup_amount" numeric DEFAULT 0.00,
    "is_selected" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "estimate_tiers_tier_level_check" CHECK ((("tier_level")::"text" = ANY ((ARRAY['good'::character varying, 'better'::character varying, 'best'::character varying, 'custom'::character varying])::"text"[])))
);


ALTER TABLE "public"."estimate_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimate_variables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "estimate_id" "uuid" NOT NULL,
    "variable_name" "text" NOT NULL,
    "variable_value" "text",
    "variable_type" "text" NOT NULL,
    "affects_pricing" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."estimate_variables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "status" character varying DEFAULT '''Draft'''::character varying NOT NULL,
    "total_amount" numeric NOT NULL,
    "estimate_number" character varying,
    "project_title" "text",
    "description" "text",
    "valid_until" "date",
    "labor_cost" numeric DEFAULT 0.00,
    "material_cost" numeric DEFAULT 0.00,
    "markup_percentage" numeric DEFAULT 0.00,
    "notes" "text",
    "template_type" character varying,
    "signature_status" character varying DEFAULT 'pending'::character varying,
    "signed_at" timestamp with time zone,
    "signed_by_name" "text",
    "signature_ip_address" "inet",
    "template_id" "uuid",
    "selected_tier" "text",
    "custom_variables" "jsonb" DEFAULT '{}'::"jsonb",
    "created_from_template" boolean DEFAULT false,
    CONSTRAINT "estimates_signature_status_check" CHECK ((("signature_status")::"text" = ANY ((ARRAY['pending'::character varying, 'signed'::character varying, 'declined'::character varying])::"text"[]))),
    CONSTRAINT "estimates_template_type_check" CHECK ((("template_type")::"text" = ANY ((ARRAY['single'::character varying, 'tiered'::character varying])::"text"[])))
);


ALTER TABLE "public"."estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."homeowner_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "home_type" "text",
    "home_age" "text",
    "square_footage" integer,
    "lot_size" "text",
    "construction_type" "text",
    "portal_access_token" "text",
    "portal_slug" "text",
    "primary_contractor_id" "uuid",
    "contractor_access" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."homeowner_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit_price" numeric NOT NULL
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "payment_method" character varying NOT NULL,
    "amount" numeric NOT NULL,
    "payment_date" "date" NOT NULL,
    "transaction_id" "text",
    "processor" character varying,
    "processor_fee" numeric DEFAULT 0.00,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "invoice_payments_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['cash'::character varying, 'check'::character varying, 'credit_card'::character varying, 'bank_transfer'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."invoice_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "reminder_type" character varying NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone,
    "email_subject" "text",
    "email_body" "text",
    "status" character varying DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "invoice_reminders_reminder_type_check" CHECK ((("reminder_type")::"text" = ANY ((ARRAY['due_soon'::character varying, 'overdue_3'::character varying, 'overdue_15'::character varying, 'overdue_30'::character varying, 'final_notice'::character varying])::"text"[]))),
    CONSTRAINT "invoice_reminders_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."invoice_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "status" character varying DEFAULT '''Draft'''::character varying NOT NULL,
    "total_amount" numeric NOT NULL,
    "due_date" "date",
    "invoice_number" character varying,
    "project_title" "text",
    "description" "text",
    "subtotal" numeric DEFAULT 0.00,
    "tax_rate" numeric DEFAULT 0.00,
    "tax_amount" numeric DEFAULT 0.00,
    "discount_amount" numeric DEFAULT 0.00,
    "notes" "text",
    "payment_terms" character varying DEFAULT 'net_30'::character varying,
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "payment_status" character varying DEFAULT 'unpaid'::character varying,
    CONSTRAINT "invoices_payment_status_check" CHECK ((("payment_status")::"text" = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying, 'overdue'::character varying])::"text"[])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "budgeted_amount" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "alert_threshold" numeric(5,2) DEFAULT 80.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_cost_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "default_budget_percentage" numeric(5,2) DEFAULT 0.00,
    "color_code" "text" DEFAULT '#007bff'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_cost_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "cost_type" character varying NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric DEFAULT 1,
    "unit_cost" numeric NOT NULL,
    "total_cost" numeric NOT NULL,
    "cost_date" "date" NOT NULL,
    "receipt_url" "text",
    "vendor" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "receipt_data" "jsonb" DEFAULT '{}'::"jsonb",
    "vendor_name" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "job_costs_cost_type_check" CHECK ((("cost_type")::"text" = ANY ((ARRAY['labor'::character varying, 'material'::character varying, 'equipment'::character varying, 'subcontractor'::character varying, 'overhead'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "job_costs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."job_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_payment_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "milestone_name" "text" NOT NULL,
    "amount_due" numeric(10,2) NOT NULL,
    "due_date" "date",
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_payment_schedules_amount_due_check" CHECK (("amount_due" >= (0)::numeric))
);


ALTER TABLE "public"."job_payment_schedules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."job_payment_schedules"."job_id" IS 'Links this schedule to a specific job.';



COMMENT ON COLUMN "public"."job_payment_schedules"."invoice_id" IS 'A reference to the invoice created for this specific milestone.';



COMMENT ON COLUMN "public"."job_payment_schedules"."milestone_name" IS 'Description of the payment milestone (e.g., "Initial Deposit").';



CREATE TABLE IF NOT EXISTS "public"."job_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "cost_entry_id" "uuid",
    "photo_type" character varying NOT NULL,
    "file_path" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "description" "text",
    "latitude" numeric,
    "longitude" numeric,
    "taken_by" "uuid",
    "taken_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "job_photos_photo_type_check" CHECK ((("photo_type")::"text" = ANY ((ARRAY['receipt'::character varying, 'job_progress'::character varying, 'before'::character varying, 'after'::character varying, 'general'::character varying])::"text"[])))
);


ALTER TABLE "public"."job_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "status" character varying DEFAULT '''Scheduled'''::character varying NOT NULL,
    "description" "text",
    "start_date" timestamp with time zone,
    "job_number" character varying(50),
    "title" "text" NOT NULL,
    "priority" character varying(50) DEFAULT 'medium'::character varying,
    "due_date" timestamp with time zone,
    "estimated_hours" numeric,
    "actual_hours" numeric,
    "estimated_cost" numeric,
    "actual_cost" numeric,
    "location_address" "text",
    "location_city" character varying(100),
    "location_state" character varying(100),
    "location_zip" character varying(20),
    "notes" "text",
    "labor_hours_estimated" numeric DEFAULT 0,
    "labor_hours_actual" numeric DEFAULT 0,
    "labor_rate" numeric DEFAULT 0,
    "material_cost_estimated" numeric DEFAULT 0,
    "material_cost_actual" numeric DEFAULT 0,
    "overhead_percentage" numeric DEFAULT 0,
    "profit_margin_percentage" numeric DEFAULT 0,
    "total_invoiced" numeric DEFAULT 0,
    "project_template_id" "uuid",
    "project_data" "jsonb" DEFAULT '{}'::"jsonb",
    "total_budget" numeric(10,2) DEFAULT 0.00,
    "cost_tracking_enabled" boolean DEFAULT true,
    "budget_alert_threshold" numeric(5,2) DEFAULT 80.00
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" character varying,
    "first_name" "text",
    "last_name" "text",
    "is_active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."job_photos_view" AS
 SELECT "jp"."id",
    "jp"."tenant_id",
    "jp"."job_id",
    "jp"."cost_entry_id",
    "jp"."photo_type",
    "jp"."file_path",
    "jp"."file_url",
    "jp"."description",
    "jp"."latitude",
    "jp"."longitude",
    "jp"."taken_by",
    "jp"."taken_at",
    "jp"."created_at",
    "jp"."updated_at",
    "j"."job_number",
    "j"."title" AS "job_title",
    "jc"."description" AS "cost_description",
    "jc"."cost_type",
    COALESCE((("up"."first_name" || ' '::"text") || "up"."last_name"), 'Unknown User'::"text") AS "taken_by_name"
   FROM ((("public"."job_photos" "jp"
     LEFT JOIN "public"."jobs" "j" ON (("jp"."job_id" = "j"."id")))
     LEFT JOIN "public"."job_costs" "jc" ON (("jp"."cost_entry_id" = "jc"."id")))
     LEFT JOIN "public"."user_profiles" "up" ON (("jp"."taken_by" = "up"."id")));


ALTER TABLE "public"."job_photos_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_profitability_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "total_revenue" numeric(10,2) DEFAULT 0.00,
    "total_costs" numeric(10,2) DEFAULT 0.00,
    "gross_profit" numeric(10,2) DEFAULT 0.00,
    "profit_margin" numeric(5,2) DEFAULT 0.00,
    "labor_costs" numeric(10,2) DEFAULT 0.00,
    "material_costs" numeric(10,2) DEFAULT 0.00,
    "equipment_costs" numeric(10,2) DEFAULT 0.00,
    "subcontractor_costs" numeric(10,2) DEFAULT 0.00,
    "other_costs" numeric(10,2) DEFAULT 0.00,
    "budget_status" "text" DEFAULT 'on_track'::"text",
    "last_calculated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "job_profitability_snapshots_budget_status_check" CHECK (("budget_status" = ANY (ARRAY['on_track'::"text", 'warning'::"text", 'over_budget'::"text"])))
);


ALTER TABLE "public"."job_profitability_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_status_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "old_status" character varying(50),
    "new_status" character varying(50) NOT NULL,
    "status_notes" "text",
    "location_latitude" numeric,
    "location_longitude" numeric,
    "location_accuracy" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_status_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_technician_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tracking_token" "text" DEFAULT ("extensions"."uuid_generate_v4"())::"text" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '02:00:00'::interval) NOT NULL,
    "is_active" boolean DEFAULT true,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "technician_id" "uuid"
);


ALTER TABLE "public"."job_technician_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_technician_locations" IS 'Stores real-time location data for technicians on their way to a job, used for customer-facing tracking maps.';



COMMENT ON COLUMN "public"."job_technician_locations"."tracking_token" IS 'A unique, non-guessable token for the customer-facing URL.';



COMMENT ON COLUMN "public"."job_technician_locations"."expires_at" IS 'The timestamp when the tracking link automatically becomes invalid.';



CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "status" character varying DEFAULT '''New'''::character varying NOT NULL
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "job_id" "uuid",
    "tracking_token" character varying(255),
    "logged_at" timestamp with time zone DEFAULT "now"(),
    "speed" numeric,
    "heading" integer,
    "accuracy" numeric,
    "data_retention_category" character varying(50) DEFAULT 'business_records'::character varying,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."location_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "current_step" character varying DEFAULT 'welcome'::character varying NOT NULL,
    "completed_steps" "text"[] DEFAULT '{}'::"text"[],
    "onboarding_data" "jsonb" DEFAULT '{}'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."onboarding_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "account_id" "uuid",
    "name" "text" NOT NULL,
    "amount" numeric DEFAULT '0'::numeric,
    "stage" character varying DEFAULT '''Prospecting'''::character varying NOT NULL
);


ALTER TABLE "public"."opportunities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_processor_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "processor" character varying NOT NULL,
    "is_active" boolean DEFAULT false,
    "public_key" "text",
    "private_key_encrypted" "text",
    "webhook_secret_encrypted" "text",
    "processing_fee_percentage" numeric DEFAULT 2.9,
    "processing_fee_fixed" numeric DEFAULT 0.30,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_processor_settings_processor_check" CHECK ((("processor")::"text" = ANY ((ARRAY['stripe'::character varying, 'square'::character varying, 'paypal'::character varying])::"text"[])))
);


ALTER TABLE "public"."payment_processor_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "activity_type" character varying NOT NULL,
    "reference_id" "uuid",
    "details" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "portal_activity_log_activity_type_check" CHECK ((("activity_type")::"text" = ANY ((ARRAY['login'::character varying, 'view_estimate'::character varying, 'accept_estimate'::character varying, 'decline_estimate'::character varying, 'view_invoice'::character varying, 'pay_invoice'::character varying, 'comment'::character varying])::"text"[])))
);


ALTER TABLE "public"."portal_activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "user_id" "uuid",
    "reference_type" character varying NOT NULL,
    "reference_id" "uuid" NOT NULL,
    "comment_text" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "portal_comments_reference_type_check" CHECK ((("reference_type")::"text" = ANY ((ARRAY['estimate'::character varying, 'invoice'::character varying, 'job'::character varying])::"text"[])))
);


ALTER TABLE "public"."portal_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "service_type_id" "uuid",
    "name" character varying NOT NULL,
    "description" "text",
    "default_tasks" "jsonb",
    "default_milestones" "jsonb",
    "default_duration_days" integer,
    "required_fields" "jsonb",
    "is_global" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_add_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "service_type_id" "uuid",
    "name" character varying NOT NULL,
    "template_type" character varying NOT NULL,
    "form_fields" "jsonb" NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "quick_add_templates_template_type_check" CHECK ((("template_type")::"text" = ANY ((ARRAY['client'::character varying, 'project'::character varying, 'both'::character varying])::"text"[])))
);


ALTER TABLE "public"."quick_add_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "unit_type" character varying DEFAULT 'hour'::character varying NOT NULL,
    "default_rate" numeric NOT NULL,
    "labor_rate" numeric,
    "material_rate" numeric,
    "markup_percentage" numeric DEFAULT 0.00,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "service_catalog_unit_type_check" CHECK ((("unit_type")::"text" = ANY ((ARRAY['hour'::character varying, 'unit'::character varying, 'sq_ft'::character varying, 'linear_ft'::character varying, 'each'::character varying])::"text"[])))
);


ALTER TABLE "public"."service_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "parent_category_id" "uuid",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "code" character varying NOT NULL,
    "parent_id" "uuid",
    "description" "text",
    "default_workflow" "jsonb",
    "default_fields" "jsonb",
    "icon" character varying,
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signalwire_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "signalwire_sip_endpoint_id" "uuid",
    "sip_username" "text" NOT NULL,
    "sip_uri" "text" NOT NULL,
    "sip_password" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."signalwire_credentials" OWNER TO "postgres";


COMMENT ON TABLE "public"."signalwire_credentials" IS 'Stores SignalWire SIP credentials and identifiers for each user.';



COMMENT ON COLUMN "public"."signalwire_credentials"."user_id" IS 'Foreign key to the user this credential belongs to.';



COMMENT ON COLUMN "public"."signalwire_credentials"."tenant_id" IS 'Foreign key to the tenant this user belongs to.';



COMMENT ON COLUMN "public"."signalwire_credentials"."signalwire_sip_endpoint_id" IS 'The unique ID for the endpoint generated by SignalWire.';



COMMENT ON COLUMN "public"."signalwire_credentials"."sip_password" IS 'WARNING: Encrypt this value in production.';



CREATE TABLE IF NOT EXISTS "public"."signalwire_phone_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "number" character varying(20) NOT NULL,
    "signalwire_number_id" character varying(100),
    "country_code" character varying(5) DEFAULT '+1'::character varying NOT NULL,
    "area_code" character varying(10),
    "number_type" character varying(20) DEFAULT 'local'::character varying,
    "is_active" boolean DEFAULT true,
    "sms_enabled" boolean DEFAULT true,
    "voice_enabled" boolean DEFAULT true,
    "fax_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "purchased_at" timestamp with time zone DEFAULT "now"(),
    "released_at" timestamp with time zone,
    CONSTRAINT "valid_number_type" CHECK ((("number_type")::"text" = ANY ((ARRAY['local'::character varying, 'toll-free'::character varying, 'international'::character varying])::"text"[])))
);


ALTER TABLE "public"."signalwire_phone_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sip_call_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sip_config_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "call_id" character varying(100),
    "direction" character varying(10) NOT NULL,
    "from_number" character varying(20) NOT NULL,
    "to_number" character varying(20) NOT NULL,
    "call_status" character varying(20) NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "answer_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "duration_seconds" integer DEFAULT 0,
    "billable_seconds" integer DEFAULT 0,
    "cost_per_minute" numeric(6,4),
    "total_cost" numeric(8,4) DEFAULT 0.00,
    "caller_name" character varying(100),
    "recording_url" "text",
    "transcription" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_call_status" CHECK ((("call_status")::"text" = ANY ((ARRAY['ringing'::character varying, 'answered'::character varying, 'busy'::character varying, 'failed'::character varying, 'no-answer'::character varying, 'cancelled'::character varying])::"text"[]))),
    CONSTRAINT "valid_direction" CHECK ((("direction")::"text" = ANY ((ARRAY['inbound'::character varying, 'outbound'::character varying])::"text"[])))
);


ALTER TABLE "public"."sip_call_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sip_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sip_username" character varying(100) NOT NULL,
    "sip_password_encrypted" "text" NOT NULL,
    "sip_domain" character varying(255) NOT NULL,
    "sip_proxy" character varying(255) NOT NULL,
    "display_name" character varying(100),
    "signalwire_endpoint_id" character varying(100),
    "signalwire_project_id" character varying(100) NOT NULL,
    "is_active" boolean DEFAULT true,
    "service_plan" character varying(50) DEFAULT 'basic'::character varying,
    "primary_phone_number" character varying(20),
    "monthly_rate" numeric(10,2) DEFAULT 29.99,
    "per_minute_rate" numeric(6,4) DEFAULT 0.02,
    "included_minutes" integer DEFAULT 1000,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "activated_at" timestamp with time zone,
    "suspended_at" timestamp with time zone,
    "sip_endpoint_id" "text",
    "sip_profile_id" "text",
    CONSTRAINT "sip_configurations_service_plan_check" CHECK ((("service_plan")::"text" = ANY ((ARRAY['basic'::character varying, 'professional'::character varying, 'enterprise'::character varying])::"text"[])))
);


ALTER TABLE "public"."sip_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sip_usage_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sip_config_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "billing_period_start" "date" NOT NULL,
    "billing_period_end" "date" NOT NULL,
    "total_calls" integer DEFAULT 0,
    "total_minutes" integer DEFAULT 0,
    "inbound_calls" integer DEFAULT 0,
    "outbound_calls" integer DEFAULT 0,
    "inbound_minutes" integer DEFAULT 0,
    "outbound_minutes" integer DEFAULT 0,
    "base_monthly_cost" numeric(10,2) DEFAULT 0.00,
    "overage_minutes" integer DEFAULT 0,
    "overage_cost" numeric(10,2) DEFAULT 0.00,
    "total_cost" numeric(10,2) DEFAULT 0.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "calculated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sip_usage_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "from_number" "text" NOT NULL,
    "to_number" "text" NOT NULL,
    "body" "text" NOT NULL,
    "direction" character varying(50),
    "status" character varying(50),
    "provider_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sms_messages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."subproject_status_overview" AS
SELECT
    NULL::"uuid" AS "tenant_id",
    NULL::character varying(100) AS "tenant_name",
    NULL::character varying(100) AS "signalwire_subproject_id",
    NULL::character varying(20) AS "subproject_status",
    NULL::timestamp with time zone AS "subproject_created_at",
    NULL::"text" AS "subproject_error",
    NULL::boolean AS "subproject_retry_needed",
    NULL::bigint AS "notification_count";


ALTER TABLE "public"."subproject_status_overview" OWNER TO "postgres";


COMMENT ON VIEW "public"."subproject_status_overview" IS 'Overview of all tenant subproject statuses with notification counts';



CREATE TABLE IF NOT EXISTS "public"."template_usage_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "customer_id" "uuid",
    "customer_type" "text",
    "selected_tier" "text",
    "final_amount" numeric(10,2),
    "was_sent" boolean DEFAULT false,
    "was_accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."template_usage_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_phone_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "phone_number" character varying(50) NOT NULL,
    "provider" character varying(50) DEFAULT 'SignalWire'::character varying,
    "provider_id" "text",
    "capabilities" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_phone_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_name" "text" NOT NULL,
    "subscription_status" character varying NOT NULL,
    "subdomain" character varying(50),
    "plan" character varying(20) DEFAULT 'basic'::character varying,
    "is_active" boolean DEFAULT true,
    "name" character varying(100),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "service_type" character varying,
    "service_subtypes" "text"[],
    "onboarding_completed" boolean DEFAULT false,
    "workflow_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "business_info" "jsonb" DEFAULT '{}'::"jsonb",
    "signalwire_subproject_id" character varying(100),
    "signalwire_subproject_token" "text",
    "signalwire_subproject_space" character varying(255),
    "subproject_status" character varying(20) DEFAULT 'pending'::character varying,
    "subproject_created_at" timestamp with time zone,
    "subproject_error" "text",
    "subproject_retry_needed" boolean DEFAULT false,
    CONSTRAINT "check_plan" CHECK ((("plan")::"text" = ANY ((ARRAY['basic'::character varying, 'professional'::character varying, 'enterprise'::character varying])::"text"[]))),
    CONSTRAINT "tenants_subproject_status_check" CHECK ((("subproject_status")::"text" = ANY ((ARRAY['pending'::character varying, 'created'::character varying, 'failed'::character varying, 'retrying'::character varying])::"text"[])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tenants"."signalwire_subproject_id" IS 'SignalWire subproject ID for dedicated tenant resources';



COMMENT ON COLUMN "public"."tenants"."subproject_status" IS 'Status of subproject creation: pending, created, failed, retrying';



CREATE TABLE IF NOT EXISTS "public"."video_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "created_by_user_id" "uuid" NOT NULL,
    "room_url" "text" NOT NULL,
    "provider" character varying(50) DEFAULT 'SignalWire'::character varying,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "room_name" "text",
    "contact_id" "uuid"
);


ALTER TABLE "public"."video_meetings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_call_sid_key" UNIQUE ("call_sid");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_portal_tokens"
    ADD CONSTRAINT "client_portal_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_portal_tokens"
    ADD CONSTRAINT "client_portal_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_approval_workflows"
    ADD CONSTRAINT "cost_approval_workflows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimate_templates"
    ADD CONSTRAINT "estimate_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimate_tiers"
    ADD CONSTRAINT "estimate_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimate_variables"
    ADD CONSTRAINT "estimate_variables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homeowner_profiles"
    ADD CONSTRAINT "homeowner_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homeowner_profiles"
    ADD CONSTRAINT "homeowner_profiles_portal_access_token_key" UNIQUE ("portal_access_token");



ALTER TABLE ONLY "public"."homeowner_profiles"
    ADD CONSTRAINT "homeowner_profiles_portal_slug_key" UNIQUE ("portal_slug");



ALTER TABLE ONLY "public"."homeowner_profiles"
    ADD CONSTRAINT "homeowner_profiles_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_reminders"
    ADD CONSTRAINT "invoice_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_budgets"
    ADD CONSTRAINT "job_budgets_job_id_category_id_key" UNIQUE ("job_id", "category_id");



ALTER TABLE ONLY "public"."job_budgets"
    ADD CONSTRAINT "job_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_cost_categories"
    ADD CONSTRAINT "job_cost_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_cost_categories"
    ADD CONSTRAINT "job_cost_categories_tenant_id_name_key" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "job_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_payment_schedules"
    ADD CONSTRAINT "job_payment_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_photos"
    ADD CONSTRAINT "job_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_profitability_snapshots"
    ADD CONSTRAINT "job_profitability_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_status_updates"
    ADD CONSTRAINT "job_status_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_technician_locations"
    ADD CONSTRAINT "job_technician_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_technician_locations"
    ADD CONSTRAINT "job_technician_locations_tracking_token_key" UNIQUE ("tracking_token");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_logs"
    ADD CONSTRAINT "location_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_processor_settings"
    ADD CONSTRAINT "payment_processor_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_processor_settings"
    ADD CONSTRAINT "payment_processor_settings_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."portal_activity_log"
    ADD CONSTRAINT "portal_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_comments"
    ADD CONSTRAINT "portal_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_templates"
    ADD CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quick_add_templates"
    ADD CONSTRAINT "quick_add_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signalwire_credentials"
    ADD CONSTRAINT "signalwire_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signalwire_credentials"
    ADD CONSTRAINT "signalwire_credentials_sip_uri_key" UNIQUE ("sip_uri");



ALTER TABLE ONLY "public"."signalwire_credentials"
    ADD CONSTRAINT "signalwire_credentials_sip_username_key" UNIQUE ("sip_username");



ALTER TABLE ONLY "public"."signalwire_phone_numbers"
    ADD CONSTRAINT "signalwire_phone_numbers_number_key" UNIQUE ("number");



ALTER TABLE ONLY "public"."signalwire_phone_numbers"
    ADD CONSTRAINT "signalwire_phone_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signalwire_phone_numbers"
    ADD CONSTRAINT "signalwire_phone_numbers_signalwire_number_id_key" UNIQUE ("signalwire_number_id");



ALTER TABLE ONLY "public"."sip_call_logs"
    ADD CONSTRAINT "sip_call_logs_call_id_key" UNIQUE ("call_id");



ALTER TABLE ONLY "public"."sip_call_logs"
    ADD CONSTRAINT "sip_call_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sip_configurations"
    ADD CONSTRAINT "sip_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sip_configurations"
    ADD CONSTRAINT "sip_configurations_signalwire_endpoint_id_key" UNIQUE ("signalwire_endpoint_id");



ALTER TABLE ONLY "public"."sip_configurations"
    ADD CONSTRAINT "sip_configurations_sip_username_key" UNIQUE ("sip_username");



ALTER TABLE ONLY "public"."sip_usage_stats"
    ADD CONSTRAINT "sip_usage_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_usage_analytics"
    ADD CONSTRAINT "template_usage_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_phone_numbers"
    ADD CONSTRAINT "tenant_phone_numbers_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."tenant_phone_numbers"
    ADD CONSTRAINT "tenant_phone_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_subdomain_key" UNIQUE ("subdomain");



ALTER TABLE ONLY "public"."job_technician_locations"
    ADD CONSTRAINT "tracking_token_unique" UNIQUE ("tracking_token");



ALTER TABLE ONLY "public"."sip_usage_stats"
    ADD CONSTRAINT "unique_tenant_period" UNIQUE ("tenant_id", "billing_period_start", "billing_period_end");



ALTER TABLE ONLY "public"."sip_configurations"
    ADD CONSTRAINT "unique_tenant_sip" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_meetings"
    ADD CONSTRAINT "video_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_meetings"
    ADD CONSTRAINT "video_meetings_room_url_key" UNIQUE ("room_url");



CREATE INDEX "idx_admin_notifications_created_at" ON "public"."admin_notifications" USING "btree" ("created_at");



CREATE INDEX "idx_admin_notifications_tenant_id" ON "public"."admin_notifications" USING "btree" ("tenant_id");



CREATE INDEX "idx_admin_notifications_type" ON "public"."admin_notifications" USING "btree" ("type");



CREATE INDEX "idx_admin_notifications_unread" ON "public"."admin_notifications" USING "btree" ("is_read") WHERE ("is_read" = false);



CREATE UNIQUE INDEX "idx_calls_call_sid_unique" ON "public"."calls" USING "btree" ("call_sid") WHERE ("call_sid" IS NOT NULL);



CREATE INDEX "idx_calls_contact_id" ON "public"."calls" USING "btree" ("contact_id");



CREATE INDEX "idx_calls_created_at" ON "public"."calls" USING "btree" ("created_at");



CREATE INDEX "idx_calls_is_read" ON "public"."calls" USING "btree" ("is_read");



CREATE INDEX "idx_calls_provider_id" ON "public"."calls" USING "btree" ("provider_id");



CREATE INDEX "idx_calls_status" ON "public"."calls" USING "btree" ("status");



CREATE INDEX "idx_calls_tenant_id" ON "public"."calls" USING "btree" ("tenant_id");



CREATE INDEX "idx_calls_user_id" ON "public"."calls" USING "btree" ("user_id");



CREATE INDEX "idx_client_portal_tokens_token" ON "public"."client_portal_tokens" USING "btree" ("token");



CREATE INDEX "idx_contacts_company" ON "public"."contacts" USING "btree" ("company");



CREATE INDEX "idx_contacts_lead_source" ON "public"."contacts" USING "btree" ("lead_source");



CREATE INDEX "idx_contacts_mobile" ON "public"."contacts" USING "btree" ("mobile");



CREATE INDEX "idx_contacts_name" ON "public"."contacts" USING "btree" ("name");



CREATE INDEX "idx_contacts_next_followup" ON "public"."contacts" USING "btree" ("next_followup_date") WHERE ("next_followup_date" IS NOT NULL);



CREATE INDEX "idx_contacts_tags" ON "public"."contacts" USING "gin" ("tags");



CREATE INDEX "idx_contacts_title" ON "public"."contacts" USING "btree" ("title");



CREATE INDEX "idx_cost_approval_approver" ON "public"."cost_approval_workflows" USING "btree" ("approver_id");



CREATE INDEX "idx_cost_approval_cost" ON "public"."cost_approval_workflows" USING "btree" ("cost_id");



CREATE INDEX "idx_estimate_line_items_estimate_id" ON "public"."estimate_line_items" USING "btree" ("estimate_id");



CREATE INDEX "idx_estimate_line_items_tier_id" ON "public"."estimate_line_items" USING "btree" ("estimate_tier_id");



CREATE INDEX "idx_estimate_tiers_estimate_id" ON "public"."estimate_tiers" USING "btree" ("estimate_id");



CREATE INDEX "idx_homeowner_profiles_contractor_id" ON "public"."homeowner_profiles" USING "btree" ("primary_contractor_id");



CREATE INDEX "idx_homeowner_profiles_tenant_id" ON "public"."homeowner_profiles" USING "btree" ("tenant_id");



CREATE INDEX "idx_homeowner_profiles_user_id" ON "public"."homeowner_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_invoice_payments_invoice_id" ON "public"."invoice_payments" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_reminders_invoice_id" ON "public"."invoice_reminders" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_reminders_scheduled_for" ON "public"."invoice_reminders" USING "btree" ("scheduled_for");



CREATE INDEX "idx_job_budgets_tenant_job" ON "public"."job_budgets" USING "btree" ("tenant_id", "job_id");



CREATE INDEX "idx_job_cost_categories_tenant" ON "public"."job_cost_categories" USING "btree" ("tenant_id");



CREATE INDEX "idx_job_costs_category" ON "public"."job_costs" USING "btree" ("category_id");



CREATE INDEX "idx_job_costs_job_id" ON "public"."job_costs" USING "btree" ("job_id");



CREATE INDEX "idx_job_costs_status" ON "public"."job_costs" USING "btree" ("status");



CREATE INDEX "idx_job_costs_tenant_job" ON "public"."job_costs" USING "btree" ("tenant_id", "job_id");



CREATE INDEX "idx_job_photos_cost_entry_id" ON "public"."job_photos" USING "btree" ("cost_entry_id");



CREATE INDEX "idx_job_photos_job_id" ON "public"."job_photos" USING "btree" ("job_id");



CREATE INDEX "idx_job_photos_photo_type" ON "public"."job_photos" USING "btree" ("photo_type");



CREATE INDEX "idx_job_photos_taken_at" ON "public"."job_photos" USING "btree" ("taken_at" DESC);



CREATE INDEX "idx_job_photos_tenant_id" ON "public"."job_photos" USING "btree" ("tenant_id");



CREATE INDEX "idx_job_profitability_tenant_job" ON "public"."job_profitability_snapshots" USING "btree" ("tenant_id", "job_id");



CREATE INDEX "idx_job_status_updates_job_id" ON "public"."job_status_updates" USING "btree" ("job_id");



CREATE INDEX "idx_job_status_updates_tenant" ON "public"."job_status_updates" USING "btree" ("tenant_id");



CREATE INDEX "idx_job_status_updates_user" ON "public"."job_status_updates" USING "btree" ("user_id", "updated_at");



CREATE INDEX "idx_job_technician_locations_active" ON "public"."job_technician_locations" USING "btree" ("is_active", "expires_at");



CREATE INDEX "idx_job_technician_locations_job_id" ON "public"."job_technician_locations" USING "btree" ("job_id");



CREATE INDEX "idx_job_technician_locations_tracking_token" ON "public"."job_technician_locations" USING "btree" ("tracking_token");



CREATE INDEX "idx_job_technician_locations_user" ON "public"."job_technician_locations" USING "btree" ("user_id");



CREATE INDEX "idx_location_logs_job_id" ON "public"."location_logs" USING "btree" ("job_id");



CREATE INDEX "idx_location_logs_logged_at" ON "public"."location_logs" USING "btree" ("logged_at");



CREATE INDEX "idx_location_logs_tracking_token" ON "public"."location_logs" USING "btree" ("tracking_token");



CREATE INDEX "idx_location_logs_user_date" ON "public"."location_logs" USING "btree" ("user_id", "logged_at");



CREATE INDEX "idx_portal_activity_log_contact_id" ON "public"."portal_activity_log" USING "btree" ("contact_id");



CREATE INDEX "idx_service_catalog_category_id" ON "public"."service_catalog" USING "btree" ("category_id");



CREATE INDEX "idx_service_catalog_tenant_id" ON "public"."service_catalog" USING "btree" ("tenant_id");



CREATE INDEX "idx_signalwire_credentials_user_id" ON "public"."signalwire_credentials" USING "btree" ("user_id");



CREATE INDEX "idx_signalwire_phone_numbers_number" ON "public"."signalwire_phone_numbers" USING "btree" ("number");



CREATE INDEX "idx_signalwire_phone_numbers_tenant_id" ON "public"."signalwire_phone_numbers" USING "btree" ("tenant_id");



CREATE INDEX "idx_sip_call_logs_config_id" ON "public"."sip_call_logs" USING "btree" ("sip_config_id");



CREATE INDEX "idx_sip_call_logs_start_time" ON "public"."sip_call_logs" USING "btree" ("start_time");



CREATE INDEX "idx_sip_call_logs_tenant_id" ON "public"."sip_call_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_sip_configurations_active" ON "public"."sip_configurations" USING "btree" ("is_active");



CREATE INDEX "idx_sip_configurations_tenant_id" ON "public"."sip_configurations" USING "btree" ("tenant_id");



CREATE INDEX "idx_sip_configurations_username" ON "public"."sip_configurations" USING "btree" ("sip_username");



CREATE INDEX "idx_sip_usage_stats_tenant_period" ON "public"."sip_usage_stats" USING "btree" ("tenant_id", "billing_period_start");



CREATE INDEX "idx_tenants_active" ON "public"."tenants" USING "btree" ("is_active");



CREATE INDEX "idx_tenants_subdomain" ON "public"."tenants" USING "btree" ("subdomain");



CREATE INDEX "idx_tenants_subproject_id" ON "public"."tenants" USING "btree" ("signalwire_subproject_id");



CREATE INDEX "idx_tenants_subproject_status" ON "public"."tenants" USING "btree" ("subproject_status");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_user_profiles_tenant_id" ON "public"."user_profiles" USING "btree" ("tenant_id");



CREATE OR REPLACE VIEW "public"."subproject_status_overview" AS
 SELECT "t"."id" AS "tenant_id",
    "t"."name" AS "tenant_name",
    "t"."signalwire_subproject_id",
    "t"."subproject_status",
    "t"."subproject_created_at",
    "t"."subproject_error",
    "t"."subproject_retry_needed",
    "count"("an"."id") AS "notification_count"
   FROM ("public"."tenants" "t"
     LEFT JOIN "public"."admin_notifications" "an" ON ((("t"."id" = "an"."tenant_id") AND (("an"."type")::"text" ~~ 'subproject%'::"text") AND ("an"."is_read" = false))))
  GROUP BY "t"."id", "t"."name", "t"."signalwire_subproject_id", "t"."subproject_status", "t"."subproject_created_at", "t"."subproject_error", "t"."subproject_retry_needed"
  ORDER BY "t"."created_at" DESC;



CREATE OR REPLACE TRIGGER "on_new_tenant_create_sip_config" AFTER INSERT ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://eskpnhbemnxkxafjbbdx.supabase.co/functions/v1/create-sip-configuration', 'POST', '{"Content-type":"application/json","Authorization":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVza3BuaGJlbW54a3hhZmpiYmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDEyODgwMSwiZXhwIjoyMDY1NzA0ODAxfQ.BIv89edKtXvHRsgPoYTrhTAHbBEsvEGRX-trN7VHdNU"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "trigger_calls_updated_at" BEFORE UPDATE ON "public"."calls" FOR EACH ROW EXECUTE FUNCTION "public"."update_calls_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_job_photos_updated_at" BEFORE UPDATE ON "public"."job_photos" FOR EACH ROW EXECUTE FUNCTION "public"."update_job_photos_updated_at"();



CREATE OR REPLACE TRIGGER "update_contacts_updated_at_trigger" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_contacts_updated_at"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_portal_tokens"
    ADD CONSTRAINT "client_portal_tokens_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."client_portal_tokens"
    ADD CONSTRAINT "client_portal_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."cost_approval_workflows"
    ADD CONSTRAINT "cost_approval_workflows_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_approval_workflows"
    ADD CONSTRAINT "cost_approval_workflows_cost_id_fkey" FOREIGN KEY ("cost_id") REFERENCES "public"."job_costs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_approval_workflows"
    ADD CONSTRAINT "cost_approval_workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_service_fkey" FOREIGN KEY ("service_catalog_id") REFERENCES "public"."service_catalog"("id");



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_tier_id_fkey" FOREIGN KEY ("estimate_tier_id") REFERENCES "public"."estimate_tiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_templates"
    ADD CONSTRAINT "estimate_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."estimate_tiers"
    ADD CONSTRAINT "estimate_tiers_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_tiers"
    ADD CONSTRAINT "estimate_tiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."estimate_variables"
    ADD CONSTRAINT "estimate_variables_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_variables"
    ADD CONSTRAINT "estimate_variables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "fk_estimates_template_id" FOREIGN KEY ("template_id") REFERENCES "public"."estimate_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_budgets"
    ADD CONSTRAINT "fk_job_budgets_category_id" FOREIGN KEY ("category_id") REFERENCES "public"."job_cost_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_budgets"
    ADD CONSTRAINT "fk_job_budgets_job_id" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "fk_job_costs_category_id" FOREIGN KEY ("category_id") REFERENCES "public"."job_cost_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "fk_job_costs_job_id" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_profitability_snapshots"
    ADD CONSTRAINT "fk_job_profitability_job_id" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_status_updates"
    ADD CONSTRAINT "fk_job_status_updates_job_id" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_technician_locations"
    ADD CONSTRAINT "fk_job_technician_locations_job_id" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_logs"
    ADD CONSTRAINT "fk_location_logs_job_id" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_technician_locations"
    ADD CONSTRAINT "fk_technician_id" FOREIGN KEY ("technician_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homeowner_profiles"
    ADD CONSTRAINT "homeowner_profiles_primary_contractor_id_fkey" FOREIGN KEY ("primary_contractor_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."homeowner_profiles"
    ADD CONSTRAINT "homeowner_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homeowner_profiles"
    ADD CONSTRAINT "homeowner_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."invoice_reminders"
    ADD CONSTRAINT "invoice_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."invoice_reminders"
    ADD CONSTRAINT "invoice_reminders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."job_budgets"
    ADD CONSTRAINT "job_budgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_cost_categories"
    ADD CONSTRAINT "job_cost_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "job_costs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "job_costs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."job_costs"
    ADD CONSTRAINT "job_costs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."job_payment_schedules"
    ADD CONSTRAINT "job_payment_schedules_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_payment_schedules"
    ADD CONSTRAINT "job_payment_schedules_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_payment_schedules"
    ADD CONSTRAINT "job_payment_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_photos"
    ADD CONSTRAINT "job_photos_cost_entry_id_fkey" FOREIGN KEY ("cost_entry_id") REFERENCES "public"."job_costs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_photos"
    ADD CONSTRAINT "job_photos_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_photos"
    ADD CONSTRAINT "job_photos_taken_by_fkey" FOREIGN KEY ("taken_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_photos"
    ADD CONSTRAINT "job_photos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_profitability_snapshots"
    ADD CONSTRAINT "job_profitability_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_status_updates"
    ADD CONSTRAINT "job_status_updates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."job_status_updates"
    ADD CONSTRAINT "job_status_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_technician_locations"
    ADD CONSTRAINT "job_technician_locations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_technician_locations"
    ADD CONSTRAINT "job_technician_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_technician_locations"
    ADD CONSTRAINT "job_technician_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_project_template_fkey" FOREIGN KEY ("project_template_id") REFERENCES "public"."project_templates"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."location_logs"
    ADD CONSTRAINT "location_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."location_logs"
    ADD CONSTRAINT "location_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."payment_processor_settings"
    ADD CONSTRAINT "payment_processor_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."portal_activity_log"
    ADD CONSTRAINT "portal_activity_log_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."portal_activity_log"
    ADD CONSTRAINT "portal_activity_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."portal_comments"
    ADD CONSTRAINT "portal_comments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."portal_comments"
    ADD CONSTRAINT "portal_comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."portal_comments"
    ADD CONSTRAINT "portal_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."project_templates"
    ADD CONSTRAINT "project_templates_service_type_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."project_templates"
    ADD CONSTRAINT "project_templates_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."quick_add_templates"
    ADD CONSTRAINT "quick_add_templates_service_type_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."quick_add_templates"
    ADD CONSTRAINT "quick_add_templates_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_category_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_parent_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "public"."service_categories"("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_parent_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."service_types"("id");



ALTER TABLE ONLY "public"."signalwire_credentials"
    ADD CONSTRAINT "signalwire_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signalwire_credentials"
    ADD CONSTRAINT "signalwire_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signalwire_phone_numbers"
    ADD CONSTRAINT "signalwire_phone_numbers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sip_call_logs"
    ADD CONSTRAINT "sip_call_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sip_call_logs"
    ADD CONSTRAINT "sip_call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sip_configurations"
    ADD CONSTRAINT "sip_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sip_usage_stats"
    ADD CONSTRAINT "sip_usage_stats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_usage_analytics"
    ADD CONSTRAINT "template_usage_analytics_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."estimate_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_usage_analytics"
    ADD CONSTRAINT "template_usage_analytics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_usage_analytics"
    ADD CONSTRAINT "template_usage_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_phone_numbers"
    ADD CONSTRAINT "tenant_phone_numbers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."video_meetings"
    ADD CONSTRAINT "video_meetings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."video_meetings"
    ADD CONSTRAINT "video_meetings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_meetings"
    ADD CONSTRAINT "video_meetings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."video_meetings"
    ADD CONSTRAINT "video_meetings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



CREATE POLICY "Admin users can delete their tenant's payment schedules" ON "public"."job_payment_schedules" FOR DELETE USING ((("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))) AND ((( SELECT "user_profiles"."role"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())))::"text" = 'admin'::"text")));



CREATE POLICY "Admins can manage SIP configurations for their tenant" ON "public"."sip_configurations" USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND (("user_profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'owner'::character varying])::"text"[]))))));



CREATE POLICY "Admins can update their own tenant" ON "public"."tenants" FOR UPDATE USING ((("id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))) AND ((( SELECT "user_profiles"."role"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())))::"text" = 'admin'::"text")));



CREATE POLICY "Admins can view all location logs" ON "public"."location_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND (("user_profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'owner'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view all notifications" ON "public"."admin_notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND (("user_profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'owner'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view all status updates" ON "public"."job_status_updates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND (("user_profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'owner'::character varying])::"text"[]))))));



CREATE POLICY "Allow all authenticated users to insert tenants" ON "public"."tenants" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users to manage phone numbers" ON "public"."signalwire_phone_numbers" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users to manage sip configs" ON "public"."sip_configurations" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users to select phone numbers" ON "public"."signalwire_phone_numbers" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users to select sip configs" ON "public"."sip_configurations" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users to select tenants" ON "public"."tenants" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users to select user_profiles" ON "public"."user_profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users to update tenants" ON "public"."tenants" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow users to insert their own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Allow users to update their own profile" ON "public"."user_profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can insert tracking data" ON "public"."job_technician_locations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Contractors can view assigned homeowner profiles" ON "public"."homeowner_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tenants"
  WHERE (("tenants"."id" = ( SELECT "user_profiles"."tenant_id"
           FROM "public"."user_profiles"
          WHERE ("user_profiles"."id" = "auth"."uid"()))) AND (("tenants"."id" = "homeowner_profiles"."tenant_id") OR ("tenants"."id" = "homeowner_profiles"."primary_contractor_id") OR (("tenants"."id")::"text" IN ( SELECT "jsonb_array_elements_text"("homeowner_profiles"."contractor_access") AS "jsonb_array_elements_text")))))));



CREATE POLICY "Cost approval workflows are tenant-isolated" ON "public"."cost_approval_workflows" USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Job budgets are tenant-isolated" ON "public"."job_budgets" USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Job cost categories are tenant-isolated" ON "public"."job_cost_categories" USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Job costs are tenant-isolated" ON "public"."job_costs" USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Job profitability snapshots are tenant-isolated" ON "public"."job_profitability_snapshots" USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Public read access with tracking token" ON "public"."job_technician_locations" FOR SELECT USING ((("is_active" = true) AND ("expires_at" > "now"()) AND ("tracking_token" IS NOT NULL)));



CREATE POLICY "Service role can manage all SIP configurations" ON "public"."sip_configurations" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all calls" ON "public"."calls" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all notifications" ON "public"."admin_notifications" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all phone numbers" ON "public"."signalwire_phone_numbers" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service types are viewable by everyone" ON "public"."service_types" FOR SELECT USING (true);



CREATE POLICY "So users can delete their accounts" ON "public"."accounts" FOR DELETE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "System can insert call logs" ON "public"."sip_call_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Technicians can insert status updates" ON "public"."job_status_updates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Technicians can update their own location" ON "public"."job_technician_locations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Technicians can view their own location history" ON "public"."location_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Technicians can view their own status updates" ON "public"."job_status_updates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Tenant can view their own payment schedules" ON "public"."job_payment_schedules" FOR SELECT USING (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Tenants can manage their own phone numbers" ON "public"."tenant_phone_numbers" USING (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can access messages in their tenant's channels" ON "public"."chat_messages" USING (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can access their tenant's chat channels" ON "public"."chat_channels" USING (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can create accounts for their own tenant" ON "public"."accounts" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create call logs for their own tenant" ON "public"."call_logs" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create contacts for their own tenant" ON "public"."contacts" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create estimates for their own tenant" ON "public"."estimates" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create invoice items for their own tenant" ON "public"."invoice_items" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create invoices for their own tenant" ON "public"."invoices" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create jobs for their own tenant" ON "public"."jobs" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create leads for their own tenant" ON "public"."leads" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create opportunities for their own tenant" ON "public"."opportunities" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can create their own location logs" ON "public"."location_logs" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can delete contacts for their own tenant" ON "public"."contacts" FOR DELETE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can delete estimates for their own tenant" ON "public"."estimates" FOR DELETE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can delete invoice items for their own tenant" ON "public"."invoice_items" FOR DELETE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can delete invoices for their own tenant" ON "public"."invoices" FOR DELETE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can delete jobs for their own tenant" ON "public"."jobs" FOR DELETE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can delete leads for their own tenant" ON "public"."leads" FOR DELETE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can insert calls for their tenant" ON "public"."calls" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own homeowner profile" ON "public"."homeowner_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert payment schedules for their tenant" ON "public"."job_payment_schedules" FOR INSERT WITH CHECK (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage participants in their tenant's channels" ON "public"."chat_participants" USING (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their tenant onboarding progress" ON "public"."onboarding_progress" USING (("auth"."uid"() IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."tenant_id" = "onboarding_progress"."tenant_id"))));



CREATE POLICY "Users can manage their tenant project templates" ON "public"."project_templates" USING ((("is_global" = false) AND ("auth"."uid"() IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."tenant_id" = "project_templates"."tenant_id")))));



CREATE POLICY "Users can manage their tenant quick add templates" ON "public"."quick_add_templates" USING (("auth"."uid"() IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."tenant_id" = "quick_add_templates"."tenant_id"))));



CREATE POLICY "Users can manage their tenant's sms messages" ON "public"."sms_messages" USING (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their tenant's video meetings" ON "public"."video_meetings" USING (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can only view their own location logs" ON "public"."location_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update calls for their tenant" ON "public"."calls" FOR UPDATE USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update contacts for their own tenant" ON "public"."contacts" FOR UPDATE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can update estimates for their own tenant" ON "public"."estimates" FOR UPDATE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can update invoice items for their own tenant" ON "public"."invoice_items" FOR UPDATE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can update invoices for their own tenant" ON "public"."invoices" FOR UPDATE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can update jobs for their own tenant" ON "public"."jobs" FOR UPDATE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can update leads for their own tenant" ON "public"."leads" FOR UPDATE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can update opportunities for their own tenant" ON "public"."opportunities" FOR UPDATE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can update own homeowner profile" ON "public"."homeowner_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tenant accounts" ON "public"."accounts" FOR UPDATE USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can update their tenant's payment schedules" ON "public"."job_payment_schedules" FOR UPDATE USING (("tenant_id" = ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view call logs for their own tenant" ON "public"."call_logs" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view calls for their tenant" ON "public"."calls" FOR SELECT USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view contacts for their own tenant" ON "public"."contacts" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view estimates for their own tenant" ON "public"."estimates" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view global and tenant project templates" ON "public"."project_templates" FOR SELECT USING ((("is_global" = true) OR ("auth"."uid"() IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."tenant_id" = "project_templates"."tenant_id")))));



CREATE POLICY "Users can view invoice items for their own tenant" ON "public"."invoice_items" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view invoices for their own tenant" ON "public"."invoices" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view jobs for their own tenant" ON "public"."jobs" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view leads for their own tenant" ON "public"."leads" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view opportunities for their own tenant" ON "public"."opportunities" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view own homeowner profile" ON "public"."homeowner_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own tenant accounts" ON "public"."accounts" FOR SELECT USING ((( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = "tenant_id"));



CREATE POLICY "Users can view their tenant onboarding progress" ON "public"."onboarding_progress" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."tenant_id" = "onboarding_progress"."tenant_id"))));



CREATE POLICY "Users can view their tenant quick add templates" ON "public"."quick_add_templates" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_profiles"."id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."tenant_id" = "quick_add_templates"."tenant_id"))));



CREATE POLICY "Users can view their tenant's SIP configuration" ON "public"."sip_configurations" FOR SELECT USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their tenant's call logs" ON "public"."sip_call_logs" FOR SELECT USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their tenant's phone numbers" ON "public"."signalwire_phone_numbers" FOR SELECT USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their tenant's usage stats" ON "public"."sip_usage_stats" FOR SELECT USING (("tenant_id" IN ( SELECT "user_profiles"."tenant_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_portal_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_portal_tokens_tenant_policy" ON "public"."client_portal_tokens" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_approval_workflows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estimate_line_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimate_line_items_tenant_policy" ON "public"."estimate_line_items" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."estimate_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimate_templates_tenant_policy" ON "public"."estimate_templates" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."estimate_tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimate_tiers_tenant_policy" ON "public"."estimate_tiers" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."estimate_variables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estimates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."homeowner_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_payments_tenant_policy" ON "public"."invoice_payments" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."invoice_reminders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_reminders_tenant_policy" ON "public"."invoice_reminders" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_cost_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_costs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_costs_tenant_policy" ON "public"."job_costs" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."job_payment_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_photos_tenant_isolation" ON "public"."job_photos" TO "authenticated" USING (("tenant_id" = ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."job_profitability_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_status_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_technician_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_processor_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_processor_settings_tenant_policy" ON "public"."payment_processor_settings" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."portal_activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_activity_log_tenant_policy" ON "public"."portal_activity_log" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."portal_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_comments_tenant_policy" ON "public"."portal_comments" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."project_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quick_add_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_catalog_tenant_policy" ON "public"."service_catalog" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_categories_tenant_policy" ON "public"."service_categories" USING (("tenant_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'tenant_id'::"text"))::"uuid"));



ALTER TABLE "public"."service_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signalwire_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signalwire_phone_numbers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sip_call_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sip_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sip_usage_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_usage_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_phone_numbers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_meetings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."calls";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."job_technician_locations";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


















































































































































































































GRANT ALL ON FUNCTION "public"."calculate_sip_usage"("tenant_uuid" "uuid", "period_start" "date", "period_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_sip_usage"("tenant_uuid" "uuid", "period_start" "date", "period_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_sip_usage"("tenant_uuid" "uuid", "period_start" "date", "period_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_admin_notification"("p_tenant_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_severity" character varying, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_admin_notification"("p_tenant_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_severity" character varying, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_admin_notification"("p_tenant_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_severity" character varying, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_sip_config"("tenant_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_sip_config"("tenant_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_sip_config"("tenant_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_subproject_info"("tenant_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_subproject_info"("tenant_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_subproject_info"("tenant_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenant"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenant"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenant"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_subproject_credentials"("tenant_uuid" "uuid", "subproject_id" character varying, "subproject_token" "text", "subproject_space" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."set_subproject_credentials"("tenant_uuid" "uuid", "subproject_id" character varying, "subproject_token" "text", "subproject_space" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_subproject_credentials"("tenant_uuid" "uuid", "subproject_id" character varying, "subproject_token" "text", "subproject_space" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."system_start_tracking_session"("p_job_id" "uuid", "p_technician_id" "uuid", "p_initial_latitude" numeric, "p_initial_longitude" numeric, "p_duration_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."system_start_tracking_session"("p_job_id" "uuid", "p_technician_id" "uuid", "p_initial_latitude" numeric, "p_initial_longitude" numeric, "p_duration_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."system_start_tracking_session"("p_job_id" "uuid", "p_technician_id" "uuid", "p_initial_latitude" numeric, "p_initial_longitude" numeric, "p_duration_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."system_update_technician_location"("p_job_id" "uuid", "p_technician_id" "uuid", "p_tracking_token" character varying, "p_latitude" numeric, "p_longitude" numeric, "p_accuracy" numeric, "p_speed" numeric, "p_heading" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."system_update_technician_location"("p_job_id" "uuid", "p_technician_id" "uuid", "p_tracking_token" character varying, "p_latitude" numeric, "p_longitude" numeric, "p_accuracy" numeric, "p_speed" numeric, "p_heading" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."system_update_technician_location"("p_job_id" "uuid", "p_technician_id" "uuid", "p_tracking_token" character varying, "p_latitude" numeric, "p_longitude" numeric, "p_accuracy" numeric, "p_speed" numeric, "p_heading" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_calls_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_calls_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_calls_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contacts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_contacts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contacts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_photos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_job_photos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_job_photos_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subproject_status"("tenant_uuid" "uuid", "status" character varying, "error_message" "text", "retry_needed" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_subproject_status"("tenant_uuid" "uuid", "status" character varying, "error_message" "text", "retry_needed" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subproject_status"("tenant_uuid" "uuid", "status" character varying, "error_message" "text", "retry_needed" boolean) TO "service_role";


















GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."admin_notifications" TO "anon";
GRANT ALL ON TABLE "public"."admin_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."call_logs" TO "anon";
GRANT ALL ON TABLE "public"."call_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."call_logs" TO "service_role";



GRANT ALL ON TABLE "public"."calls" TO "anon";
GRANT ALL ON TABLE "public"."calls" TO "authenticated";
GRANT ALL ON TABLE "public"."calls" TO "service_role";



GRANT ALL ON TABLE "public"."call_statistics" TO "anon";
GRANT ALL ON TABLE "public"."call_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."call_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."chat_channels" TO "anon";
GRANT ALL ON TABLE "public"."chat_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_channels" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."client_portal_tokens" TO "anon";
GRANT ALL ON TABLE "public"."client_portal_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."client_portal_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."contacts_with_preferences" TO "anon";
GRANT ALL ON TABLE "public"."contacts_with_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts_with_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."cost_approval_workflows" TO "anon";
GRANT ALL ON TABLE "public"."cost_approval_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_approval_workflows" TO "service_role";



GRANT ALL ON TABLE "public"."estimate_line_items" TO "anon";
GRANT ALL ON TABLE "public"."estimate_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."estimate_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."estimate_templates" TO "anon";
GRANT ALL ON TABLE "public"."estimate_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."estimate_templates" TO "service_role";



GRANT ALL ON TABLE "public"."estimate_tiers" TO "anon";
GRANT ALL ON TABLE "public"."estimate_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."estimate_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."estimate_variables" TO "anon";
GRANT ALL ON TABLE "public"."estimate_variables" TO "authenticated";
GRANT ALL ON TABLE "public"."estimate_variables" TO "service_role";



GRANT ALL ON TABLE "public"."estimates" TO "anon";
GRANT ALL ON TABLE "public"."estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."estimates" TO "service_role";



GRANT ALL ON TABLE "public"."homeowner_profiles" TO "anon";
GRANT ALL ON TABLE "public"."homeowner_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."homeowner_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_payments" TO "anon";
GRANT ALL ON TABLE "public"."invoice_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_payments" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_reminders" TO "anon";
GRANT ALL ON TABLE "public"."invoice_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."job_budgets" TO "anon";
GRANT ALL ON TABLE "public"."job_budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."job_budgets" TO "service_role";



GRANT ALL ON TABLE "public"."job_cost_categories" TO "anon";
GRANT ALL ON TABLE "public"."job_cost_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."job_cost_categories" TO "service_role";



GRANT ALL ON TABLE "public"."job_costs" TO "anon";
GRANT ALL ON TABLE "public"."job_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_costs" TO "service_role";



GRANT ALL ON TABLE "public"."job_payment_schedules" TO "anon";
GRANT ALL ON TABLE "public"."job_payment_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."job_payment_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."job_photos" TO "anon";
GRANT ALL ON TABLE "public"."job_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."job_photos" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."job_photos_view" TO "anon";
GRANT ALL ON TABLE "public"."job_photos_view" TO "authenticated";
GRANT ALL ON TABLE "public"."job_photos_view" TO "service_role";



GRANT ALL ON TABLE "public"."job_profitability_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."job_profitability_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."job_profitability_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."job_status_updates" TO "anon";
GRANT ALL ON TABLE "public"."job_status_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."job_status_updates" TO "service_role";



GRANT ALL ON TABLE "public"."job_technician_locations" TO "anon";
GRANT ALL ON TABLE "public"."job_technician_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."job_technician_locations" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."location_logs" TO "anon";
GRANT ALL ON TABLE "public"."location_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."location_logs" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_progress" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_progress" TO "service_role";



GRANT ALL ON TABLE "public"."opportunities" TO "anon";
GRANT ALL ON TABLE "public"."opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunities" TO "service_role";



GRANT ALL ON TABLE "public"."payment_processor_settings" TO "anon";
GRANT ALL ON TABLE "public"."payment_processor_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_processor_settings" TO "service_role";



GRANT ALL ON TABLE "public"."portal_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."portal_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."portal_comments" TO "anon";
GRANT ALL ON TABLE "public"."portal_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_comments" TO "service_role";



GRANT ALL ON TABLE "public"."project_templates" TO "anon";
GRANT ALL ON TABLE "public"."project_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_templates" TO "service_role";



GRANT ALL ON TABLE "public"."quick_add_templates" TO "anon";
GRANT ALL ON TABLE "public"."quick_add_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_add_templates" TO "service_role";



GRANT ALL ON TABLE "public"."service_catalog" TO "anon";
GRANT ALL ON TABLE "public"."service_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."service_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."service_types" TO "anon";
GRANT ALL ON TABLE "public"."service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."service_types" TO "service_role";



GRANT ALL ON TABLE "public"."signalwire_credentials" TO "anon";
GRANT ALL ON TABLE "public"."signalwire_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."signalwire_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."signalwire_phone_numbers" TO "anon";
GRANT ALL ON TABLE "public"."signalwire_phone_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."signalwire_phone_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."sip_call_logs" TO "anon";
GRANT ALL ON TABLE "public"."sip_call_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sip_call_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sip_configurations" TO "anon";
GRANT ALL ON TABLE "public"."sip_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."sip_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."sip_usage_stats" TO "anon";
GRANT ALL ON TABLE "public"."sip_usage_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."sip_usage_stats" TO "service_role";



GRANT ALL ON TABLE "public"."sms_messages" TO "anon";
GRANT ALL ON TABLE "public"."sms_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_messages" TO "service_role";



GRANT ALL ON TABLE "public"."subproject_status_overview" TO "anon";
GRANT ALL ON TABLE "public"."subproject_status_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."subproject_status_overview" TO "service_role";



GRANT ALL ON TABLE "public"."template_usage_analytics" TO "anon";
GRANT ALL ON TABLE "public"."template_usage_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."template_usage_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_phone_numbers" TO "anon";
GRANT ALL ON TABLE "public"."tenant_phone_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_phone_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."video_meetings" TO "anon";
GRANT ALL ON TABLE "public"."video_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."video_meetings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
