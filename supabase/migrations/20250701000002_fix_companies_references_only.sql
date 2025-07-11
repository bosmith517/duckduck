-- Fix foreign key constraints that incorrectly reference 'companies' table
-- The database uses 'tenants' table, not 'companies'

-- Check if lead_reminders table exists and fix its foreign key constraint
DO $$
BEGIN
    -- Check if the table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'lead_reminders') THEN
        -- Drop the incorrect foreign key constraint if it exists
        IF EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'lead_reminders_tenant_id_fkey' AND table_name = 'lead_reminders') THEN
            ALTER TABLE public.lead_reminders DROP CONSTRAINT lead_reminders_tenant_id_fkey;
        END IF;
        
        -- Add the correct foreign key constraint
        ALTER TABLE public.lead_reminders 
        ADD CONSTRAINT lead_reminders_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;
END $$;
