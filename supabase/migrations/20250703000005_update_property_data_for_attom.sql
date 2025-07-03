-- Update property_data table to support Attom Data API integration
-- Add Attom-specific fields and enhance existing structure

-- Add new columns for Attom Data
ALTER TABLE public.property_data 
ADD COLUMN IF NOT EXISTS attom_id text UNIQUE,
ADD COLUMN IF NOT EXISTS attom_onboard text,
ADD COLUMN IF NOT EXISTS attom_fips_code text,
ADD COLUMN IF NOT EXISTS attom_subdivison_name text,
ADD COLUMN IF NOT EXISTS attom_zoning text,
ADD COLUMN IF NOT EXISTS parcel_number text,
ADD COLUMN IF NOT EXISTS legal_description text,
ADD COLUMN IF NOT EXISTS owner_name text,
ADD COLUMN IF NOT EXISTS owner_occupied boolean,
ADD COLUMN IF NOT EXISTS property_use_code text,
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
ADD COLUMN IF NOT EXISTS flooring text,
ADD COLUMN IF NOT EXISTS construction_quality text,
ADD COLUMN IF NOT EXISTS condition_rating text,
ADD COLUMN IF NOT EXISTS market_value_estimate bigint,
ADD COLUMN IF NOT EXISTS market_value_date date,
ADD COLUMN IF NOT EXISTS tax_year integer,
ADD COLUMN IF NOT EXISTS annual_tax_amount bigint,
ADD COLUMN IF NOT EXISTS mortgage_amount bigint,
ADD COLUMN IF NOT EXISTS mortgage_date date,
ADD COLUMN IF NOT EXISTS deed_date date,
ADD COLUMN IF NOT EXISTS deed_type text,
ADD COLUMN IF NOT EXISTS sale_transaction_type text,
ADD COLUMN IF NOT EXISTS neighborhood_name text,
ADD COLUMN IF NOT EXISTS school_district text,
ADD COLUMN IF NOT EXISTS elementary_school text,
ADD COLUMN IF NOT EXISTS middle_school text,
ADD COLUMN IF NOT EXISTS high_school text,
ADD COLUMN IF NOT EXISTS flood_zone text,
ADD COLUMN IF NOT EXISTS census_tract text,
ADD COLUMN IF NOT EXISTS crime_risk_score integer,
ADD COLUMN IF NOT EXISTS natural_hazard_risk text,
ADD COLUMN IF NOT EXISTS walkability_score integer,
ADD COLUMN IF NOT EXISTS noise_score integer,
ADD COLUMN IF NOT EXISTS air_quality_score integer,
ADD COLUMN IF NOT EXISTS comparable_sales jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS price_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tax_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS permits jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS violations jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS liens jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS foreclosure_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS rental_estimates jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS demographic_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS environmental_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS attom_raw_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_attom_sync timestamp with time zone,
ADD COLUMN IF NOT EXISTS attom_sync_status text DEFAULT 'pending' CHECK (attom_sync_status IN ('pending', 'syncing', 'success', 'error', 'not_found')),
ADD COLUMN IF NOT EXISTS attom_error_message text;

-- Update data_source to include attom
ALTER TABLE public.property_data 
DROP CONSTRAINT IF EXISTS property_data_data_source_check;

ALTER TABLE public.property_data 
ADD CONSTRAINT property_data_data_source_check 
CHECK (data_source IN ('redfin', 'attom', 'manual', 'zillow', 'mls', 'public_records'));

-- Create indexes for Attom-specific fields
CREATE INDEX IF NOT EXISTS idx_property_data_attom_id ON public.property_data(attom_id);
CREATE INDEX IF NOT EXISTS idx_property_data_attom_onboard ON public.property_data(attom_onboard);
CREATE INDEX IF NOT EXISTS idx_property_data_parcel_number ON public.property_data(parcel_number);
CREATE INDEX IF NOT EXISTS idx_property_data_owner_name ON public.property_data(owner_name);
CREATE INDEX IF NOT EXISTS idx_property_data_school_district ON public.property_data(school_district);
CREATE INDEX IF NOT EXISTS idx_property_data_attom_sync_status ON public.property_data(attom_sync_status);
CREATE INDEX IF NOT EXISTS idx_property_data_last_attom_sync ON public.property_data(last_attom_sync);

-- Create function to normalize addresses for Attom API
CREATE OR REPLACE FUNCTION normalize_address_for_attom(address_text text)
RETURNS text AS $$
BEGIN
    -- Remove extra spaces, standardize abbreviations for Attom API
    RETURN regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(
                            upper(trim(address_text)),
                            '\s+', ' ', 'g'  -- Multiple spaces to single space
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

-- Create function to calculate property score based on Attom data
CREATE OR REPLACE FUNCTION calculate_property_score(property_row public.property_data)
RETURNS integer AS $$
DECLARE
    score integer := 0;
    max_score integer := 100;
BEGIN
    -- Property value score (0-25 points)
    IF property_row.market_value_estimate IS NOT NULL AND property_row.market_value_estimate > 0 THEN
        IF property_row.market_value_estimate >= 500000 THEN
            score := score + 25;
        ELSIF property_row.market_value_estimate >= 300000 THEN
            score := score + 20;
        ELSIF property_row.market_value_estimate >= 200000 THEN
            score := score + 15;
        ELSE
            score := score + 10;
        END IF;
    END IF;
    
    -- Property condition and quality (0-25 points)
    IF property_row.construction_quality = 'Excellent' THEN
        score := score + 15;
    ELSIF property_row.construction_quality = 'Good' THEN
        score := score + 12;
    ELSIF property_row.construction_quality = 'Average' THEN
        score := score + 8;
    END IF;
    
    IF property_row.condition_rating = 'Excellent' THEN
        score := score + 10;
    ELSIF property_row.condition_rating = 'Good' THEN
        score := score + 8;
    ELSIF property_row.condition_rating = 'Average' THEN
        score := score + 5;
    END IF;
    
    -- Amenities score (0-20 points)
    IF property_row.pool THEN score := score + 5; END IF;
    IF property_row.fireplace THEN score := score + 3; END IF;
    IF property_row.central_air THEN score := score + 4; END IF;
    IF property_row.garage_spaces > 0 THEN score := score + 3; END IF;
    IF property_row.garage_spaces >= 2 THEN score := score + 2; END IF;
    IF property_row.stories >= 2 THEN score := score + 3; END IF;
    
    -- Neighborhood and safety scores (0-15 points)
    IF property_row.crime_risk_score IS NOT NULL THEN
        IF property_row.crime_risk_score <= 20 THEN
            score := score + 8;
        ELSIF property_row.crime_risk_score <= 40 THEN
            score := score + 5;
        ELSIF property_row.crime_risk_score <= 60 THEN
            score := score + 3;
        END IF;
    END IF;
    
    IF property_row.walkability_score IS NOT NULL AND property_row.walkability_score >= 70 THEN
        score := score + 4;
    ELSIF property_row.walkability_score >= 50 THEN
        score := score + 2;
    END IF;
    
    IF property_row.air_quality_score IS NOT NULL AND property_row.air_quality_score >= 80 THEN
        score := score + 3;
    ELSIF property_row.air_quality_score >= 60 THEN
        score := score + 2;
    END IF;
    
    -- Property age and size (0-15 points)
    IF property_row.year_built IS NOT NULL THEN
        IF property_row.year_built >= 2010 THEN
            score := score + 8;
        ELSIF property_row.year_built >= 2000 THEN
            score := score + 6;
        ELSIF property_row.year_built >= 1990 THEN
            score := score + 4;
        ELSIF property_row.year_built >= 1980 THEN
            score := score + 2;
        END IF;
    END IF;
    
    IF property_row.square_footage IS NOT NULL THEN
        IF property_row.square_footage >= 3000 THEN
            score := score + 4;
        ELSIF property_row.square_footage >= 2000 THEN
            score := score + 3;
        ELSIF property_row.square_footage >= 1500 THEN
            score := score + 2;
        ELSIF property_row.square_footage >= 1000 THEN
            score := score + 1;
        END IF;
    END IF;
    
    -- Cap at max score
    IF score > max_score THEN score := max_score; END IF;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add computed column for property score
ALTER TABLE public.property_data 
ADD COLUMN IF NOT EXISTS property_score integer GENERATED ALWAYS AS (calculate_property_score(public.property_data.*)) STORED;

-- Create index on property score for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_property_data_property_score ON public.property_data(property_score);

-- Update comments
COMMENT ON TABLE public.property_data IS 'Enhanced property data with Attom Data API integration for comprehensive property intelligence';
COMMENT ON COLUMN public.property_data.attom_id IS 'Unique identifier from Attom Data API';
COMMENT ON COLUMN public.property_data.attom_onboard IS 'Attom onboard ID for property lookup';
COMMENT ON COLUMN public.property_data.comparable_sales IS 'Array of comparable recent sales from Attom';
COMMENT ON COLUMN public.property_data.price_history IS 'Historical price changes and sales data';
COMMENT ON COLUMN public.property_data.tax_history IS 'Historical tax assessment data';
COMMENT ON COLUMN public.property_data.rental_estimates IS 'Rental price estimates and market data';
COMMENT ON COLUMN public.property_data.demographic_data IS 'Neighborhood demographic information';
COMMENT ON COLUMN public.property_data.environmental_data IS 'Environmental risk and quality data';
COMMENT ON COLUMN public.property_data.attom_raw_data IS 'Complete raw response from Attom API for debugging';
COMMENT ON COLUMN public.property_data.property_score IS 'Computed property quality score (0-100) based on various factors';