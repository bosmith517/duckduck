-- Fix Attom Data integration by adding essential columns only
-- Remove problematic computed column that causes database errors

-- Add essential columns for Attom Data integration
ALTER TABLE public.property_data 
ADD COLUMN IF NOT EXISTS attom_id text,
ADD COLUMN IF NOT EXISTS attom_onboard text,
ADD COLUMN IF NOT EXISTS attom_fips_code text,
ADD COLUMN IF NOT EXISTS parcel_number text,
ADD COLUMN IF NOT EXISTS stories integer,
ADD COLUMN IF NOT EXISTS total_rooms integer,
ADD COLUMN IF NOT EXISTS garage_spaces integer,
ADD COLUMN IF NOT EXISTS pool boolean,
ADD COLUMN IF NOT EXISTS fireplace boolean,
ADD COLUMN IF NOT EXISTS central_air boolean,
ADD COLUMN IF NOT EXISTS heating_type text,
ADD COLUMN IF NOT EXISTS cooling_type text,
ADD COLUMN IF NOT EXISTS roof_material text,
ADD COLUMN IF NOT EXISTS exterior_walls text,
ADD COLUMN IF NOT EXISTS construction_quality text,
ADD COLUMN IF NOT EXISTS condition_rating text,
ADD COLUMN IF NOT EXISTS market_value_estimate bigint,
ADD COLUMN IF NOT EXISTS market_value_date date,
ADD COLUMN IF NOT EXISTS tax_year integer,
ADD COLUMN IF NOT EXISTS comparable_sales jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS price_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS attom_raw_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_attom_sync timestamp with time zone,
ADD COLUMN IF NOT EXISTS attom_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS attom_error_message text;

-- Update data_source constraint to include attom
ALTER TABLE public.property_data 
DROP CONSTRAINT IF EXISTS property_data_data_source_check;

ALTER TABLE public.property_data 
ADD CONSTRAINT property_data_data_source_check 
CHECK (data_source IN ('redfin', 'attom', 'manual', 'zillow', 'mls', 'public_records'));

-- Add constraint for attom_sync_status
ALTER TABLE public.property_data 
DROP CONSTRAINT IF EXISTS property_data_attom_sync_status_check;

ALTER TABLE public.property_data 
ADD CONSTRAINT property_data_attom_sync_status_check 
CHECK (attom_sync_status IN ('pending', 'syncing', 'success', 'error', 'not_found'));

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_property_data_attom_id ON public.property_data(attom_id);
CREATE INDEX IF NOT EXISTS idx_property_data_attom_sync_status ON public.property_data(attom_sync_status);
CREATE INDEX IF NOT EXISTS idx_property_data_last_attom_sync ON public.property_data(last_attom_sync);

-- Create function to normalize addresses for Attom API
CREATE OR REPLACE FUNCTION normalize_address_for_attom(address_text text)
RETURNS text AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comments
COMMENT ON TABLE public.property_data IS 'Property data with Attom Data API integration';
COMMENT ON COLUMN public.property_data.attom_raw_data IS 'Complete raw response from Attom API';