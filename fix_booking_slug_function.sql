-- Fix the ambiguous column reference in generate_booking_slug function
CREATE OR REPLACE FUNCTION generate_booking_slug(base_name TEXT)
RETURNS TEXT AS $$
DECLARE
    v_slug TEXT;
    v_counter INTEGER := 0;
BEGIN
    -- Create initial slug from base name
    v_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    
    -- Check if slug exists and increment if needed
    WHILE EXISTS (SELECT 1 FROM booking_links WHERE booking_links.slug = v_slug || CASE WHEN v_counter > 0 THEN '-' || v_counter ELSE '' END) LOOP
        v_counter := v_counter + 1;
    END LOOP;
    
    RETURN v_slug || CASE WHEN v_counter > 0 THEN '-' || v_counter ELSE '' END;
END;
$$ LANGUAGE plpgsql;