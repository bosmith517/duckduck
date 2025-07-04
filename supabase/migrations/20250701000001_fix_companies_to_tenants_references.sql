-- Fix foreign key constraints that incorrectly reference 'companies' table
-- The database uses 'tenants' table, not 'companies'

-- Only fix lead_reminders if the table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_reminders') THEN
        -- Fix lead_reminders table foreign key constraint
        ALTER TABLE public.lead_reminders 
        DROP CONSTRAINT IF EXISTS lead_reminders_tenant_id_fkey;

        ALTER TABLE public.lead_reminders 
        ADD CONSTRAINT lead_reminders_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update RLS policies to use correct table references (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_reminders') THEN
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view lead reminders from their tenant" ON public.lead_reminders;
        DROP POLICY IF EXISTS "Users can insert lead reminders for their tenant" ON public.lead_reminders;
        DROP POLICY IF EXISTS "Users can update lead reminders from their tenant" ON public.lead_reminders;
        DROP POLICY IF EXISTS "Users can delete lead reminders from their tenant" ON public.lead_reminders;

        -- Recreate RLS policies with correct tenant reference
        CREATE POLICY "Users can view lead reminders from their tenant" 
          ON public.lead_reminders 
          FOR SELECT 
          USING (
            tenant_id IN (
              SELECT tenant_id 
              FROM public.user_profiles 
              WHERE id = auth.uid()
            )
          );

        CREATE POLICY "Users can insert lead reminders for their tenant" 
          ON public.lead_reminders 
          FOR INSERT 
          WITH CHECK (
            tenant_id IN (
              SELECT tenant_id 
              FROM public.user_profiles 
              WHERE id = auth.uid()
            )
          );

        CREATE POLICY "Users can update lead reminders from their tenant" 
          ON public.lead_reminders 
          FOR UPDATE 
          USING (
            tenant_id IN (
              SELECT tenant_id 
              FROM public.user_profiles 
              WHERE id = auth.uid()
            )
          );

        CREATE POLICY "Users can delete lead reminders from their tenant" 
          ON public.lead_reminders 
          FOR DELETE 
          USING (
            tenant_id IN (
              SELECT tenant_id 
              FROM public.user_profiles 
              WHERE id = auth.uid()
            )
          );
    END IF;
END $$;
