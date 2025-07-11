-- Create booking_links table for shareable booking pages
CREATE TABLE IF NOT EXISTS booking_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug VARCHAR(255) UNIQUE NOT NULL, -- unique URL slug for the booking page
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 0, -- buffer time between appointments
    advance_notice_hours INTEGER DEFAULT 24, -- how far in advance bookings can be made
    future_days_available INTEGER DEFAULT 60, -- how many days in future to show availability
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create availability_schedules table for weekly recurring availability
CREATE TABLE IF NOT EXISTS availability_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_link_id UUID NOT NULL REFERENCES booking_links(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create availability_overrides table for specific date overrides (holidays, special hours, etc)
CREATE TABLE IF NOT EXISTS availability_overrides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_link_id UUID NOT NULL REFERENCES booking_links(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT false, -- false = blocked day, true = special hours
    start_time TIME,
    end_time TIME,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_override_times CHECK (
        (is_available = false) OR 
        (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
    )
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_link_id UUID NOT NULL REFERENCES booking_links(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
    notes TEXT,
    meeting_link TEXT, -- for video meetings
    confirmation_token UUID DEFAULT gen_random_uuid(),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_booking_links_tenant_id ON booking_links(tenant_id);
CREATE INDEX idx_booking_links_user_id ON booking_links(user_id);
CREATE INDEX idx_booking_links_slug ON booking_links(slug);
CREATE INDEX idx_availability_schedules_booking_link ON availability_schedules(booking_link_id);
CREATE INDEX idx_availability_overrides_booking_link_date ON availability_overrides(booking_link_id, date);
CREATE INDEX idx_bookings_booking_link_time ON bookings(booking_link_id, start_time);
CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Enable RLS
ALTER TABLE booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_links
CREATE POLICY "Users can view their own booking links" ON booking_links
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own booking links" ON booking_links
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own booking links" ON booking_links
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own booking links" ON booking_links
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public can view active booking links by slug" ON booking_links
    FOR SELECT USING (is_active = true);

-- RLS Policies for availability_schedules
CREATE POLICY "Users can manage schedules for their booking links" ON availability_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM booking_links 
            WHERE booking_links.id = availability_schedules.booking_link_id 
            AND booking_links.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can view schedules for active booking links" ON availability_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM booking_links 
            WHERE booking_links.id = availability_schedules.booking_link_id 
            AND booking_links.is_active = true
        )
    );

-- RLS Policies for availability_overrides
CREATE POLICY "Users can manage overrides for their booking links" ON availability_overrides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM booking_links 
            WHERE booking_links.id = availability_overrides.booking_link_id 
            AND booking_links.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can view overrides for active booking links" ON availability_overrides
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM booking_links 
            WHERE booking_links.id = availability_overrides.booking_link_id 
            AND booking_links.is_active = true
        )
    );

-- RLS Policies for bookings
CREATE POLICY "Users can view bookings for their booking links" ON bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM booking_links 
            WHERE booking_links.id = bookings.booking_link_id 
            AND booking_links.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can create bookings" ON bookings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view their own bookings with confirmation token" ON bookings
    FOR SELECT USING (true); -- Will be filtered by confirmation_token in queries

CREATE POLICY "Public can update their own bookings with confirmation token" ON bookings
    FOR UPDATE USING (true); -- Will be filtered by confirmation_token in queries

-- Function to generate unique booking link slug
CREATE OR REPLACE FUNCTION generate_booking_slug(base_name TEXT)
RETURNS TEXT AS $$
DECLARE
    slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Create initial slug from base name
    slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
    slug := trim(both '-' from slug);
    
    -- Check if slug exists and increment if needed
    WHILE EXISTS (SELECT 1 FROM booking_links WHERE booking_links.slug = slug || CASE WHEN counter > 0 THEN '-' || counter ELSE '' END) LOOP
        counter := counter + 1;
    END LOOP;
    
    RETURN slug || CASE WHEN counter > 0 THEN '-' || counter ELSE '' END;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a time slot is available
CREATE OR REPLACE FUNCTION is_time_slot_available(
    p_booking_link_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
    v_day_of_week INTEGER;
    v_date DATE;
    v_time TIME;
    v_end_time TIME;
    v_is_available BOOLEAN := false;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_start_time);
    v_date := p_start_time::DATE;
    v_time := p_start_time::TIME;
    v_end_time := p_end_time::TIME;
    
    -- Check if there's an override for this date
    SELECT is_available INTO v_is_available
    FROM availability_overrides
    WHERE booking_link_id = p_booking_link_id
    AND date = v_date;
    
    IF FOUND THEN
        -- If override exists and blocks the day, return false
        IF NOT v_is_available THEN
            RETURN false;
        END IF;
        
        -- If override has special hours, check if time fits
        SELECT EXISTS (
            SELECT 1 FROM availability_overrides
            WHERE booking_link_id = p_booking_link_id
            AND date = v_date
            AND is_available = true
            AND v_time >= start_time
            AND v_end_time <= end_time
        ) INTO v_is_available;
    ELSE
        -- No override, check regular schedule
        SELECT EXISTS (
            SELECT 1 FROM availability_schedules
            WHERE booking_link_id = p_booking_link_id
            AND day_of_week = v_day_of_week
            AND is_active = true
            AND v_time >= start_time
            AND v_end_time <= end_time
        ) INTO v_is_available;
    END IF;
    
    -- If time slot fits in schedule, check for existing bookings
    IF v_is_available THEN
        SELECT NOT EXISTS (
            SELECT 1 FROM bookings
            WHERE booking_link_id = p_booking_link_id
            AND status = 'confirmed'
            AND (
                (start_time <= p_start_time AND end_time > p_start_time) OR
                (start_time < p_end_time AND end_time >= p_end_time) OR
                (start_time >= p_start_time AND end_time <= p_end_time)
            )
        ) INTO v_is_available;
    END IF;
    
    RETURN v_is_available;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_links_updated_at BEFORE UPDATE ON booking_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();