-- Add running and display columns to surveys table
-- These columns control whether a survey is running and visible

-- Add running column (defaults to true for existing surveys)
ALTER TABLE surveys 
ADD COLUMN IF NOT EXISTS running BOOLEAN DEFAULT true;

-- Add display column (defaults to true for existing surveys)
ALTER TABLE surveys 
ADD COLUMN IF NOT EXISTS display BOOLEAN DEFAULT true;

-- Update existing surveys to have running = true and display = true
UPDATE surveys 
SET running = true 
WHERE running IS NULL;

UPDATE surveys 
SET display = true 
WHERE display IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN surveys.running IS 'Whether the survey is currently running (true) or stopped (false)';
COMMENT ON COLUMN surveys.display IS 'Whether the survey is visible (true) or hidden (false)';

