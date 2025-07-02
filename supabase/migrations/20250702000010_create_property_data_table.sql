-- Create property data table to store scraped property information
CREATE TABLE IF NOT EXISTS public.property_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    address text NOT NULL,
    normalized_address text NOT NULL, -- For matching/deduplication
    city text,
    state text,
    zip_code text,
    
    -- Property details
    property_type text,
    year_built integer,
    square_footage integer,
    lot_size text,
    bedrooms integer,
    bathrooms numeric(3,1), -- Allow half baths like 2.5
    
    -- Financial data
    estimated_value bigint, -- Current estimated value
    last_sold_price bigint,
    last_sold_date date,
    tax_assessment bigint,
    
    -- Images and URLs
    street_view_url text,
    property_image_url text,
    redfin_url text,
    
    -- Metadata
    data_source text DEFAULT 'redfin',
    scraped_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Ensure one property per tenant per address
    UNIQUE(tenant_id, normalized_address)
);

-- Create indexes for performance
CREATE INDEX idx_property_data_tenant_id ON public.property_data(tenant_id);
CREATE INDEX idx_property_data_address ON public.property_data(normalized_address);
CREATE INDEX idx_property_data_scraped_at ON public.property_data(scraped_at);

-- Enable RLS
ALTER TABLE public.property_data ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage property data for their tenant" ON public.property_data
    FOR ALL 
    TO authenticated 
    USING (
        tenant_id = (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id = (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Allow service role full access for Edge Functions
CREATE POLICY "service_role_property_access" ON public.property_data
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.property_data TO authenticated;
GRANT ALL ON public.property_data TO service_role;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_property_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_data_updated_at
    BEFORE UPDATE ON public.property_data
    FOR EACH ROW
    EXECUTE FUNCTION update_property_data_updated_at();

-- Add helpful comments
COMMENT ON TABLE public.property_data IS 'Stores scraped property information for customer properties';
COMMENT ON COLUMN public.property_data.normalized_address IS 'Normalized address for deduplication and matching';
COMMENT ON COLUMN public.property_data.estimated_value IS 'Current estimated property value in cents';
COMMENT ON COLUMN public.property_data.data_source IS 'Source where property data was scraped from';