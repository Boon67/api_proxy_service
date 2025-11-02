-- Migration: Add missing columns to ENDPOINTS table
-- This script adds STATUS and UPDATED_BY columns if they don't exist

-- Add STATUS column if it doesn't exist
ALTER TABLE IF EXISTS API_PROXY.APP.ENDPOINTS
ADD COLUMN IF NOT EXISTS STATUS VARCHAR(20) DEFAULT 'draft';

-- Add UPDATED_BY column if it doesn't exist
ALTER TABLE IF EXISTS API_PROXY.APP.ENDPOINTS
ADD COLUMN IF NOT EXISTS UPDATED_BY VARCHAR(255);

-- Update existing rows to set STATUS based on IS_ACTIVE if STATUS is null
UPDATE API_PROXY.APP.ENDPOINTS
SET STATUS = CASE 
  WHEN IS_ACTIVE = TRUE THEN 'active'
  ELSE 'suspended'
END
WHERE STATUS IS NULL;

-- Comment: After running this migration, all endpoints will have:
-- - STATUS column (either 'active', 'draft', or 'suspended')
-- - UPDATED_BY column (nullable, will be set on future updates)

