-- Step 7: Skip default templates insertion
-- Templates are now handled by the system_notification_templates table
-- This step is left intentionally empty to maintain migration numbering sequence
SELECT 'Skipping tenant-specific template insertion - using system templates instead' as info;