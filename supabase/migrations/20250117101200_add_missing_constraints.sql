-- Add missing unique constraints for contacts and accounts

-- First, check if constraints exist
DO $$
BEGIN
    -- Add unique constraint on contacts if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'contacts_tenant_email_key'
    ) THEN
        ALTER TABLE contacts 
        ADD CONSTRAINT contacts_tenant_email_key 
        UNIQUE (tenant_id, email);
        RAISE NOTICE 'Added unique constraint on contacts(tenant_id, email)';
    END IF;
    
    -- Add unique constraint on accounts if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'accounts_tenant_name_key'
    ) THEN
        ALTER TABLE accounts 
        ADD CONSTRAINT accounts_tenant_name_key 
        UNIQUE (tenant_id, name);
        RAISE NOTICE 'Added unique constraint on accounts(tenant_id, name)';
    END IF;
END $$;

-- Now let's manually create contacts/accounts for existing leads
DO $$
DECLARE
    lead_record RECORD;
    v_contact_id UUID;
    v_account_id UUID;
    fixed_count INTEGER := 0;
BEGIN
    FOR lead_record IN
        SELECT * FROM leads 
        WHERE account_id IS NULL AND contact_id IS NULL
    LOOP
        BEGIN
            IF lead_record.contact_type = 'residential' OR lead_record.contact_type IS NULL THEN
                -- Create contact for residential lead
                INSERT INTO contacts (
                    tenant_id,
                    first_name,
                    last_name,
                    email,
                    phone,
                    created_at,
                    updated_at
                ) VALUES (
                    lead_record.tenant_id,
                    COALESCE(
                        split_part(COALESCE(lead_record.name, lead_record.caller_name, 'Unknown'), ' ', 1),
                        'Unknown'
                    ),
                    COALESCE(
                        CASE 
                            WHEN array_length(string_to_array(COALESCE(lead_record.name, lead_record.caller_name, ''), ' '), 1) > 1
                            THEN array_to_string(
                                (string_to_array(COALESCE(lead_record.name, lead_record.caller_name, ''), ' '))[2:],
                                ' '
                            )
                            ELSE ''
                        END,
                        ''
                    ),
                    lead_record.email,
                    COALESCE(lead_record.phone, lead_record.phone_number),
                    NOW(),
                    NOW()
                )
                ON CONFLICT (tenant_id, email) WHERE email IS NOT NULL
                DO UPDATE SET
                    phone = COALESCE(EXCLUDED.phone, contacts.phone),
                    updated_at = NOW()
                RETURNING id INTO v_contact_id;
                
                -- If no email, insert without conflict handling
                IF v_contact_id IS NULL AND lead_record.email IS NULL THEN
                    INSERT INTO contacts (
                        tenant_id,
                        first_name,
                        last_name,
                        phone,
                        created_at,
                        updated_at
                    ) VALUES (
                        lead_record.tenant_id,
                        COALESCE(
                            split_part(COALESCE(lead_record.name, lead_record.caller_name, 'Unknown'), ' ', 1),
                            'Unknown'
                        ),
                        COALESCE(
                            CASE 
                                WHEN array_length(string_to_array(COALESCE(lead_record.name, lead_record.caller_name, ''), ' '), 1) > 1
                                THEN array_to_string(
                                    (string_to_array(COALESCE(lead_record.name, lead_record.caller_name, ''), ' '))[2:],
                                    ' '
                                )
                                ELSE ''
                            END,
                            ''
                        ),
                        COALESCE(lead_record.phone, lead_record.phone_number),
                        NOW(),
                        NOW()
                    )
                    RETURNING id INTO v_contact_id;
                END IF;
                
                -- Update lead with contact_id
                UPDATE leads SET contact_id = v_contact_id WHERE id = lead_record.id;
                
            ELSE -- business
                -- Create account for business lead
                INSERT INTO accounts (
                    tenant_id,
                    name,
                    phone,
                    email,
                    billing_address,
                    billing_city,
                    billing_state,
                    billing_zip,
                    created_at,
                    updated_at
                ) VALUES (
                    lead_record.tenant_id,
                    COALESCE(lead_record.company_name, lead_record.name, lead_record.caller_name, 'Unknown Business'),
                    COALESCE(lead_record.phone, lead_record.phone_number),
                    lead_record.email,
                    COALESCE(lead_record.full_address, lead_record.street_address),
                    lead_record.city,
                    lead_record.state,
                    lead_record.zip_code,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (tenant_id, name)
                DO UPDATE SET
                    phone = COALESCE(EXCLUDED.phone, accounts.phone),
                    email = COALESCE(EXCLUDED.email, accounts.email),
                    updated_at = NOW()
                RETURNING id INTO v_account_id;
                
                -- Update lead with account_id
                UPDATE leads SET account_id = v_account_id WHERE id = lead_record.id;
            END IF;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Fixed lead %: added % %', 
                lead_record.id,
                CASE WHEN v_contact_id IS NOT NULL THEN 'contact' ELSE 'account' END,
                COALESCE(v_contact_id, v_account_id);
                
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error fixing lead %: %', lead_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Successfully fixed % leads', fixed_count;
END $$;

-- Final check
SELECT 
    'After fix - Total leads' as metric,
    COUNT(*) as count
FROM leads
UNION ALL
SELECT 
    'After fix - Leads with relationships',
    COUNT(*)
FROM leads WHERE account_id IS NOT NULL OR contact_id IS NOT NULL
UNION ALL
SELECT 
    'After fix - Leads without relationships',
    COUNT(*)
FROM leads WHERE account_id IS NULL AND contact_id IS NULL;