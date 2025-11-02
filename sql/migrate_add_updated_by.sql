-- Migration: Add UPDATED_BY column to ENDPOINTS table
-- Run this script if you have an existing database without the UPDATED_BY column

-- Add UPDATED_BY column if it doesn't exist
ALTER TABLE IF EXISTS API_PROXY.APP.ENDPOINTS
ADD COLUMN IF NOT EXISTS UPDATED_BY VARCHAR(255);

