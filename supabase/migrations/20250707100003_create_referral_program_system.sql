-- Create referral program system
-- This migration adds comprehensive referral tracking and rewards functionality

-- Create referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Referral code details
    code VARCHAR(50) UNIQUE NOT NULL,
    qr_code_url TEXT, -- URL to generated QR code image
    
    -- Tier and performance
    tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    total_referrals INTEGER DEFAULT 0,
    successful_conversions INTEGER DEFAULT 0,
    total_earned DECIMAL(10,2) DEFAULT 0,
    pending_rewards DECIMAL(10,2) DEFAULT 0,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Custom messaging
    custom_message TEXT, -- Personal message for shares
    preferred_share_medium VARCHAR(50), -- 'email', 'sms', 'social'
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_shared_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create referral tracking table
CREATE TABLE IF NOT EXISTS referral_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    
    -- Referred lead details
    referred_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    referred_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    referred_name VARCHAR(255),
    referred_email VARCHAR(255),
    referred_phone VARCHAR(50),
    
    -- Tracking details
    referral_source VARCHAR(100), -- 'email', 'sms', 'social', 'qr_code', 'direct_link'
    landing_page TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- Conversion tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'qualified', 'converted', 'expired', 'cancelled')),
    contacted_at TIMESTAMP WITH TIME ZONE,
    qualified_at TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    
    -- Financial tracking
    first_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    conversion_value DECIMAL(10,2),
    reward_amount DECIMAL(10,2),
    reward_type VARCHAR(50), -- 'credit', 'cash', 'gift_card', 'donation'
    reward_status VARCHAR(50) DEFAULT 'pending' CHECK (reward_status IN ('pending', 'approved', 'paid', 'applied', 'cancelled')),
    reward_paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    referred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create referral rewards table
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    referral_tracking_id UUID REFERENCES referral_tracking(id) ON DELETE SET NULL,
    
    -- Reward details
    reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('credit', 'cash', 'gift_card', 'donation', 'service_discount')),
    amount DECIMAL(10,2) NOT NULL,
    
    -- Application details
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'applied', 'expired', 'cancelled')),
    approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Payment/application details
    payment_method VARCHAR(50), -- 'check', 'ach', 'credit_applied', 'gift_card_sent'
    payment_reference VARCHAR(255), -- Check number, transaction ID, etc.
    applied_to_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    applied_to_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    
    -- For donations
    donation_recipient VARCHAR(255),
    donation_receipt_url TEXT,
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create referral program settings table
CREATE TABLE IF NOT EXISTS referral_program_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Program status
    is_active BOOLEAN DEFAULT true,
    
    -- Tier thresholds
    bronze_threshold INTEGER DEFAULT 0,
    silver_threshold INTEGER DEFAULT 3,
    gold_threshold INTEGER DEFAULT 6,
    platinum_threshold INTEGER DEFAULT 10,
    
    -- Reward amounts by tier (as per updated PRP)
    bronze_reward DECIMAL(10,2) DEFAULT 250.00,
    silver_reward DECIMAL(10,2) DEFAULT 400.00,
    gold_reward DECIMAL(10,2) DEFAULT 750.00,
    platinum_reward DECIMAL(10,2) DEFAULT 1000.00,
    
    -- Additional tier benefits (JSONB for flexibility)
    bronze_benefits JSONB DEFAULT '{"priority_scheduling": false, "maintenance_discount": 0}',
    silver_benefits JSONB DEFAULT '{"priority_scheduling": true, "maintenance_discount": 10}',
    gold_benefits JSONB DEFAULT '{"priority_scheduling": true, "maintenance_discount": 15, "annual_inspection": true}',
    platinum_benefits JSONB DEFAULT '{"priority_scheduling": true, "maintenance_discount": 20, "annual_inspection": true, "vip_support": true}',
    
    -- Reward options
    allow_cash_rewards BOOLEAN DEFAULT true,
    allow_credit_rewards BOOLEAN DEFAULT true,
    allow_gift_cards BOOLEAN DEFAULT true,
    allow_donations BOOLEAN DEFAULT true,
    
    -- Qualification rules
    minimum_job_value DECIMAL(10,2) DEFAULT 500.00, -- Minimum job value to qualify for reward
    qualification_period_days INTEGER DEFAULT 90, -- Days to convert referral
    cooling_period_days INTEGER DEFAULT 30, -- Days before reward is approved
    
    -- Messaging templates
    referral_email_template TEXT,
    referral_sms_template TEXT,
    reward_notification_template TEXT,
    
    -- Branding
    program_name VARCHAR(255) DEFAULT 'Customer Referral Program',
    program_description TEXT,
    terms_and_conditions TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create referral leaderboard view
CREATE OR REPLACE VIEW v_referral_leaderboard AS
SELECT 
    rc.id as referral_code_id,
    rc.customer_id,
    c.first_name || ' ' || c.last_name as customer_name,
    rc.tier,
    rc.successful_conversions,
    rc.total_earned,
    rc.created_at as member_since,
    ROW_NUMBER() OVER (ORDER BY rc.successful_conversions DESC, rc.total_earned DESC) as overall_rank,
    ROW_NUMBER() OVER (PARTITION BY rc.tier ORDER BY rc.successful_conversions DESC) as tier_rank
FROM referral_codes rc
JOIN contacts c ON rc.customer_id = c.id
WHERE rc.is_active = true
ORDER BY rc.successful_conversions DESC, rc.total_earned DESC;

-- Create monthly leaderboard view
CREATE OR REPLACE VIEW v_referral_monthly_leaderboard AS
SELECT 
    rc.id as referral_code_id,
    rc.customer_id,
    c.first_name || ' ' || c.last_name as customer_name,
    COUNT(CASE WHEN rt.converted_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) as monthly_conversions,
    SUM(CASE WHEN rt.converted_at >= date_trunc('month', CURRENT_DATE) THEN rt.reward_amount ELSE 0 END) as monthly_earnings,
    ROW_NUMBER() OVER (ORDER BY COUNT(CASE WHEN rt.converted_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) DESC) as monthly_rank
FROM referral_codes rc
JOIN contacts c ON rc.customer_id = c.id
LEFT JOIN referral_tracking rt ON rc.id = rt.referral_code_id AND rt.status = 'converted'
WHERE rc.is_active = true
GROUP BY rc.id, rc.customer_id, c.first_name, c.last_name;

-- Create indexes
CREATE INDEX idx_referral_codes_customer_id ON referral_codes(customer_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX idx_referral_codes_tier ON referral_codes(tier);
CREATE INDEX idx_referral_tracking_code_id ON referral_tracking(referral_code_id);
CREATE INDEX idx_referral_tracking_status ON referral_tracking(status);
CREATE INDEX idx_referral_tracking_converted_at ON referral_tracking(converted_at) WHERE status = 'converted';
CREATE INDEX idx_referral_rewards_code_id ON referral_rewards(referral_code_id);
CREATE INDEX idx_referral_rewards_status ON referral_rewards(status);

-- Create RLS policies
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_program_settings ENABLE ROW LEVEL SECURITY;

-- Referral code policies
CREATE POLICY "Referral codes tenant isolation" ON referral_codes
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY "Customers can view own referral code" ON referral_codes
    FOR SELECT USING (customer_id = current_setting('app.current_user_id', true)::uuid);

-- Tracking policies
CREATE POLICY "Referral tracking tenant isolation" ON referral_tracking
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Rewards policies
CREATE POLICY "Referral rewards tenant isolation" ON referral_rewards
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Settings policies
CREATE POLICY "Referral settings tenant isolation" ON referral_program_settings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_customer_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_code VARCHAR;
    v_exists BOOLEAN;
    v_attempts INTEGER := 0;
BEGIN
    LOOP
        -- Generate code based on customer name initials + random string
        SELECT 
            UPPER(SUBSTRING(c.first_name, 1, 1) || SUBSTRING(c.last_name, 1, 1)) || 
            SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)
        INTO v_code
        FROM contacts c
        WHERE c.id = p_customer_id;
        
        -- Check if code exists
        SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
        
        EXIT WHEN NOT v_exists OR v_attempts > 10;
        v_attempts := v_attempts + 1;
    END LOOP;
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate referral tier
CREATE OR REPLACE FUNCTION calculate_referral_tier(p_conversions INTEGER)
RETURNS VARCHAR AS $$
DECLARE
    v_settings referral_program_settings;
BEGIN
    -- Get settings for the tenant (would need tenant context in real implementation)
    SELECT * INTO v_settings FROM referral_program_settings LIMIT 1;
    
    IF p_conversions >= COALESCE(v_settings.platinum_threshold, 10) THEN
        RETURN 'platinum';
    ELSIF p_conversions >= COALESCE(v_settings.gold_threshold, 6) THEN
        RETURN 'gold';
    ELSIF p_conversions >= COALESCE(v_settings.silver_threshold, 3) THEN
        RETURN 'silver';
    ELSE
        RETURN 'bronze';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update referral tier on conversion
CREATE OR REPLACE FUNCTION update_referral_tier()
RETURNS TRIGGER AS $$
DECLARE
    v_conversions INTEGER;
    v_new_tier VARCHAR;
BEGIN
    -- Count successful conversions
    SELECT COUNT(*) 
    INTO v_conversions
    FROM referral_tracking
    WHERE referral_code_id = NEW.referral_code_id
    AND status = 'converted';
    
    -- Calculate new tier
    v_new_tier := calculate_referral_tier(v_conversions);
    
    -- Update referral code
    UPDATE referral_codes
    SET 
        successful_conversions = v_conversions,
        tier = v_new_tier,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.referral_code_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_referral_tier
    AFTER UPDATE OF status ON referral_tracking
    FOR EACH ROW
    WHEN (NEW.status = 'converted' AND OLD.status != 'converted')
    EXECUTE FUNCTION update_referral_tier();

-- Create trigger to update earnings
CREATE OR REPLACE FUNCTION update_referral_earnings()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total earned and pending rewards
    UPDATE referral_codes rc
    SET 
        total_earned = (
            SELECT COALESCE(SUM(reward_amount), 0)
            FROM referral_rewards
            WHERE referral_code_id = rc.id
            AND status IN ('paid', 'applied')
        ),
        pending_rewards = (
            SELECT COALESCE(SUM(reward_amount), 0)
            FROM referral_rewards
            WHERE referral_code_id = rc.id
            AND status IN ('pending', 'approved')
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.referral_code_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_referral_earnings
    AFTER INSERT OR UPDATE ON referral_rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_earnings();

-- Insert default referral program settings for each tenant
INSERT INTO referral_program_settings (tenant_id)
SELECT id FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM referral_program_settings WHERE tenant_id = tenants.id
);

-- Add comments
COMMENT ON TABLE referral_codes IS 'Unique referral codes for each customer to track their referrals';
COMMENT ON TABLE referral_tracking IS 'Tracks each referral from initial click through conversion';
COMMENT ON TABLE referral_rewards IS 'Manages reward payouts for successful referrals';
COMMENT ON TABLE referral_program_settings IS 'Configurable settings for each tenant''s referral program';
COMMENT ON COLUMN referral_codes.tier IS 'Customer tier based on successful conversions: bronze, silver, gold, platinum';
COMMENT ON COLUMN referral_program_settings.cooling_period_days IS 'Days to wait after job completion before approving reward';