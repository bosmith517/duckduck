-- Add show_line_item_pricing column to estimates table
ALTER TABLE "public"."estimates" 
ADD COLUMN "show_line_item_pricing" BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN "public"."estimates"."show_line_item_pricing" IS 'Controls whether individual line item pricing is shown to customers in the estimate presentation';