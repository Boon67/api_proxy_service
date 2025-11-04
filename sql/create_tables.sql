-- =====================================================
-- Snowflake API Proxy Service - Database Tables
-- =====================================================
-- This script creates all necessary HYBRID TABLES for the API Proxy Service
-- Hybrid tables enable constraints and provide ACID guarantees
-- Run this after running setup_service_account.sql
--
-- Prerequisites:
-- 1. Database API_PROXY exists
-- 2. Schema APP exists (created by setup_service_account.sql or deploy.sh)
-- 3. API_PROXY_SERVICE_ROLE has CREATE TABLE permission
--
-- Note: This script expects schema "APP" (not PUBLIC).
-- If using deploy.sh, it creates everything automatically.
-- If running manually, run setup_service_account.sql first.
--
-- =====================================================

-- Run as ACCOUNTADMIN to create tables, then grant permissions
-- Note: deploy.sh will substitute API_PROXY with the actual database name
USE ROLE ACCOUNTADMIN;
USE DATABASE API_PROXY;
USE SCHEMA APP;

-- =====================================================
-- 1. USERS TABLE - For authentication
-- =====================================================

CREATE HYBRID TABLE IF NOT EXISTS USERS (
    USER_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    USERNAME VARCHAR(255) NOT NULL UNIQUE,
    PASSWORD_HASH VARCHAR(255) NOT NULL,
    FIRST_NAME VARCHAR(255),
    LAST_NAME VARCHAR(255),
    EMAIL VARCHAR(255),
    CONTACT_NUMBER VARCHAR(50),
    ROLE VARCHAR(50) DEFAULT 'admin',
    IS_ACTIVE BOOLEAN DEFAULT TRUE,
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    LAST_LOGIN TIMESTAMP_LTZ,
    CREATED_BY VARCHAR(255)
);

-- =====================================================
-- 2. ENDPOINTS TABLE - For API endpoint definitions
-- =====================================================

CREATE HYBRID TABLE IF NOT EXISTS ENDPOINTS (
    ENDPOINT_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    NAME VARCHAR(255) NOT NULL,
    DESCRIPTION VARCHAR(1000),
    TYPE VARCHAR(50) NOT NULL, -- 'query', 'stored_procedure', 'function', 'table'
    TARGET VARCHAR(2000) NOT NULL, -- SQL query, procedure name, function name, or table name
    METHOD VARCHAR(10) DEFAULT 'GET', -- HTTP method
    PARAMETERS VARIANT, -- JSON array of parameter definitions
    RATE_LIMIT INTEGER DEFAULT 100, -- Requests per minute
    STATUS VARCHAR(20) DEFAULT 'draft', -- 'active', 'draft', 'suspended'
    IS_ACTIVE BOOLEAN DEFAULT TRUE, -- Deprecated: kept for backward compatibility, use STATUS instead
    PATH VARCHAR(100), -- Custom URL path for endpoint (e.g., "TB1"). If null, endpoint uses UUID in URL. Must be unique and URL-safe.
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    CREATED_BY VARCHAR(255),
    UPDATED_BY VARCHAR(255),
    METADATA VARIANT, -- Additional JSON metadata
    CONSTRAINT ENDPOINTS_PATH_UNIQUE UNIQUE (PATH) -- Ensures custom paths are unique when provided, but allows multiple NULLs
);

-- =====================================================
-- 3. API_KEYS TABLE - For API Keys (formerly PAT_TOKENS)
-- =====================================================

CREATE HYBRID TABLE IF NOT EXISTS API_KEYS (
    API_KEY_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    API_KEY VARCHAR(128) NOT NULL UNIQUE, -- Hashed API key
    ENDPOINT_ID VARCHAR(36) NOT NULL,
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    LAST_USED TIMESTAMP_LTZ,
    USAGE_COUNT INTEGER DEFAULT 0,
    IS_ACTIVE BOOLEAN DEFAULT TRUE,
    CREATED_BY VARCHAR(255),
    METADATA VARIANT -- Additional JSON metadata
);

-- =====================================================
-- 4. TAGS TABLE - For tagging endpoints and tokens
-- =====================================================

CREATE HYBRID TABLE IF NOT EXISTS TAGS (
    TAG_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    NAME VARCHAR(100) NOT NULL UNIQUE,
    COLOR VARCHAR(7), -- Hex color code (e.g., #FF5733)
    DESCRIPTION VARCHAR(500),
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    CREATED_BY VARCHAR(255)
);

-- =====================================================
-- 5. ENDPOINT_TAGS TABLE - Junction table for endpoint tags
-- =====================================================

CREATE HYBRID TABLE IF NOT EXISTS ENDPOINT_TAGS (
    ENDPOINT_ID VARCHAR(36) NOT NULL,
    TAG_ID VARCHAR(36) NOT NULL,
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (ENDPOINT_ID, TAG_ID)
);


-- Note: Hybrid tables use PRIMARY KEY constraints for performance optimization
-- Unlike standard tables, hybrid tables do not support CLUSTER BY clauses
-- Hybrid tables provide row-level locking and enforce constraints for transactional workloads

-- =====================================================
-- 6. CREATE AUDIT/LOGGING TABLES
-- =====================================================

-- Create audit log table for API requests
CREATE HYBRID TABLE IF NOT EXISTS API_AUDIT_LOG (
    LOG_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    REQUEST_ID VARCHAR(36),
    ENDPOINT_ID VARCHAR(36),
    API_KEY_ID VARCHAR(36),
    REQUEST_METHOD VARCHAR(10),
    REQUEST_URL VARCHAR(500),
    REQUEST_IP VARCHAR(45),
    REQUEST_IP_X_FORWARDED VARCHAR(45),
    USER_AGENT VARCHAR(500),
    REQUEST_BODY VARIANT,
    REQUEST_SIZE_BYTES INTEGER,
    RESPONSE_STATUS INTEGER,
    RESPONSE_SIZE_BYTES INTEGER,
    RESPONSE_TIME_MS INTEGER,
    START_TIME TIMESTAMP_LTZ,
    END_TIME TIMESTAMP_LTZ,
    ERROR_MESSAGE VARCHAR(1000),
    ROUTE_PATH VARCHAR(500),
    USER_ID VARCHAR(36),
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Create token usage tracking table (daily aggregation)
CREATE HYBRID TABLE IF NOT EXISTS API_USAGE_LOG (
    USAGE_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    API_KEY_ID VARCHAR(36),
    ENDPOINT_ID VARCHAR(36),
    REQUEST_COUNT INTEGER DEFAULT 1,
    LAST_USED TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- =====================================================
-- 7. SYSTEM_SETTINGS TABLE - For application configuration
-- =====================================================

-- Create system settings table
CREATE HYBRID TABLE IF NOT EXISTS SYSTEM_SETTINGS (
    SETTING_KEY VARCHAR(100) NOT NULL PRIMARY KEY,
    SETTING_VALUE VARIANT NOT NULL,
    DESCRIPTION VARCHAR(500),
    UPDATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_BY VARCHAR(255)
);

-- Insert default system settings (using MERGE to handle conflicts gracefully)
MERGE INTO SYSTEM_SETTINGS AS target
USING (SELECT 'log_level' AS SETTING_KEY, 'info'::VARIANT AS SETTING_VALUE, 'Logging level (error, warn, info, debug)' AS DESCRIPTION, 'system' AS UPDATED_BY) AS source
ON target.SETTING_KEY = source.SETTING_KEY
WHEN NOT MATCHED THEN
    INSERT (SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_BY)
    VALUES (source.SETTING_KEY, source.SETTING_VALUE, source.DESCRIPTION, source.UPDATED_BY);

MERGE INTO SYSTEM_SETTINGS AS target
USING (SELECT 'rate_limit_default' AS SETTING_KEY, 100::VARIANT AS SETTING_VALUE, 'Default rate limit for new endpoints (requests per minute)' AS DESCRIPTION, 'system' AS UPDATED_BY) AS source
ON target.SETTING_KEY = source.SETTING_KEY
WHEN NOT MATCHED THEN
    INSERT (SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_BY)
    VALUES (source.SETTING_KEY, source.SETTING_VALUE, source.DESCRIPTION, source.UPDATED_BY);

MERGE INTO SYSTEM_SETTINGS AS target
USING (SELECT 'session_timeout' AS SETTING_KEY, 3600::VARIANT AS SETTING_VALUE, 'Session timeout in seconds (default: 1 hour)' AS DESCRIPTION, 'system' AS UPDATED_BY) AS source
ON target.SETTING_KEY = source.SETTING_KEY
WHEN NOT MATCHED THEN
    INSERT (SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_BY)
    VALUES (source.SETTING_KEY, source.SETTING_VALUE, source.DESCRIPTION, source.UPDATED_BY);

MERGE INTO SYSTEM_SETTINGS AS target
USING (SELECT 'enable_audit_log' AS SETTING_KEY, TRUE::VARIANT AS SETTING_VALUE, 'Enable audit logging to API_AUDIT_LOG table' AS DESCRIPTION, 'system' AS UPDATED_BY) AS source
ON target.SETTING_KEY = source.SETTING_KEY
WHEN NOT MATCHED THEN
    INSERT (SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_BY)
    VALUES (source.SETTING_KEY, source.SETTING_VALUE, source.DESCRIPTION, source.UPDATED_BY);

-- =====================================================
-- 10. CREATE VIEWS
-- =====================================================

-- View for active endpoints with token info
-- Note: Not currently used by application, but kept for potential future use
CREATE OR REPLACE VIEW ENDPOINTS_WITH_TOKENS AS
SELECT 
    e.ENDPOINT_ID,
    e.NAME,
    e.DESCRIPTION,
    e.TYPE,
    e.TARGET,
    e.METHOD,
    e.IS_ACTIVE,
    e.CREATED_AT,
    e.UPDATED_AT,
    e.CREATED_BY,
    CASE WHEN t.API_KEY_ID IS NOT NULL THEN TRUE ELSE FALSE END AS HAS_TOKEN,
    t.API_KEY_ID,
    t.LAST_USED AS TOKEN_LAST_USED,
    t.USAGE_COUNT AS TOKEN_USAGE_COUNT
FROM ENDPOINTS e
LEFT JOIN API_KEYS t ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE;

-- View for endpoint statistics
-- Note: Not currently used by application, but kept for potential future use
CREATE OR REPLACE VIEW ENDPOINT_STATISTICS AS
SELECT 
    e.ENDPOINT_ID,
    e.NAME,
    e.TYPE,
    e.IS_ACTIVE,
    COUNT(DISTINCT t.API_KEY_ID) AS TOKEN_COUNT,
    SUM(t.USAGE_COUNT) AS TOTAL_REQUESTS,
    MAX(t.LAST_USED) AS LAST_REQUEST_TIME
FROM ENDPOINTS e
LEFT JOIN API_KEYS t ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
GROUP BY e.ENDPOINT_ID, e.NAME, e.TYPE, e.IS_ACTIVE;

-- View for API usage statistics (hourly aggregation)
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

-- View for token usage statistics
CREATE OR REPLACE VIEW TOKEN_USAGE_STATS AS
SELECT 
    API_KEY_ID,
    ENDPOINT_ID,
    SUM(REQUEST_COUNT) AS TOTAL_REQUESTS,
    MAX(LAST_USED) AS LAST_USED,
    COUNT(DISTINCT DATE(LAST_USED)) AS ACTIVE_DAYS
FROM API_USAGE_LOG
WHERE LAST_USED >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
GROUP BY API_KEY_ID, ENDPOINT_ID
ORDER BY TOTAL_REQUESTS DESC;

-- View for endpoint usage summary (for charts)
-- Note: Not currently used by application, but kept for potential future use
CREATE OR REPLACE VIEW ENDPOINT_USAGE_SUMMARY AS
SELECT 
    e.ENDPOINT_ID,
    e.NAME,
    e.TYPE,
    COUNT(DISTINCT a.LOG_ID) AS TOTAL_REQUESTS,
    COUNT(DISTINCT DATE(a.CREATED_AT)) AS ACTIVE_DAYS,
    AVG(a.RESPONSE_TIME_MS) AS AVG_RESPONSE_TIME_MS,
    MAX(a.CREATED_AT) AS LAST_REQUEST
FROM ENDPOINTS e
LEFT JOIN API_AUDIT_LOG a ON e.ENDPOINT_ID = a.ENDPOINT_ID
    AND a.CREATED_AT >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
GROUP BY e.ENDPOINT_ID, e.NAME, e.TYPE;

-- =====================================================
-- 11. GRANT PERMISSIONS TO SERVICE ROLE
-- =====================================================
-- Note: Permissions are granted AFTER all tables and views are created
-- deploy.sh will substitute API_PROXY.APP with the actual database.schema

-- Grant permissions on tables to the service role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.USERS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.ENDPOINTS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.API_KEYS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.TAGS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.ENDPOINT_TAGS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE ON TABLE API_PROXY.APP.API_AUDIT_LOG TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE ON TABLE API_PROXY.APP.API_USAGE_LOG TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.SYSTEM_SETTINGS TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant permissions on views to the service role (only views used by application)
GRANT SELECT ON VIEW API_PROXY.APP.API_USAGE_STATS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT ON VIEW API_PROXY.APP.TOKEN_USAGE_STATS TO ROLE API_PROXY_SERVICE_ROLE;

-- =====================================================
-- 12. VERIFICATION
-- =====================================================

-- Verify tables were created
SHOW TABLES;

-- Display completion message
SELECT 'Database tables created successfully!' AS STATUS;

