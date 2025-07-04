drop trigger if exists "update_job_documents_updated_at" on "public"."job_documents";

drop trigger if exists "update_system_notification_templates_updated_at" on "public"."system_notification_templates";

drop policy "Users can delete job documents for their tenant" on "public"."job_documents";

drop policy "Users can update job documents for their tenant" on "public"."job_documents";

drop policy "Users can upload job documents for their tenant" on "public"."job_documents";

drop policy "Users can view job documents for their tenant" on "public"."job_documents";

drop policy "service_role_job_documents_access" on "public"."job_documents";

drop policy "Users can manage activity logs for their tenant" on "public"."portal_activity_log";

drop policy "Admins can view all notifications" on "public"."admin_notifications";

drop policy "Admins can view all status updates" on "public"."job_status_updates";

drop policy "Admins can view all location logs" on "public"."location_logs";

drop policy "Admins can manage SIP configurations for their tenant" on "public"."sip_configurations";

revoke delete on table "public"."job_documents" from "anon";

revoke insert on table "public"."job_documents" from "anon";

revoke references on table "public"."job_documents" from "anon";

revoke select on table "public"."job_documents" from "anon";

revoke trigger on table "public"."job_documents" from "anon";

revoke truncate on table "public"."job_documents" from "anon";

revoke update on table "public"."job_documents" from "anon";

revoke delete on table "public"."job_documents" from "authenticated";

revoke insert on table "public"."job_documents" from "authenticated";

revoke references on table "public"."job_documents" from "authenticated";

revoke select on table "public"."job_documents" from "authenticated";

revoke trigger on table "public"."job_documents" from "authenticated";

revoke truncate on table "public"."job_documents" from "authenticated";

revoke update on table "public"."job_documents" from "authenticated";

revoke delete on table "public"."job_documents" from "service_role";

revoke insert on table "public"."job_documents" from "service_role";

revoke references on table "public"."job_documents" from "service_role";

revoke select on table "public"."job_documents" from "service_role";

revoke trigger on table "public"."job_documents" from "service_role";

revoke truncate on table "public"."job_documents" from "service_role";

revoke update on table "public"."job_documents" from "service_role";

revoke delete on table "public"."system_notification_templates" from "anon";

revoke insert on table "public"."system_notification_templates" from "anon";

revoke references on table "public"."system_notification_templates" from "anon";

revoke select on table "public"."system_notification_templates" from "anon";

revoke trigger on table "public"."system_notification_templates" from "anon";

revoke truncate on table "public"."system_notification_templates" from "anon";

revoke update on table "public"."system_notification_templates" from "anon";

revoke delete on table "public"."system_notification_templates" from "authenticated";

revoke insert on table "public"."system_notification_templates" from "authenticated";

revoke references on table "public"."system_notification_templates" from "authenticated";

revoke select on table "public"."system_notification_templates" from "authenticated";

revoke trigger on table "public"."system_notification_templates" from "authenticated";

revoke truncate on table "public"."system_notification_templates" from "authenticated";

revoke update on table "public"."system_notification_templates" from "authenticated";

revoke delete on table "public"."system_notification_templates" from "service_role";

revoke insert on table "public"."system_notification_templates" from "service_role";

revoke references on table "public"."system_notification_templates" from "service_role";

revoke select on table "public"."system_notification_templates" from "service_role";

revoke trigger on table "public"."system_notification_templates" from "service_role";

revoke truncate on table "public"."system_notification_templates" from "service_role";

revoke update on table "public"."system_notification_templates" from "service_role";

alter table "public"."job_documents" drop constraint "job_documents_ai_analysis_status_check";

alter table "public"."job_documents" drop constraint "job_documents_document_type_check";

alter table "public"."job_documents" drop constraint "job_documents_job_id_fkey";

alter table "public"."job_documents" drop constraint "job_documents_tenant_id_fkey";

alter table "public"."job_documents" drop constraint "job_documents_uploaded_by_fkey";

alter table "public"."leads" drop constraint "leads_status_check";

alter table "public"."notification_templates" drop constraint "notification_templates_system_template_id_fkey";

alter table "public"."property_data" drop constraint "property_data_attom_id_key";

alter table "public"."system_notification_templates" drop constraint "system_notification_templates_category_check";

alter table "public"."system_notification_templates" drop constraint "system_notification_templates_template_name_key";

alter table "public"."system_notification_templates" drop constraint "system_notification_templates_template_type_check";

alter table "public"."admin_notifications" drop constraint "admin_notifications_severity_check";

alter table "public"."admin_notifications" drop constraint "admin_notifications_type_check";

alter table "public"."contacts" drop constraint "contacts_preferred_contact_method_check";

alter table "public"."estimate_line_items" drop constraint "estimate_line_items_item_type_check";

alter table "public"."estimate_templates" drop constraint "estimate_templates_template_type_check";

alter table "public"."estimate_tiers" drop constraint "estimate_tiers_tier_level_check";

alter table "public"."estimates" drop constraint "estimates_signature_status_check";

alter table "public"."estimates" drop constraint "estimates_template_type_check";

alter table "public"."invoice_payments" drop constraint "invoice_payments_payment_method_check";

alter table "public"."invoice_reminders" drop constraint "invoice_reminders_reminder_type_check";

alter table "public"."invoice_reminders" drop constraint "invoice_reminders_status_check";

alter table "public"."invoices" drop constraint "invoices_payment_status_check";

alter table "public"."job_activity_log" drop constraint "job_activity_log_activity_category_check";

alter table "public"."job_activity_log" drop constraint "job_activity_log_activity_type_check";

alter table "public"."job_costs" drop constraint "job_costs_cost_type_check";

alter table "public"."payment_processor_settings" drop constraint "payment_processor_settings_processor_check";

alter table "public"."portal_comments" drop constraint "portal_comments_reference_type_check";

alter table "public"."quick_add_templates" drop constraint "quick_add_templates_template_type_check";

alter table "public"."service_catalog" drop constraint "service_catalog_unit_type_check";

alter table "public"."signalwire_phone_numbers" drop constraint "valid_number_type";

alter table "public"."sip_call_logs" drop constraint "valid_call_status";

alter table "public"."sip_call_logs" drop constraint "valid_direction";

alter table "public"."sip_configurations" drop constraint "sip_configurations_service_plan_check";

alter table "public"."tenants" drop constraint "check_plan";

alter table "public"."tenants" drop constraint "tenants_subproject_status_check";

drop view if exists "public"."all_notification_templates";

drop function if exists "public"."calculate_property_score"(property_row property_data);

drop function if exists "public"."copy_system_template_to_tenant"(p_tenant_id uuid, p_system_template_id uuid);

drop view if exists "public"."contacts_with_preferences";

alter table "public"."job_documents" drop constraint "job_documents_pkey";

alter table "public"."system_notification_templates" drop constraint "system_notification_templates_pkey";

drop index if exists "public"."idx_client_portal_tokens_is_active";

drop index if exists "public"."idx_job_documents_ai_status";

drop index if exists "public"."idx_job_documents_created_at";

drop index if exists "public"."idx_job_documents_document_type";

drop index if exists "public"."idx_job_documents_job_id";

drop index if exists "public"."idx_job_documents_tenant_id";

drop index if exists "public"."idx_job_documents_uploaded_by";

drop index if exists "public"."idx_portal_activity_log_activity_type";

drop index if exists "public"."idx_portal_activity_log_created_at";

drop index if exists "public"."idx_property_data_attom_onboard";

drop index if exists "public"."idx_property_data_owner_name";

drop index if exists "public"."idx_property_data_parcel_number";

drop index if exists "public"."idx_property_data_school_district";

drop index if exists "public"."idx_system_notification_templates_category";

drop index if exists "public"."job_documents_pkey";

drop index if exists "public"."property_data_attom_id_key";

drop index if exists "public"."system_notification_templates_pkey";

drop index if exists "public"."system_notification_templates_template_name_key";

drop table "public"."job_documents";

drop table "public"."system_notification_templates";

create table "public"."lead_reminders" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid not null,
    "lead_id" uuid,
    "reminder_type" character varying(50),
    "scheduled_date" timestamp with time zone,
    "status" character varying(20) default 'pending'::character varying,
    "message" text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."lead_reminders" enable row level security;

alter table "public"."accounts" add column "updated_at" timestamp with time zone;

alter table "public"."contacts" add column "is_primary" boolean default false;

alter table "public"."contacts" add column "notes" character varying;

alter table "public"."estimates" add column "updated_at" timestamp with time zone;

alter table "public"."jobs" add column "assigned_technician_id" uuid;

alter table "public"."jobs" add column "lead_id" uuid;

alter table "public"."jobs" add column "updated_at" timestamp with time zone;

alter table "public"."leads" drop column "name";

alter table "public"."leads" drop column "phone";

alter table "public"."leads" add column "caller_name" text not null;

alter table "public"."leads" add column "converted_to_job_id" uuid;

alter table "public"."leads" add column "estimated_value" numeric(10,2);

alter table "public"."leads" add column "follow_up_date" timestamp with time zone;

alter table "public"."leads" add column "initial_request" text not null;

alter table "public"."leads" add column "lead_source" character varying(100) not null;

alter table "public"."leads" add column "notes" text;

alter table "public"."leads" add column "phone_number" text;

alter table "public"."leads" add column "updated_at" timestamp with time zone default now();

alter table "public"."leads" add column "urgency" character varying(20) default 'medium'::character varying;

alter table "public"."leads" alter column "status" set default '''New'''::character varying;

alter table "public"."notification_templates" drop column "system_template_id";

alter table "public"."property_data" drop column "air_quality_score";

alter table "public"."property_data" drop column "annual_tax_amount";

alter table "public"."property_data" drop column "attom_subdivison_name";

alter table "public"."property_data" drop column "attom_zoning";

alter table "public"."property_data" drop column "census_tract";

alter table "public"."property_data" drop column "crime_risk_score";

alter table "public"."property_data" drop column "deed_date";

alter table "public"."property_data" drop column "deed_type";

alter table "public"."property_data" drop column "demographic_data";

alter table "public"."property_data" drop column "elementary_school";

alter table "public"."property_data" drop column "environmental_data";

alter table "public"."property_data" drop column "flood_zone";

alter table "public"."property_data" drop column "flooring";

alter table "public"."property_data" drop column "foreclosure_history";

alter table "public"."property_data" drop column "high_school";

alter table "public"."property_data" drop column "legal_description";

alter table "public"."property_data" drop column "liens";

alter table "public"."property_data" drop column "middle_school";

alter table "public"."property_data" drop column "mortgage_amount";

alter table "public"."property_data" drop column "mortgage_date";

alter table "public"."property_data" drop column "natural_hazard_risk";

alter table "public"."property_data" drop column "neighborhood_name";

alter table "public"."property_data" drop column "noise_score";

alter table "public"."property_data" drop column "owner_name";

alter table "public"."property_data" drop column "owner_occupied";

alter table "public"."property_data" drop column "permits";

alter table "public"."property_data" drop column "property_use_code";

alter table "public"."property_data" drop column "rental_estimates";

alter table "public"."property_data" drop column "sale_transaction_type";

alter table "public"."property_data" drop column "school_district";

alter table "public"."property_data" drop column "tax_history";

alter table "public"."property_data" drop column "violations";

alter table "public"."property_data" drop column "walkability_score";

alter table "public"."sip_configurations" add column "notes" character varying;

alter table "public"."workflow_rules" add column "entity_type" text;

alter table "public"."workflow_rules" add column "trigger_event" text;

CREATE INDEX idx_accounts_tenant_type ON public.accounts USING btree (tenant_id, type);

CREATE INDEX idx_automated_reminders_entity ON public.automated_reminders USING btree (entity_type, entity_id);

CREATE INDEX idx_automated_reminders_tenant_remind_at ON public.automated_reminders USING btree (tenant_id, remind_at, active);

CREATE INDEX idx_notification_preferences_user_category ON public.notification_preferences USING btree (user_id, category);

CREATE INDEX idx_notification_templates_category ON public.notification_templates USING btree (category, active);

CREATE INDEX idx_notification_templates_tenant_type ON public.notification_templates USING btree (tenant_id, template_type, active);

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);

CREATE INDEX idx_notifications_entity ON public.notifications USING btree (entity_type, entity_id);

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_type, recipient_id);

CREATE INDEX idx_notifications_tenant_status ON public.notifications USING btree (tenant_id, status);

CREATE INDEX idx_notifications_type_category ON public.notifications USING btree (notification_type, category);

CREATE INDEX idx_tenants_onboarding_completed ON public.tenants USING btree (onboarding_completed);

CREATE INDEX idx_workflow_executions_entity ON public.workflow_executions USING btree (entity_type, entity_id);

CREATE INDEX idx_workflow_executions_rule_id ON public.workflow_executions USING btree (workflow_rule_id);

CREATE INDEX idx_workflow_executions_tenant_status ON public.workflow_executions USING btree (tenant_id, status);

CREATE INDEX idx_workflow_rules_tenant_entity ON public.workflow_rules USING btree (tenant_id, entity_type, active);

CREATE INDEX idx_workflow_rules_trigger_event ON public.workflow_rules USING btree (trigger_event, active);

CREATE UNIQUE INDEX lead_reminders_pkey ON public.lead_reminders USING btree (id);

CREATE UNIQUE INDEX unique_tenant_company_account ON public.accounts USING btree (tenant_id, type);

alter table "public"."lead_reminders" add constraint "lead_reminders_pkey" PRIMARY KEY using index "lead_reminders_pkey";

alter table "public"."accounts" add constraint "fk_accounts_tenant" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE not valid;

alter table "public"."accounts" validate constraint "fk_accounts_tenant";

alter table "public"."accounts" add constraint "unique_tenant_company_account" UNIQUE using index "unique_tenant_company_account";

alter table "public"."estimates" add constraint "estimates_client_type_check" CHECK ((((account_id IS NOT NULL) AND (contact_id IS NULL)) OR ((account_id IS NULL) AND (contact_id IS NOT NULL)))) not valid;

alter table "public"."estimates" validate constraint "estimates_client_type_check";

alter table "public"."jobs" add constraint "jobs_assigned_technician_id_fkey" FOREIGN KEY (assigned_technician_id) REFERENCES user_profiles(id) not valid;

alter table "public"."jobs" validate constraint "jobs_assigned_technician_id_fkey";

alter table "public"."jobs" add constraint "jobs_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id) not valid;

alter table "public"."jobs" validate constraint "jobs_lead_id_fkey";

alter table "public"."lead_reminders" add constraint "lead_reminders_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE not valid;

alter table "public"."lead_reminders" validate constraint "lead_reminders_tenant_id_fkey";

alter table "public"."leads" add constraint "leads_converted_to_job_id_fkey" FOREIGN KEY (converted_to_job_id) REFERENCES jobs(id) not valid;

alter table "public"."leads" validate constraint "leads_converted_to_job_id_fkey";

alter table "public"."signalwire_phone_numbers" add constraint "fk_signalwire_phone_numbers_tenant" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE not valid;

alter table "public"."signalwire_phone_numbers" validate constraint "fk_signalwire_phone_numbers_tenant";

alter table "public"."admin_notifications" add constraint "admin_notifications_severity_check" CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying, 'critical'::character varying])::text[]))) not valid;

alter table "public"."admin_notifications" validate constraint "admin_notifications_severity_check";

alter table "public"."admin_notifications" add constraint "admin_notifications_type_check" CHECK (((type)::text = ANY ((ARRAY['subproject_failed'::character varying, 'subproject_retry_needed'::character varying, 'system_alert'::character varying, 'billing_issue'::character varying])::text[]))) not valid;

alter table "public"."admin_notifications" validate constraint "admin_notifications_type_check";

alter table "public"."contacts" add constraint "contacts_preferred_contact_method_check" CHECK (((preferred_contact_method)::text = ANY ((ARRAY['phone'::character varying, 'sms'::character varying, 'email'::character varying, 'any'::character varying])::text[]))) not valid;

alter table "public"."contacts" validate constraint "contacts_preferred_contact_method_check";

alter table "public"."estimate_line_items" add constraint "estimate_line_items_item_type_check" CHECK (((item_type)::text = ANY ((ARRAY['service'::character varying, 'material'::character varying, 'labor'::character varying, 'other'::character varying])::text[]))) not valid;

alter table "public"."estimate_line_items" validate constraint "estimate_line_items_item_type_check";

alter table "public"."estimate_templates" add constraint "estimate_templates_template_type_check" CHECK (((template_type)::text = ANY ((ARRAY['single'::character varying, 'tiered'::character varying])::text[]))) not valid;

alter table "public"."estimate_templates" validate constraint "estimate_templates_template_type_check";

alter table "public"."estimate_tiers" add constraint "estimate_tiers_tier_level_check" CHECK (((tier_level)::text = ANY ((ARRAY['good'::character varying, 'better'::character varying, 'best'::character varying, 'custom'::character varying])::text[]))) not valid;

alter table "public"."estimate_tiers" validate constraint "estimate_tiers_tier_level_check";

alter table "public"."estimates" add constraint "estimates_signature_status_check" CHECK (((signature_status)::text = ANY ((ARRAY['pending'::character varying, 'signed'::character varying, 'declined'::character varying])::text[]))) not valid;

alter table "public"."estimates" validate constraint "estimates_signature_status_check";

alter table "public"."estimates" add constraint "estimates_template_type_check" CHECK (((template_type)::text = ANY ((ARRAY['single'::character varying, 'tiered'::character varying])::text[]))) not valid;

alter table "public"."estimates" validate constraint "estimates_template_type_check";

alter table "public"."invoice_payments" add constraint "invoice_payments_payment_method_check" CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'check'::character varying, 'credit_card'::character varying, 'bank_transfer'::character varying, 'other'::character varying])::text[]))) not valid;

alter table "public"."invoice_payments" validate constraint "invoice_payments_payment_method_check";

alter table "public"."invoice_reminders" add constraint "invoice_reminders_reminder_type_check" CHECK (((reminder_type)::text = ANY ((ARRAY['due_soon'::character varying, 'overdue_3'::character varying, 'overdue_15'::character varying, 'overdue_30'::character varying, 'final_notice'::character varying])::text[]))) not valid;

alter table "public"."invoice_reminders" validate constraint "invoice_reminders_reminder_type_check";

alter table "public"."invoice_reminders" add constraint "invoice_reminders_status_check" CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[]))) not valid;

alter table "public"."invoice_reminders" validate constraint "invoice_reminders_status_check";

alter table "public"."invoices" add constraint "invoices_payment_status_check" CHECK (((payment_status)::text = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying, 'overdue'::character varying])::text[]))) not valid;

alter table "public"."invoices" validate constraint "invoices_payment_status_check";

alter table "public"."job_activity_log" add constraint "job_activity_log_activity_category_check" CHECK (((activity_category)::text = ANY ((ARRAY['system'::character varying, 'user'::character varying, 'customer'::character varying, 'technician'::character varying, 'admin'::character varying])::text[]))) not valid;

alter table "public"."job_activity_log" validate constraint "job_activity_log_activity_category_check";

alter table "public"."job_activity_log" add constraint "job_activity_log_activity_type_check" CHECK (((activity_type)::text = ANY ((ARRAY['job_created'::character varying, 'estimate_created'::character varying, 'estimate_sent'::character varying, 'estimate_viewed'::character varying, 'estimate_accepted'::character varying, 'estimate_declined'::character varying, 'work_started'::character varying, 'work_completed'::character varying, 'work_paused'::character varying, 'photo_uploaded'::character varying, 'note_added'::character varying, 'status_changed'::character varying, 'payment_received'::character varying, 'invoice_created'::character varying, 'invoice_sent'::character varying, 'technician_assigned'::character varying, 'location_update'::character varying, 'call_made'::character varying, 'sms_sent'::character varying, 'other'::character varying])::text[]))) not valid;

alter table "public"."job_activity_log" validate constraint "job_activity_log_activity_type_check";

alter table "public"."job_costs" add constraint "job_costs_cost_type_check" CHECK (((cost_type)::text = ANY ((ARRAY['labor'::character varying, 'material'::character varying, 'equipment'::character varying, 'subcontractor'::character varying, 'overhead'::character varying, 'other'::character varying])::text[]))) not valid;

alter table "public"."job_costs" validate constraint "job_costs_cost_type_check";

alter table "public"."payment_processor_settings" add constraint "payment_processor_settings_processor_check" CHECK (((processor)::text = ANY ((ARRAY['stripe'::character varying, 'square'::character varying, 'paypal'::character varying])::text[]))) not valid;

alter table "public"."payment_processor_settings" validate constraint "payment_processor_settings_processor_check";

alter table "public"."portal_comments" add constraint "portal_comments_reference_type_check" CHECK (((reference_type)::text = ANY ((ARRAY['estimate'::character varying, 'invoice'::character varying, 'job'::character varying])::text[]))) not valid;

alter table "public"."portal_comments" validate constraint "portal_comments_reference_type_check";

alter table "public"."quick_add_templates" add constraint "quick_add_templates_template_type_check" CHECK (((template_type)::text = ANY ((ARRAY['client'::character varying, 'project'::character varying, 'both'::character varying])::text[]))) not valid;

alter table "public"."quick_add_templates" validate constraint "quick_add_templates_template_type_check";

alter table "public"."service_catalog" add constraint "service_catalog_unit_type_check" CHECK (((unit_type)::text = ANY ((ARRAY['hour'::character varying, 'unit'::character varying, 'sq_ft'::character varying, 'linear_ft'::character varying, 'each'::character varying])::text[]))) not valid;

alter table "public"."service_catalog" validate constraint "service_catalog_unit_type_check";

alter table "public"."signalwire_phone_numbers" add constraint "valid_number_type" CHECK (((number_type)::text = ANY ((ARRAY['local'::character varying, 'toll-free'::character varying, 'international'::character varying])::text[]))) not valid;

alter table "public"."signalwire_phone_numbers" validate constraint "valid_number_type";

alter table "public"."sip_call_logs" add constraint "valid_call_status" CHECK (((call_status)::text = ANY ((ARRAY['ringing'::character varying, 'answered'::character varying, 'busy'::character varying, 'failed'::character varying, 'no-answer'::character varying, 'cancelled'::character varying])::text[]))) not valid;

alter table "public"."sip_call_logs" validate constraint "valid_call_status";

alter table "public"."sip_call_logs" add constraint "valid_direction" CHECK (((direction)::text = ANY ((ARRAY['inbound'::character varying, 'outbound'::character varying])::text[]))) not valid;

alter table "public"."sip_call_logs" validate constraint "valid_direction";

alter table "public"."sip_configurations" add constraint "sip_configurations_service_plan_check" CHECK (((service_plan)::text = ANY ((ARRAY['basic'::character varying, 'professional'::character varying, 'enterprise'::character varying])::text[]))) not valid;

alter table "public"."sip_configurations" validate constraint "sip_configurations_service_plan_check";

alter table "public"."tenants" add constraint "check_plan" CHECK (((plan)::text = ANY ((ARRAY['basic'::character varying, 'professional'::character varying, 'enterprise'::character varying])::text[]))) not valid;

alter table "public"."tenants" validate constraint "check_plan";

alter table "public"."tenants" add constraint "tenants_subproject_status_check" CHECK (((subproject_status)::text = ANY ((ARRAY['pending'::character varying, 'created'::character varying, 'failed'::character varying, 'retrying'::character varying])::text[]))) not valid;

alter table "public"."tenants" validate constraint "tenants_subproject_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_create_company_account()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
      -- When onboarding is completed, create the company account
      IF NEW.onboarding_completed = true AND
         OLD.onboarding_completed = false THEN

          INSERT INTO accounts (
              tenant_id,
              name,
              type,
              industry,
              account_status,
              created_at
          ) VALUES (
              NEW.id,
              NEW.company_name,
              'company',
              NEW.service_type,
              'ACTIVE',
              NOW()
          ) ON CONFLICT (tenant_id, type) DO UPDATE
          SET
              name = EXCLUDED.name,
              industry = EXCLUDED.industry;
      END IF;

      RETURN NEW;
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.auto_provision_phone_numbers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
      -- Check if business_info contains a selected_phone
      IF NEW.onboarding_completed = true AND
         OLD.onboarding_completed = false AND
         NEW.business_info->>'selected_phone' IS NOT NULL THEN

          -- Insert the selected phone number into signalwire_phone_numbers
          INSERT INTO signalwire_phone_numbers (
              tenant_id,
              number,
              country_code,
              area_code,
              number_type,
              is_active,
              sms_enabled,
              voice_enabled,
              fax_enabled,
              created_at,
              purchased_at
          ) VALUES (
              NEW.id,
              NEW.business_info->>'selected_phone',
              '+1',
              SUBSTRING(NEW.business_info->>'selected_phone' FROM 3 FOR 3),
              'local',
              true,
              true,
              true,
              false,
              NOW(),
              NOW()
          ) ON CONFLICT (number) DO NOTHING;
      END IF;

      RETURN NEW;
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.manually_provision_phone_number(p_tenant_id uuid, p_phone_number text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
  BEGIN
      INSERT INTO signalwire_phone_numbers (
          tenant_id,
          number,
          country_code,
          area_code,
          number_type,
          is_active,
          sms_enabled,
          voice_enabled,
          fax_enabled,
          created_at,
          purchased_at
      )
      SELECT
          p_tenant_id,
          p_phone_number,
          '+1',
          SUBSTRING(p_phone_number FROM 3 FOR 3),
          'local',
          true,
          true,
          true,
          false,
          NOW(),
          NOW()
      FROM tenants t
      WHERE t.id = p_tenant_id
      ON CONFLICT (number) DO NOTHING;
  END;
  $function$
;

create or replace view "public"."v_tenant_phone_overview" as  SELECT t.id AS tenant_id,
    t.company_name,
    t.onboarding_completed,
    (t.business_info ->> 'selected_phone'::text) AS selected_phone_during_onboarding,
    a.phone AS business_contact_phone,
    a.email AS business_email,
    a.address_line1 AS business_address,
    spn.id AS signalwire_phone_id,
    spn.number AS signalwire_number,
    spn.number_type AS signalwire_number_type,
    spn.is_active AS signalwire_active,
    spn.sms_enabled,
    spn.voice_enabled,
    spn.fax_enabled,
    spn.purchased_at AS signalwire_provisioned_at
   FROM ((tenants t
     LEFT JOIN accounts a ON (((a.tenant_id = t.id) AND ((a.type)::text = 'company'::text))))
     LEFT JOIN signalwire_phone_numbers spn ON (((spn.tenant_id = t.id) AND (spn.is_active = true))))
  ORDER BY t.created_at DESC;


create or replace view "public"."contacts_with_preferences" as  SELECT c.id,
    c.created_at,
    c.tenant_id,
    c.account_id,
    c.name,
    c.email,
    c.phone,
    c.first_name,
    c.last_name,
    c.company,
    c.job_title,
    c.preferred_contact_method,
    c.preferred_contact_time,
    c.timezone,
    c.language_preference,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.zip_code,
    c.country,
    c.latitude,
    c.longitude,
    c.communication_notes,
    c.ai_interaction_preferences,
    c.customer_lifetime_value,
    c.lead_source,
    c.tags,
    c.referred_by,
    c.is_decision_maker,
    c.birthday,
    c.last_contacted_at,
    c.next_followup_date,
    c.updated_at,
    COALESCE((((c.first_name)::text || ' '::text) || (c.last_name)::text), c.name) AS full_name,
        CASE
            WHEN (c.preferred_contact_time IS NOT NULL) THEN c.preferred_contact_time
            ELSE 'business_hours'::character varying
        END AS contact_time_preference,
    COALESCE(((c.ai_interaction_preferences ->> 'allow_ai_scheduling'::text))::boolean, true) AS allows_ai_scheduling
   FROM contacts c;


CREATE OR REPLACE FUNCTION public.normalize_address_for_attom(address_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    RETURN regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(
                            upper(trim(address_text)),
                            '\s+', ' ', 'g'
                        ),
                        '\bSTREET\b', 'ST', 'g'
                    ),
                    '\bAVENUE\b', 'AVE', 'g'
                ),
                '\bROAD\b', 'RD', 'g'
            ),
            '\bDRIVE\b', 'DR', 'g'
        ),
        '\bLANE\b', 'LN', 'g'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_property_data_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."lead_reminders" to "anon";

grant insert on table "public"."lead_reminders" to "anon";

grant references on table "public"."lead_reminders" to "anon";

grant select on table "public"."lead_reminders" to "anon";

grant trigger on table "public"."lead_reminders" to "anon";

grant truncate on table "public"."lead_reminders" to "anon";

grant update on table "public"."lead_reminders" to "anon";

grant delete on table "public"."lead_reminders" to "authenticated";

grant insert on table "public"."lead_reminders" to "authenticated";

grant references on table "public"."lead_reminders" to "authenticated";

grant select on table "public"."lead_reminders" to "authenticated";

grant trigger on table "public"."lead_reminders" to "authenticated";

grant truncate on table "public"."lead_reminders" to "authenticated";

grant update on table "public"."lead_reminders" to "authenticated";

grant delete on table "public"."lead_reminders" to "service_role";

grant insert on table "public"."lead_reminders" to "service_role";

grant references on table "public"."lead_reminders" to "service_role";

grant select on table "public"."lead_reminders" to "service_role";

grant trigger on table "public"."lead_reminders" to "service_role";

grant truncate on table "public"."lead_reminders" to "service_role";

grant update on table "public"."lead_reminders" to "service_role";

create policy "tenant_isolation_insert"
on "public"."call_logs"
as permissive
for insert
to authenticated
with check ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_select"
on "public"."call_logs"
as permissive
for select
to authenticated
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_update"
on "public"."call_logs"
as permissive
for update
to authenticated
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "anonymous_can_read_active_tokens"
on "public"."client_portal_tokens"
as permissive
for select
to anon
using ((is_active = true));


create policy "authenticated_users_can_manage_tokens"
on "public"."client_portal_tokens"
as permissive
for all
to authenticated
using ((tenant_id = ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))))
with check ((tenant_id = ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "service_role_full_access"
on "public"."client_portal_tokens"
as permissive
for all
to service_role
using (true)
with check (true);


create policy "Users can create activities for their tenant"
on "public"."job_activity_log"
as permissive
for insert
to public
with check ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "Users can update activities for their tenant"
on "public"."job_activity_log"
as permissive
for update
to public
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "Users can view activities for their tenant"
on "public"."job_activity_log"
as permissive
for select
to public
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "Users can delete lead reminders from their tenant"
on "public"."lead_reminders"
as permissive
for delete
to public
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "Users can insert lead reminders for their tenant"
on "public"."lead_reminders"
as permissive
for insert
to public
with check ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "Users can update lead reminders from their tenant"
on "public"."lead_reminders"
as permissive
for update
to public
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "Users can view lead reminders from their tenant"
on "public"."lead_reminders"
as permissive
for select
to public
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_insert"
on "public"."lead_reminders"
as permissive
for insert
to authenticated
with check ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_select"
on "public"."lead_reminders"
as permissive
for select
to authenticated
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_update"
on "public"."lead_reminders"
as permissive
for update
to authenticated
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_delete"
on "public"."leads"
as permissive
for delete
to authenticated
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_insert"
on "public"."leads"
as permissive
for insert
to authenticated
with check ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_select"
on "public"."leads"
as permissive
for select
to authenticated
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "tenant_isolation_update"
on "public"."leads"
as permissive
for update
to authenticated
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "anonymous_can_log_activity"
on "public"."portal_activity_log"
as permissive
for insert
to anon
with check (true);


create policy "authenticated_users_can_manage_activity"
on "public"."portal_activity_log"
as permissive
for all
to authenticated
using ((tenant_id = ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))))
with check ((tenant_id = ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid()))));


create policy "service_role_activity_access"
on "public"."portal_activity_log"
as permissive
for all
to service_role
using (true)
with check (true);


create policy "Admins can view all notifications"
on "public"."admin_notifications"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role)::text = ANY ((ARRAY['admin'::character varying, 'owner'::character varying])::text[]))))));


create policy "Admins can view all status updates"
on "public"."job_status_updates"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role)::text = ANY ((ARRAY['admin'::character varying, 'owner'::character varying])::text[]))))));


create policy "Admins can view all location logs"
on "public"."location_logs"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role)::text = ANY ((ARRAY['admin'::character varying, 'owner'::character varying])::text[]))))));


create policy "Admins can manage SIP configurations for their tenant"
on "public"."sip_configurations"
as permissive
for all
to public
using ((tenant_id IN ( SELECT user_profiles.tenant_id
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.role)::text = ANY ((ARRAY['admin'::character varying, 'owner'::character varying])::text[]))))));


CREATE TRIGGER trigger_auto_create_company_account AFTER UPDATE OF onboarding_completed ON public.tenants FOR EACH ROW EXECUTE FUNCTION auto_create_company_account();

CREATE TRIGGER trigger_auto_provision_phone_numbers AFTER UPDATE OF onboarding_completed ON public.tenants FOR EACH ROW EXECUTE FUNCTION auto_provision_phone_numbers();


