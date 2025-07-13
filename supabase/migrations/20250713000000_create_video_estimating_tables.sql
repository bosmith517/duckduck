-- Video Estimating Tables Migration
-- Creates tables for AI-powered video estimating system

-- Video sessions table
CREATE TABLE IF NOT EXISTS video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('ROOFING', 'PLUMBING', 'HVAC', 'ELECTRICAL')),
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  vision_results JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vision results table for detailed storage
CREATE TABLE IF NOT EXISTS vision_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  trade_insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  trade_type TEXT NOT NULL,
  frame_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated estimates table (before conversion to formal estimates)
CREATE TABLE IF NOT EXISTS generated_estimates (
  id TEXT PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0800,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trade toolkits configuration
CREATE TABLE IF NOT EXISTS trade_toolkits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type TEXT NOT NULL UNIQUE CHECK (trade_type IN ('ROOFING', 'PLUMBING', 'HVAC', 'ELECTRICAL')),
  prompts_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  pricing_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session invitations log
CREATE TABLE IF NOT EXISTS session_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  phone_number TEXT,
  email_address TEXT,
  magic_link TEXT NOT NULL,
  sent_via TEXT[] DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage bucket for captured frames
INSERT INTO storage.buckets (id, name, public)
VALUES ('vision-captures', 'vision-captures', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for video_sessions
ALTER TABLE video_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for video_sessions" ON video_sessions
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM user_profiles WHERE tenant_id = video_sessions.tenant_id
    )
  );

-- RLS policies for vision_results
ALTER TABLE vision_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for vision_results" ON vision_results
  FOR ALL USING (
    session_id IN (
      SELECT id FROM video_sessions WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS policies for generated_estimates
ALTER TABLE generated_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for generated_estimates" ON generated_estimates
  FOR ALL USING (
    session_id IN (
      SELECT id FROM video_sessions WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS policies for trade_toolkits (global read, admin write)
ALTER TABLE trade_toolkits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trade_toolkits" ON trade_toolkits
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify trade_toolkits" ON trade_toolkits
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM user_profiles WHERE role = 'admin'
    )
  );

-- RLS policies for session_invitations
ALTER TABLE session_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for session_invitations" ON session_invitations
  FOR ALL USING (
    session_id IN (
      SELECT id FROM video_sessions WHERE tenant_id IN (
        SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Storage policies for vision captures
CREATE POLICY "Authenticated users can upload vision captures" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'vision-captures' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their tenant's vision captures" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'vision-captures' AND
    auth.uid() IN (
      SELECT id FROM user_profiles WHERE tenant_id::text = split_part(name, '/', 1)
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_sessions_tenant_id ON video_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_sessions(status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_trade_type ON video_sessions(trade_type);
CREATE INDEX IF NOT EXISTS idx_video_sessions_scheduled_at ON video_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_vision_results_session_id ON vision_results(session_id);
CREATE INDEX IF NOT EXISTS idx_vision_results_timestamp ON vision_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_generated_estimates_session_id ON generated_estimates(session_id);

-- Insert default trade toolkits
INSERT INTO trade_toolkits (trade_type, prompts_config, pricing_config) VALUES
('ROOFING', '[
  {
    "id": "roof-1",
    "category": "initial",
    "prompt": "Can you step outside and show me your roof? Start with a wide view of the entire house.",
    "order": 1
  },
  {
    "id": "roof-2", 
    "category": "inspection",
    "prompt": "Now walk around the house slowly so I can see all sides of the roof.",
    "order": 2
  },
  {
    "id": "roof-3",
    "category": "details", 
    "prompt": "Can you get closer to show me the shingles? I need to see the material and condition.",
    "order": 3
  }
]'::jsonb, '{
  "shingle_replacement": {"unit_price": 450, "unit": "square"},
  "vent_repair": {"unit_price": 125, "unit": "linear_foot"},
  "flashing_repair": {"unit_price": 85, "unit": "linear_foot"}
}'::jsonb),

('PLUMBING', '[
  {
    "id": "plumb-1",
    "category": "initial",
    "prompt": "Can you show me where the plumbing issue is located?",
    "order": 1
  },
  {
    "id": "plumb-2",
    "category": "water-pressure",
    "prompt": "Turn on the water and show me the flow rate and pressure.",
    "order": 2
  }
]'::jsonb, '{
  "pipe_repair": {"unit_price": 75, "unit": "foot"},
  "valve_replacement": {"unit_price": 150, "unit": "unit"},
  "leak_repair": {"unit_price": 250, "unit": "service"}
}'::jsonb),

('HVAC', '[
  {
    "id": "hvac-1", 
    "category": "initial",
    "prompt": "Can you show me your thermostat and its current settings?",
    "order": 1
  },
  {
    "id": "hvac-2",
    "category": "outdoor-unit",
    "prompt": "Go outside and show me your AC unit or heat pump.",
    "order": 2
  }
]'::jsonb, '{
  "filter_replacement": {"unit_price": 45, "unit": "unit"},
  "system_tune_up": {"unit_price": 275, "unit": "service"},
  "condenser_cleaning": {"unit_price": 150, "unit": "service"}
}'::jsonb),

('ELECTRICAL', '[
  {
    "id": "elec-1",
    "category": "initial", 
    "prompt": "Show me the electrical issue or the area where you need work done.",
    "order": 1
  },
  {
    "id": "elec-2",
    "category": "panel",
    "prompt": "Can you show me your electrical panel? I need to see the breakers and any labels.",
    "order": 2
  }
]'::jsonb, '{
  "outlet_replacement": {"unit_price": 85, "unit": "unit"},
  "breaker_replacement": {"unit_price": 150, "unit": "unit"},
  "panel_inspection": {"unit_price": 125, "unit": "service"}
}'::jsonb)
ON CONFLICT (trade_type) DO NOTHING;

-- Function to get video estimating stats
CREATE OR REPLACE FUNCTION get_video_estimating_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_sessions BIGINT,
  completed_sessions BIGINT,
  average_duration INTEGER,
  estimates_generated BIGINT
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (ended_at - started_at))/60)::INTEGER,
      0
    ) as average_duration,
    COUNT(estimate_id) as estimates_generated
  FROM video_sessions 
  WHERE tenant_id = p_tenant_id;
$$;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_video_sessions_updated_at 
  BEFORE UPDATE ON video_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trade_toolkits_updated_at 
  BEFORE UPDATE ON trade_toolkits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();