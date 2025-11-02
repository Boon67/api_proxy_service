-- =====================================================
-- Snowflake API Proxy Service - Service Account Setup
-- =====================================================
-- This script creates a dedicated user and role for the API Proxy Service
-- with minimal required permissions for secure operation.
--
-- Prerequisites:
-- 1. Run this script as ACCOUNTADMIN or SYSADMIN
-- 2. Update the password and other parameters as needed
--
-- Usage:
--   Option 1 (Automated): Use scripts/deploy.sh - it runs this automatically
--   Option 2 (Manual): Run this script first, then sql/create_tables.sql
--
-- Creates:
--   - Database: API_PROXY
--   - Schema: APP (not PUBLIC)
--   - Warehouse: API_PROXY_WH
--   - Role: API_PROXY_SERVICE_ROLE
--   - User: API_PROXY_SERVICE_USER
--
-- These names align with scripts/deploy.sh defaults.
-- To customize, update both this script and deploy.sh flags.
--
-- =====================================================

-- Set context
USE ROLE ACCOUNTADMIN;

-- =====================================================
-- 1. CREATE DATABASE AND SCHEMA (if not exists)
-- =====================================================

-- Create database for API Proxy Service
CREATE DATABASE IF NOT EXISTS API_PROXY
  COMMENT = 'Database for Snowflake API Proxy Service';

-- Create schema
CREATE SCHEMA IF NOT EXISTS API_PROXY.APP
  COMMENT = 'App schema for API Proxy Service';

-- =====================================================
-- 2. CREATE WAREHOUSE (if not exists)
-- =====================================================

-- Create warehouse for API Proxy Service
CREATE WAREHOUSE IF NOT EXISTS API_PROXY_WH
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Warehouse for Snowflake API Proxy Service';

-- =====================================================
-- 3. CREATE SERVICE ROLE
-- =====================================================

-- Create dedicated service role
CREATE ROLE IF NOT EXISTS API_PROXY_SERVICE_ROLE
  COMMENT = 'Role for Snowflake API Proxy Service with minimal required permissions';

-- =====================================================
-- 4. CREATE SERVICE USER
-- =====================================================

-- Create dedicated service user (database and schema now exist for DEFAULT_NAMESPACE)
CREATE USER IF NOT EXISTS API_PROXY_SERVICE_USER
  PASSWORD = 'ChangeThisPassword123!'
  LOGIN_NAME = 'API_PROXY_SERVICE_USER'
  DISPLAY_NAME = 'API Proxy Service User'
  FIRST_NAME = 'API'
  LAST_NAME = 'Proxy'
  EMAIL = 'api-proxy-service@yourcompany.com'
  MUST_CHANGE_PASSWORD = FALSE
  DISABLED = FALSE
  DEFAULT_WAREHOUSE = 'API_PROXY_WH'
  DEFAULT_ROLE = 'API_PROXY_SERVICE_ROLE'
  DEFAULT_NAMESPACE = 'API_PROXY.APP'
  COMMENT = 'Service account for Snowflake API Proxy Service';

-- =====================================================
-- 5. GRANT PERMISSIONS TO ROLE
-- =====================================================

-- Grant usage on warehouse
GRANT USAGE ON WAREHOUSE API_PROXY_WH TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant usage on database
GRANT USAGE ON DATABASE API_PROXY TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant usage on schema
GRANT USAGE ON SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant create table permission (for logging/audit tables if needed)
GRANT CREATE TABLE ON SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant create stage permission (for file operations if needed)
GRANT CREATE STAGE ON SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant create procedure permission (for custom procedures if needed)
GRANT CREATE PROCEDURE ON SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant create function permission (for custom functions if needed)
GRANT CREATE FUNCTION ON SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- =====================================================
-- 6. GRANT PERMISSIONS FOR DATA ACCESS
-- =====================================================

-- Grant select on all existing tables in the schema
-- Note: This grants access to all current tables. For production,
-- you may want to grant access to specific tables only.
GRANT SELECT ON ALL TABLES IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant select on all future tables in the schema
GRANT SELECT ON FUTURE TABLES IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant select on all existing views in the schema
GRANT SELECT ON ALL VIEWS IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant select on all future views in the schema
GRANT SELECT ON FUTURE VIEWS IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant usage on all existing procedures in the schema
GRANT USAGE ON ALL PROCEDURES IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant usage on all future procedures in the schema
GRANT USAGE ON FUTURE PROCEDURES IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant usage on all existing functions in the schema
GRANT USAGE ON ALL FUNCTIONS IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant usage on all future functions in the schema
GRANT USAGE ON FUTURE FUNCTIONS IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- =====================================================
-- 7. ASSIGN ROLE TO USER AND SYSADMIN
-- =====================================================

-- Assign the service role to the service user
GRANT ROLE API_PROXY_SERVICE_ROLE TO USER API_PROXY_SERVICE_USER;

-- Grant the service role to SYSADMIN for management purposes
GRANT ROLE API_PROXY_SERVICE_ROLE TO ROLE SYSADMIN;

-- Set the role as default for the user
ALTER USER API_PROXY_SERVICE_USER SET DEFAULT_ROLE = 'API_PROXY_SERVICE_ROLE';

-- =====================================================
-- 8. CREATE NETWORK POLICY AND PAT TOKEN SETUP
-- =====================================================
-- Note: Network policy is required for PAT token authentication
-- Create a network policy that allows all IPs (adjust for production security)

-- Create network policy if it doesn't exist (allows all IPs - adjust for production)
CREATE NETWORK POLICY IF NOT EXISTS API_PROXY_SERVICE_NETWORK_POLICY
  ALLOWED_IP_LIST = ('0.0.0.0/0')
  COMMENT = 'Network policy for API Proxy Service User PAT token authentication';

-- Assign network policy to the service user (required for PAT tokens)
ALTER USER API_PROXY_SERVICE_USER SET NETWORK_POLICY = API_PROXY_SERVICE_NETWORK_POLICY;

-- =====================================================
-- PAT TOKEN GENERATION INSTRUCTIONS
-- =====================================================
-- After running this script, generate a PAT token for the service user:
--
-- 1. Generate PAT token (replace TOKEN_NAME with your desired name):
--    ALTER USER API_PROXY_SERVICE_USER
--      ADD PROGRAMMATIC ACCESS TOKEN TOKEN_NAME
--      DAYS_TO_EXPIRY = 365;
--
-- 2. The command will return the token_secret - COPY THIS VALUE IMMEDIATELY
--    It will not be shown again!
--
-- 3. Update config/snowflake.json with the token:
--    {
--      "account": "your-account.snowflakecomputing.com",
--      "username": "API_PROXY_SERVICE_USER",
--      "token": "<token_secret_from_step_1>",
--      "warehouse": "API_PROXY_WH",
--      "database": "API_PROXY",
--      "schema": "APP",
--      "role": "API_PROXY_SERVICE_ROLE"
--    }
--
-- 4. For local development, the backend will use the token from snowflake.json
--    For SPCS deployment, the service uses OAuth from /snowflake/session/token

-- =====================================================
-- 9. CREATE AUDIT/LOGGING TABLES (Optional)
-- =====================================================

-- Switch to the service role to create tables
USE ROLE API_PROXY_SERVICE_ROLE;
USE DATABASE API_PROXY;
USE SCHEMA APP;

-- Create audit log table for API requests
CREATE TABLE IF NOT EXISTS API_AUDIT_LOG (
    LOG_ID VARCHAR(36) DEFAULT UUID_STRING(),
    REQUEST_ID VARCHAR(36),
    ENDPOINT_ID VARCHAR(36),
    TOKEN_ID VARCHAR(36),
    REQUEST_METHOD VARCHAR(10),
    REQUEST_URL VARCHAR(500),
    REQUEST_IP VARCHAR(45),
    USER_AGENT VARCHAR(500),
    REQUEST_BODY VARIANT,
    RESPONSE_STATUS INTEGER,
    RESPONSE_TIME_MS INTEGER,
    ERROR_MESSAGE VARCHAR(1000),
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY (CREATED_AT, ENDPOINT_ID);

-- Create token usage tracking table
CREATE TABLE IF NOT EXISTS TOKEN_USAGE_LOG (
    USAGE_ID VARCHAR(36) DEFAULT UUID_STRING(),
    TOKEN_ID VARCHAR(36),
    ENDPOINT_ID VARCHAR(36),
    REQUEST_COUNT INTEGER DEFAULT 1,
    LAST_USED TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY (TOKEN_ID, LAST_USED);

-- Note: Snowflake doesn't support indexes on regular tables
-- For better query performance, consider:
-- 1. Using clustering keys on frequently queried columns
-- 2. Partitioning large tables by date
-- 3. Using materialized views for complex aggregations

-- =====================================================
-- 10. CREATE USEFUL VIEWS
-- =====================================================

-- Create view for API usage statistics
CREATE OR REPLACE VIEW API_USAGE_STATS AS
SELECT 
    DATE_TRUNC('HOUR', CREATED_AT) AS HOUR,
    ENDPOINT_ID,
    COUNT(*) AS REQUEST_COUNT,
    AVG(RESPONSE_TIME_MS) AS AVG_RESPONSE_TIME_MS,
    COUNT(CASE WHEN RESPONSE_STATUS >= 400 THEN 1 END) AS ERROR_COUNT
FROM API_AUDIT_LOG
WHERE CREATED_AT >= DATEADD(DAY, -7, CURRENT_TIMESTAMP())
GROUP BY DATE_TRUNC('HOUR', CREATED_AT), ENDPOINT_ID
ORDER BY HOUR DESC;

-- Create view for token usage statistics
CREATE OR REPLACE VIEW TOKEN_USAGE_STATS AS
SELECT 
    TOKEN_ID,
    ENDPOINT_ID,
    SUM(REQUEST_COUNT) AS TOTAL_REQUESTS,
    MAX(LAST_USED) AS LAST_USED,
    COUNT(DISTINCT DATE(LAST_USED)) AS ACTIVE_DAYS
FROM TOKEN_USAGE_LOG
WHERE LAST_USED >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
GROUP BY TOKEN_ID, ENDPOINT_ID
ORDER BY TOTAL_REQUESTS DESC;

-- =====================================================
-- 11. CREATE STORED PROCEDURES FOR COMMON OPERATIONS
-- =====================================================

-- Procedure to log API requests
CREATE OR REPLACE PROCEDURE LOG_API_REQUEST(
    REQUEST_ID VARCHAR,
    ENDPOINT_ID VARCHAR,
    TOKEN_ID VARCHAR,
    REQUEST_METHOD VARCHAR,
    REQUEST_URL VARCHAR,
    REQUEST_IP VARCHAR,
    USER_AGENT VARCHAR,
    REQUEST_BODY VARIANT,
    RESPONSE_STATUS INTEGER,
    RESPONSE_TIME_MS INTEGER,
    ERROR_MESSAGE VARCHAR
)
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
    INSERT INTO API_AUDIT_LOG (
        REQUEST_ID, ENDPOINT_ID, TOKEN_ID, REQUEST_METHOD, 
        REQUEST_URL, REQUEST_IP, USER_AGENT, REQUEST_BODY,
        RESPONSE_STATUS, RESPONSE_TIME_MS, ERROR_MESSAGE
    ) VALUES (
        REQUEST_ID, ENDPOINT_ID, TOKEN_ID, REQUEST_METHOD,
        REQUEST_URL, REQUEST_IP, USER_AGENT, REQUEST_BODY,
        RESPONSE_STATUS, RESPONSE_TIME_MS, ERROR_MESSAGE
    );
    
    RETURN 'API request logged successfully';
END;
$$;

-- Procedure to update token usage
CREATE OR REPLACE PROCEDURE UPDATE_TOKEN_USAGE(
    TOKEN_ID VARCHAR,
    ENDPOINT_ID VARCHAR
)
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
    MERGE INTO TOKEN_USAGE_LOG AS target
    USING (SELECT TOKEN_ID, ENDPOINT_ID, CURRENT_TIMESTAMP() AS LAST_USED) AS source
    ON target.TOKEN_ID = source.TOKEN_ID AND target.ENDPOINT_ID = source.ENDPOINT_ID
    WHEN MATCHED THEN
        UPDATE SET 
            REQUEST_COUNT = target.REQUEST_COUNT + 1,
            LAST_USED = source.LAST_USED
    WHEN NOT MATCHED THEN
        INSERT (TOKEN_ID, ENDPOINT_ID, REQUEST_COUNT, LAST_USED)
        VALUES (source.TOKEN_ID, source.ENDPOINT_ID, 1, source.LAST_USED);
    
    RETURN 'Token usage updated successfully';
END;
$$;

-- =====================================================
-- 12. GRANT PERMISSIONS ON NEW OBJECTS
-- =====================================================

-- Grant permissions on audit tables to the service role
GRANT SELECT, INSERT, UPDATE ON TABLE API_AUDIT_LOG TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE ON TABLE TOKEN_USAGE_LOG TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant permissions on views
GRANT SELECT ON VIEW API_USAGE_STATS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT ON VIEW TOKEN_USAGE_STATS TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant usage on procedures
GRANT USAGE ON PROCEDURE LOG_API_REQUEST TO ROLE API_PROXY_SERVICE_ROLE;
GRANT USAGE ON PROCEDURE UPDATE_TOKEN_USAGE TO ROLE API_PROXY_SERVICE_ROLE;

-- =====================================================
-- 13. VERIFICATION QUERIES
-- =====================================================

-- Verify user and role creation
SELECT 
    'USER' AS OBJECT_TYPE,
    NAME AS OBJECT_NAME,
    LOGIN_NAME,
    DEFAULT_WAREHOUSE,
    DEFAULT_ROLE,
    DISABLED
FROM SNOWFLAKE.ACCOUNT_USAGE.USERS 
WHERE NAME = 'API_PROXY_SERVICE_USER'

UNION ALL

SELECT 
    'ROLE' AS OBJECT_TYPE,
    ROLE_NAME AS OBJECT_NAME,
    NULL AS LOGIN_NAME,
    NULL AS DEFAULT_WAREHOUSE,
    NULL AS DEFAULT_ROLE,
    NULL AS DISABLED
FROM SNOWFLAKE.ACCOUNT_USAGE.ROLES 
WHERE ROLE_NAME = 'API_PROXY_SERVICE_ROLE';

-- Verify permissions
SHOW GRANTS TO ROLE API_PROXY_SERVICE_ROLE;

-- Verify user role assignment
SHOW GRANTS TO USER API_PROXY_SERVICE_USER;

-- =====================================================
-- 14. CLEANUP INSTRUCTIONS (for reference)
-- =====================================================

/*
-- To remove the service account and role (run as ACCOUNTADMIN):

-- 1. Drop the user
DROP USER API_PROXY_SERVICE_USER;

-- 2. Drop the role
DROP ROLE API_PROXY_SERVICE_ROLE;

-- 3. Drop the database (if no other objects depend on it)
DROP DATABASE API_PROXY;

-- 4. Drop the warehouse (if no other objects depend on it)
DROP WAREHOUSE API_PROXY_WH;
*/

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- Display completion message
SELECT 'Snowflake API Proxy Service account setup completed successfully!' AS STATUS;

-- Display connection information
SELECT 
    'Connection Information:' AS INFO,
    'Username: API_PROXY_SERVICE_USER' AS USERNAME,
    'Role: API_PROXY_SERVICE_ROLE' AS ROLE,
    'Database: API_PROXY' AS DATABASE,
    'Schema: PUBLIC' AS SCHEMA,
    'Warehouse: API_PROXY_WH' AS WAREHOUSE;
