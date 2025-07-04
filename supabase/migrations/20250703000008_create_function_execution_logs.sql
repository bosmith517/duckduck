-- Create function execution logs table for comprehensive debugging
CREATE TABLE IF NOT EXISTS function_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  request_data JSONB,
  response_data JSONB,
  error_data JSONB,
  external_api_calls JSONB DEFAULT '[]'::jsonb,
  database_operations JSONB DEFAULT '[]'::jsonb,
  function_calls JSONB DEFAULT '[]'::jsonb,
  execution_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_function_execution_logs_function_name ON function_execution_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_function_execution_logs_tenant_id ON function_execution_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_function_execution_logs_user_id ON function_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_function_execution_logs_timestamp ON function_execution_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_function_execution_logs_success ON function_execution_logs(success);
CREATE INDEX IF NOT EXISTS idx_function_execution_logs_session_id ON function_execution_logs(session_id);

-- Create a partial index for failed executions
CREATE INDEX IF NOT EXISTS idx_function_execution_logs_failures ON function_execution_logs(function_name, timestamp) WHERE success = false;

-- Add RLS policy for tenant isolation
ALTER TABLE function_execution_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see logs for their tenant
CREATE POLICY "Users can view logs for their tenant" ON function_execution_logs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Admin users can see all logs
CREATE POLICY "Admins can view all logs" ON function_execution_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only the system can insert logs (via service role)
CREATE POLICY "System can insert logs" ON function_execution_logs
  FOR INSERT WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE function_execution_logs IS 'Comprehensive logging for all Edge Function executions, including request/response data, external API calls, database operations, and nested function calls';
COMMENT ON COLUMN function_execution_logs.external_api_calls IS 'Array of external API calls made during function execution with request/response data';
COMMENT ON COLUMN function_execution_logs.database_operations IS 'Array of database operations performed with data and results';
COMMENT ON COLUMN function_execution_logs.function_calls IS 'Array of nested function calls made during execution';
COMMENT ON COLUMN function_execution_logs.session_id IS 'Unique session identifier to track related operations across multiple functions';