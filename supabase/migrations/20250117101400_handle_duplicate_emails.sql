-- Handle leads with duplicate emails by linking to existing contacts

DO $$
DECLARE
    lead_record RECORD;
    existing_contact_id UUID;
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Handling leads with duplicate emails...';
    
    FOR lead_record IN
        SELECT * FROM leads 
        WHERE account_id IS NULL AND contact_id IS NULL
        AND email IS NOT NULL
        ORDER BY created_at DESC
    LOOP
        BEGIN
            -- Check if a contact already exists with this email
            SELECT id INTO existing_contact_id
            FROM contacts
            WHERE tenant_id = lead_record.tenant_id
              AND email = lead_record.email
            LIMIT 1;
            
            IF existing_contact_id IS NOT NULL THEN
                -- Link lead to existing contact
                UPDATE leads 
                SET contact_id = existing_contact_id,
                    updated_at = NOW()
                WHERE id = lead_record.id;
                
                RAISE NOTICE 'Linked lead % to existing contact % (email: %)', 
                    lead_record.id, existing_contact_id, lead_record.email;
                    
                fixed_count := fixed_count + 1;
            ELSE
                -- This shouldn't happen, but if it does, create without email
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
                            ELSE 'Customer'
                        END,
                        'Customer'
                    ),
                    lead_record.phone_number,
                    NOW(),
                    NOW()
                )
                RETURNING id INTO existing_contact_id;
                
                UPDATE leads 
                SET contact_id = existing_contact_id,
                    updated_at = NOW()
                WHERE id = lead_record.id;
                
                RAISE NOTICE 'Created contact without email % for lead %', 
                    existing_contact_id, lead_record.id;
                    
                fixed_count := fixed_count + 1;
            END IF;
                
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error fixing lead %: %', lead_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Successfully linked % leads to existing contacts', fixed_count;
END $$;

-- Final verification
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM leads
    WHERE account_id IS NULL AND contact_id IS NULL;
    
    IF orphaned_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All leads now have proper customer relationships!';
    ELSE
        RAISE WARNING 'There are still % leads without relationships', orphaned_count;
    END IF;
END $$;

-- Show final state
SELECT 
    'FINAL STATE' as status,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as business_leads,
    COUNT(CASE WHEN contact_id IS NOT NULL THEN 1 END) as residential_leads,
    COUNT(CASE WHEN account_id IS NULL AND contact_id IS NULL THEN 1 END) as orphaned_leads
FROM leads;