-- Add missing columns to leads table to match frontend expectations

-- Rename existing columns to match frontend expectations
ALTER TABLE public.leads 
  RENAME COLUMN name TO caller_name;

ALTER TABLE public.leads 
  RENAME COLUMN phone TO phone_number;

-- Add missing columns
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS initial_request text,
  ADD COLUMN IF NOT EXISTS urgency varchar DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
  ADD COLUMN IF NOT EXISTS estimated_value decimal,
  ADD COLUMN IF NOT EXISTS follow_up_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS converted_to_job_id uuid;

-- Update status column to have proper check constraint
ALTER TABLE public.leads 
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads 
  ALTER COLUMN status TYPE varchar,
  ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE public.leads 
  ADD CONSTRAINT leads_status_check 
  CHECK (status IN ('new', 'qualified', 'unqualified', 'converted'));

-- Add foreign key constraint for converted_to_job_id
ALTER TABLE public.leads
  ADD CONSTRAINT leads_converted_to_job_id_fkey 
  FOREIGN KEY (converted_to_job_id) 
  REFERENCES public.jobs(id) 
  ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_urgency ON public.leads(urgency);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- Add RLS policies if not exists
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policy for tenant isolation
CREATE POLICY IF NOT EXISTS "Users can view leads from their tenant" 
  ON public.leads 
  FOR SELECT 
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::uuid);

CREATE POLICY IF NOT EXISTS "Users can insert leads for their tenant" 
  ON public.leads 
  FOR INSERT 
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id'::uuid);

CREATE POLICY IF NOT EXISTS "Users can update leads from their tenant" 
  ON public.leads 
  FOR UPDATE 
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::uuid);

CREATE POLICY IF NOT EXISTS "Users can delete leads from their tenant" 
  ON public.leads 
  FOR DELETE 
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::uuid);

-- Add missing columns to call_logs table
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS caller_name text,
  ADD COLUMN IF NOT EXISTS caller_phone text,
  ADD COLUMN IF NOT EXISTS call_type varchar,
  ADD COLUMN IF NOT EXISTS call_direction varchar,
  ADD COLUMN IF NOT EXISTS duration integer,
  ADD COLUMN IF NOT EXISTS status varchar,
  ADD COLUMN IF NOT EXISTS notes text;

-- Add foreign key constraint for lead_id
ALTER TABLE public.call_logs
  ADD CONSTRAINT call_logs_lead_id_fkey 
  FOREIGN KEY (lead_id) 
  REFERENCES public.leads(id) 
  ON DELETE SET NULL;

-- Create lead_reminders table
CREATE TABLE IF NOT EXISTS public.lead_reminders (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  reminder_type varchar NOT NULL,
  scheduled_date timestamp with time zone NOT NULL,
  status varchar DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
  message text,
  completed_at timestamp with time zone,
  completed_by uuid REFERENCES auth.users(id)
);

-- Add indexes for lead_reminders
CREATE INDEX IF NOT EXISTS idx_lead_reminders_tenant_id ON public.lead_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_lead_id ON public.lead_reminders(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_scheduled_date ON public.lead_reminders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_status ON public.lead_reminders(status);

-- Add RLS policies for lead_reminders
ALTER TABLE public.lead_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view lead reminders from their tenant" 
  ON public.lead_reminders 
  FOR SELECT 
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::uuid);

CREATE POLICY IF NOT EXISTS "Users can insert lead reminders for their tenant" 
  ON public.lead_reminders 
  FOR INSERT 
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id'::uuid);

CREATE POLICY IF NOT EXISTS "Users can update lead reminders from their tenant" 
  ON public.lead_reminders 
  FOR UPDATE 
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::uuid);

CREATE POLICY IF NOT EXISTS "Users can delete lead reminders from their tenant" 
  ON public.lead_reminders 
  FOR DELETE 
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::uuid);