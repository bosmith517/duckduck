-- Subproject Migration: Add SignalWire Subproject Support
-- This migration adds subproject management capabilities to the tenants system

-- Add subproject fields to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS signalwire_subproject_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS signalwire_subproject_token TEXT,
ADD COLUMN IF NOT EXISTS signalwire_subproject_space VARCHAR(255),
ADD COLUMN IF NOT EXISTS subproject_status VARCHAR(20) DEFAULT 'pending' CHECK (subproject_status IN ('pending', 'created', 'failed', 'retrying')),
ADD COLUMN IF NOT EXISTS subproject_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subproject_error TEXT,
ADD COLUMN IF NOT EXISTS subproject_retry_needed BOOLEAN DEFAULT false;

-- Create admin_notifications table for tracking subproject issues
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('subproject_failed', 'subproject_retry_needed', 'system_alert', 'billing_issue')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    is_read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_subproject_status ON tenants(subproject_status);
CREATE INDEX IF NOT EXISTS idx_tenants_subproject_id ON tenants(signalwire_subproject_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_tenant_id ON admin_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);

-- Enable RLS on admin_notifications
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy for admin_notifications (only admins can see notifications)
CREATE POLICY "Admins can view all notifications" ON admin_notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Service role can manage all notifications" ON admin_notifications
    FOR ALL USING (auth.role() = 'service_role');

-- Function to create admin notification
CREATE OR REPLACE FUNCTION create_admin_notification(
    p_tenant_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_severity VARCHAR(20) DEFAULT 'info',
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO admin_notifications (
        tenant_id,
        type,
        title,
        message,
        severity,
        metadata
    ) VALUES (
        p_tenant_id,
        p_type,
        p_title,
        p_message,
        p_severity,
        p_metadata
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE admin_notifications 
    SET is_read = true, read_at = NOW()
    WHERE id = notification_id;
    
    RETURN FOUND;
END;
$$;

-- Function to get tenant subproject info
CREATE OR REPLACE FUNCTION get_tenant_subproject_info(tenant_uuid UUID)
RETURNS TABLE (
    subproject_id VARCHAR(100),
    subproject_token TEXT,
    subproject_space VARCHAR(255),
    subproject_status VARCHAR(20),
    subproject_created_at TIMESTAMP WITH TIME ZONE,
    subproject_error TEXT,
    retry_needed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.signalwire_subproject_id,
        t.signalwire_subproject_token,
        t.signalwire_subproject_space,
        t.subproject_status,
        t.subproject_created_at,
        t.subproject_error,
        t.subproject_retry_needed
    FROM tenants t
    WHERE t.id = tenant_uuid;
END;
$$;

-- Function to update subproject status
CREATE OR REPLACE FUNCTION update_subproject_status(
    tenant_uuid UUID,
    status VARCHAR(20),
    error_message TEXT DEFAULT NULL,
    retry_needed BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE tenants 
    SET 
        subproject_status = status,
        subproject_error = error_message,
        subproject_retry_needed = retry_needed,
        updated_at = NOW()
    WHERE id = tenant_uuid;
    
    RETURN FOUND;
END;
$$;

-- Function to set subproject credentials
CREATE OR REPLACE FUNCTION set_subproject_credentials(
    tenant_uuid UUID,
    subproject_id VARCHAR(100),
    subproject_token TEXT,
    subproject_space VARCHAR(255)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE tenants 
    SET 
        signalwire_subproject_id = subproject_id,
        signalwire_subproject_token = subproject_token,
        signalwire_subproject_space = subproject_space,
        subproject_status = 'created',
        subproject_created_at = NOW(),
        subproject_error = NULL,
        subproject_retry_needed = false,
        updated_at = NOW()
    WHERE id = tenant_uuid;
    
    RETURN FOUND;
END;
$$;

-- Create a view for easy subproject monitoring
CREATE OR REPLACE VIEW subproject_status_overview AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.signalwire_subproject_id,
    t.subproject_status,
    t.subproject_created_at,
    t.subproject_error,
    t.subproject_retry_needed,
    COUNT(an.id) as notification_count
FROM tenants t
LEFT JOIN admin_notifications an ON t.id = an.tenant_id 
    AND an.type LIKE 'subproject%' 
    AND an.is_read = false
GROUP BY t.id, t.name, t.signalwire_subproject_id, t.subproject_status, 
         t.subproject_created_at, t.subproject_error, t.subproject_retry_needed
ORDER BY t.created_at DESC;

-- Grant necessary permissions
GRANT SELECT ON subproject_status_overview TO authenticated;
GRANT EXECUTE ON FUNCTION create_admin_notification TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_subproject_info TO service_role;
GRANT EXECUTE ON FUNCTION update_subproject_status TO service_role;
GRANT EXECUTE ON FUNCTION set_subproject_credentials TO service_role;

-- Add comment for documentation
COMMENT ON TABLE admin_notifications IS 'Tracks administrative notifications including subproject creation failures';
COMMENT ON COLUMN tenants.signalwire_subproject_id IS 'SignalWire subproject ID for dedicated tenant resources';
COMMENT ON COLUMN tenants.subproject_status IS 'Status of subproject creation: pending, created, failed, retrying';
COMMENT ON VIEW subproject_status_overview IS 'Overview of all tenant subproject statuses with notification counts';