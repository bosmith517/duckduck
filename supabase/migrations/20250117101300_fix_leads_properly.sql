-- Fix existing leads by creating proper relationships

DO $$
DECLARE
    lead_record RECORD;
    v_contact_id UUID;
    v_account_id UUID;
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting to create relationships for leads...';
    
    FOR lead_record IN
        SELECT * FROM leads 
        WHERE account_id IS NULL AND contact_id IS NULL
        ORDER BY created_at DESC
    LOOP
        BEGIN
            RAISE NOTICE 'Processing lead %: % (type: %)', 
                lead_record.id,
                COALESCE(lead_record.name, lead_record.caller_name, 'Unknown'),
                COALESCE(lead_record.contact_type, 'residential');
            
            IF COALESCE(lead_record.contact_type, 'residential') = 'residential' THEN
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
                            ELSE 'Customer'
                        END,
                        'Customer'
                    ),
                    lead_record.email,
                    lead_record.phone_number,
                    NOW(),
                    NOW()
                )
                RETURNING id INTO v_contact_id;
                
                -- Update lead with contact_id
                UPDATE leads 
                SET contact_id = v_contact_id,
                    updated_at = NOW()
                WHERE id = lead_record.id;
                
                RAISE NOTICE 'Created contact % for lead %', v_contact_id, lead_record.id;
                
            ELSE -- business type
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
                    lead_record.phone_number,
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
                UPDATE leads 
                SET account_id = v_account_id,
                    updated_at = NOW()
                WHERE id = lead_record.id;
                
                RAISE NOTICE 'Created/updated account % for lead %', v_account_id, lead_record.id;
            END IF;
            
            fixed_count := fixed_count + 1;
                
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error fixing lead %: %', lead_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Successfully processed % leads', fixed_count;
END $$;

-- Verify the fix
SELECT 
    COUNT(*) as total_leads,
    COUNT(CASE WHEN account_id IS NOT NULL OR contact_id IS NOT NULL THEN 1 END) as leads_with_relationships,
    COUNT(CASE WHEN account_id IS NULL AND contact_id IS NULL THEN 1 END) as orphaned_leads
FROM leads;

-- Show any remaining orphaned leads
SELECT 
    id,
    name,
    caller_name,
    contact_type,
    phone_number,
    email,
    created_at
FROM leads
WHERE account_id IS NULL AND contact_id IS NULL
ORDER BY created_at DESC;