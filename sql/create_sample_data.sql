-- =====================================================
-- Snowflake API Proxy Service - Sample Data
-- =====================================================
-- This script creates sample tags and a test endpoint for the API Proxy Service
-- Run this after running setup_service_account.sql and create_tables.sql
--
-- Creates:
--   - Sample tags for typical company departments
--   - A test endpoint that executes "SELECT 1;"
--
-- =====================================================

USE ROLE ACCOUNTADMIN;
USE DATABASE API_PROXY;
USE SCHEMA APP;

-- =====================================================
-- 1. CREATE SAMPLE TAGS FOR TYPICAL COMPANY DEPARTMENTS
-- =====================================================

INSERT INTO TAGS (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
SELECT 
    UUID_STRING(),
    'Engineering',
    '#3B82F6',
    'Engineering department',
    'system'
WHERE NOT EXISTS (SELECT 1 FROM TAGS WHERE NAME = 'Engineering');

INSERT INTO TAGS (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
SELECT 
    UUID_STRING(),
    'Sales',
    '#10B981',
    'Sales department',
    'system'
WHERE NOT EXISTS (SELECT 1 FROM TAGS WHERE NAME = 'Sales');

INSERT INTO TAGS (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
SELECT 
    UUID_STRING(),
    'Marketing',
    '#F59E0B',
    'Marketing department',
    'system'
WHERE NOT EXISTS (SELECT 1 FROM TAGS WHERE NAME = 'Marketing');

INSERT INTO TAGS (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
SELECT 
    UUID_STRING(),
    'Finance',
    '#EF4444',
    'Finance department',
    'system'
WHERE NOT EXISTS (SELECT 1 FROM TAGS WHERE NAME = 'Finance');

INSERT INTO TAGS (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
SELECT 
    UUID_STRING(),
    'Operations',
    '#8B5CF6',
    'Operations department',
    'system'
WHERE NOT EXISTS (SELECT 1 FROM TAGS WHERE NAME = 'Operations');

INSERT INTO TAGS (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
SELECT 
    UUID_STRING(),
    'HR',
    '#EC4899',
    'Human Resources department',
    'system'
WHERE NOT EXISTS (SELECT 1 FROM TAGS WHERE NAME = 'HR');

INSERT INTO TAGS (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
SELECT 
    UUID_STRING(),
    'Legal',
    '#6366F1',
    'Legal department',
    'system'
WHERE NOT EXISTS (SELECT 1 FROM TAGS WHERE NAME = 'Legal');

INSERT INTO TAGS (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
SELECT 
    UUID_STRING(),
    'Product',
    '#06B6D4',
    'Product management department',
    'system'
WHERE NOT EXISTS (SELECT 1 FROM TAGS WHERE NAME = 'Product');

-- =====================================================
-- 2. CREATE SAMPLE TEST ENDPOINT
-- =====================================================

INSERT INTO ENDPOINTS (ENDPOINT_ID, NAME, DESCRIPTION, TYPE, TARGET, METHOD, PARAMETERS, RATE_LIMIT, STATUS, IS_ACTIVE, CREATED_BY, METADATA)
SELECT 
    UUID_STRING(),
    'Test Connection',
    'Simple test endpoint that returns SELECT 1; for connection testing',
    'query',
    'SELECT 1 AS test_result;',
    'GET',
    NULL,
    100,
    'draft',
    FALSE,
    'system',
    NULL
WHERE NOT EXISTS (SELECT 1 FROM ENDPOINTS WHERE NAME = 'Test Connection');

-- =====================================================
-- 3. LINK TEST ENDPOINT WITH ENGINEERING TAG
-- =====================================================

MERGE INTO ENDPOINT_TAGS AS target
USING (
    SELECT 
        e.ENDPOINT_ID,
        t.TAG_ID
    FROM ENDPOINTS e
    CROSS JOIN TAGS t
    WHERE e.NAME = 'Test Connection'
      AND t.NAME = 'Engineering'
) AS source
ON target.ENDPOINT_ID = source.ENDPOINT_ID AND target.TAG_ID = source.TAG_ID
WHEN NOT MATCHED THEN
    INSERT (ENDPOINT_ID, TAG_ID, CREATED_AT)
    VALUES (source.ENDPOINT_ID, source.TAG_ID, CURRENT_TIMESTAMP());

-- =====================================================
-- 4. VERIFICATION
-- =====================================================

-- Verify tags were created
SELECT 
    NAME,
    COLOR,
    DESCRIPTION
FROM TAGS
WHERE CREATED_BY = 'system'
ORDER BY NAME;

-- Verify test endpoint was created
SELECT 
    NAME,
    DESCRIPTION,
    TYPE,
    TARGET,
    STATUS
FROM ENDPOINTS
WHERE NAME = 'Test Connection';

-- Display completion message
SELECT 'Sample data created successfully!' AS STATUS;
