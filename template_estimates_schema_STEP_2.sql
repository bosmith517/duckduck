-- STEP 2: Add columns to existing tables (run after step 1 succeeds)

-- Add template-related columns to existing estimate_line_items table
ALTER TABLE estimate_line_items 
ADD COLUMN IF NOT EXISTS template_line_item_id UUID,
ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update existing estimates table to support templates
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS template_id UUID,
ADD COLUMN IF NOT EXISTS selected_tier TEXT CHECK (selected_tier IN ('basic', 'standard', 'premium')),
ADD COLUMN IF NOT EXISTS custom_variables JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_from_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_duration_days INTEGER DEFAULT 1;