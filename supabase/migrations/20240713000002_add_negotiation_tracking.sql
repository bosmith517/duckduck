-- Add negotiation tracking fields to estimates
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS negotiation_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS initial_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS negotiation_rounds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_feedback TEXT;

-- Create negotiation events table for detailed tracking
CREATE TABLE IF NOT EXISTS estimate_negotiation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'initial_offer', 'counter_offer', 'rejection_reason', 'acceptance'
  previous_amount DECIMAL(10,2),
  proposed_amount DECIMAL(10,2),
  discount_percentage DECIMAL(5,2),
  customer_comments TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX idx_negotiation_events_estimate_id ON estimate_negotiation_events(estimate_id);
CREATE INDEX idx_negotiation_events_tenant_id ON estimate_negotiation_events(tenant_id);

-- Create view for customer negotiation patterns
CREATE OR REPLACE VIEW customer_negotiation_patterns AS
SELECT 
  COALESCE(e.account_id, e.contact_id) as customer_id,
  e.tenant_id,
  COUNT(DISTINCT e.id) as total_estimates,
  COUNT(DISTINCT CASE WHEN e.negotiation_rounds > 0 THEN e.id END) as negotiated_estimates,
  AVG(e.negotiation_rounds) as avg_negotiation_rounds,
  AVG(CASE 
    WHEN e.initial_amount > 0 AND e.total_amount < e.initial_amount 
    THEN ((e.initial_amount - e.total_amount) / e.initial_amount * 100)
    ELSE 0 
  END) as avg_discount_percentage,
  COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN e.status = 'rejected' THEN 1 END) as rejected_count,
  AVG(CASE WHEN e.status = 'approved' THEN e.total_amount END) as avg_approved_amount
FROM estimates e
WHERE e.tenant_id IS NOT NULL
GROUP BY COALESCE(e.account_id, e.contact_id), e.tenant_id;

-- Create trigger to track initial amount
CREATE OR REPLACE FUNCTION track_initial_estimate_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- On insert, set initial_amount if not already set
  IF NEW.initial_amount IS NULL THEN
    NEW.initial_amount = NEW.total_amount;
  END IF;
  
  -- Track negotiation rounds when status changes to under_negotiation
  IF NEW.status = 'under_negotiation' AND OLD.status != 'under_negotiation' THEN
    NEW.negotiation_rounds = COALESCE(OLD.negotiation_rounds, 0) + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'estimate_initial_amount_trigger') THEN
    CREATE TRIGGER estimate_initial_amount_trigger
    BEFORE INSERT OR UPDATE ON estimates
    FOR EACH ROW
    EXECUTE FUNCTION track_initial_estimate_amount();
  END IF;
END $$;

-- Add RLS policies
ALTER TABLE estimate_negotiation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view negotiation events for their tenant" ON estimate_negotiation_events
FOR SELECT USING (tenant_id IN (
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can create negotiation events for their tenant" ON estimate_negotiation_events
FOR INSERT WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
));

-- Grant permissions
GRANT SELECT ON customer_negotiation_patterns TO authenticated;
GRANT ALL ON estimate_negotiation_events TO authenticated;