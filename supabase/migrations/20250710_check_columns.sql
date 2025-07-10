-- Create a function to check table columns (for debugging)
CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(
        json_build_object(
            'column_name', column_name,
            'data_type', data_type,
            'is_nullable', is_nullable,
            'column_default', column_default
        )
    )
    INTO result
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND information_schema.columns.table_name = get_table_columns.table_name
    ORDER BY ordinal_position;
    
    RETURN result;
END;
$$;