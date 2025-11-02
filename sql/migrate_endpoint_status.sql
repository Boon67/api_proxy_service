-- Migration script to change IS_ACTIVE boolean to STATUS enum
-- Run this after create_tables.sql

USE ROLE ACCOUNTADMIN;
USE DATABASE API_PROXY;
USE SCHEMA APP;

-- =====================================================
-- MIGRATE ENDPOINTS TABLE: IS_ACTIVE -> STATUS
-- =====================================================

-- Step 1: Add STATUS column with default value
ALTER TABLE ENDPOINTS ADD COLUMN IF NOT EXISTS STATUS VARCHAR(20) DEFAULT 'active';

-- Step 2: Migrate existing data (IS_ACTIVE = TRUE -> 'active', FALSE -> 'suspended')
UPDATE ENDPOINTS 
SET STATUS = CASE 
  WHEN IS_ACTIVE = TRUE THEN 'active'
  ELSE 'suspended'
END
WHERE STATUS IS NULL OR STATUS = '';

-- Step 3: Set default value for future inserts
ALTER TABLE ENDPOINTS ALTER COLUMN STATUS SET DEFAULT 'draft';

-- Step 4: Drop the old IS_ACTIVE column (optional - can keep for compatibility)
-- ALTER TABLE ENDPOINTS DROP COLUMN IS_ACTIVE;

-- Step 5: Update clustering key to use STATUS instead of IS_ACTIVE
-- Note: Snowflake clustering keys cannot be easily changed, but new data will cluster on STATUS
-- The existing clustering on IS_ACTIVE will continue to work until reclustering

-- =====================================================
-- UPDATE VIEWS TO USE STATUS
-- =====================================================

-- Update ENDPOINTS_WITH_TOKENS view
CREATE OR REPLACE VIEW ENDPOINTS_WITH_TOKENS AS
SELECT 
    e.ENDPOINT_ID,
    e.NAME,
    e.DESCRIPTION,
    e.TYPE,
    e.TARGET,
    e.METHOD,
    COALESCE(e.STATUS, 
      CASE WHEN e.IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END
    ) AS STATUS,
    COALESCE(e.IS_ACTIVE, 
      CASE WHEN e.STATUS = 'active' THEN TRUE ELSE FALSE END
    ) AS IS_ACTIVE, -- Keep for backward compatibility
    e.CREATED_AT,
    e.UPDATED_AT,
    e.CREATED_BY,
    CASE WHEN t.TOKEN_ID IS NOT NULL THEN TRUE ELSE FALSE END AS HAS_TOKEN,
    t.TOKEN_ID,
    t.LAST_USED AS TOKEN_LAST_USED,
    t.USAGE_COUNT AS TOKEN_USAGE_COUNT
FROM ENDPOINTS e
LEFT JOIN PAT_TOKENS t ON e.ENDPOINT_ID = t.ENDPOINT_ID 
  AND t.IS_ACTIVE = TRUE
  AND COALESCE(e.STATUS, 
      CASE WHEN e.IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END
    ) = 'active';

-- Update ENDPOINT_USAGE_SUMMARY view
CREATE OR REPLACE VIEW ENDPOINT_USAGE_SUMMARY AS
SELECT 
    e.ENDPOINT_ID,
    e.NAME,
    e.TYPE,
    COALESCE(e.STATUS, 
      CASE WHEN e.IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END
    ) AS STATUS,
    COUNT(DISTINCT a.LOG_ID) AS TOTAL_REQUESTS,
    COUNT(DISTINCT DATE(a.CREATED_AT)) AS ACTIVE_DAYS,
    AVG(a.RESPONSE_TIME_MS) AS AVG_RESPONSE_TIME_MS,
    MAX(a.CREATED_AT) AS LAST_REQUEST
FROM ENDPOINTS e
LEFT JOIN API_AUDIT_LOG a ON e.ENDPOINT_ID = a.ENDPOINT_ID
    AND a.CREATED_AT >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
WHERE COALESCE(e.STATUS, 
      CASE WHEN e.IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END
    ) IN ('active', 'draft')
GROUP BY e.ENDPOINT_ID, e.NAME, e.TYPE, e.STATUS;

