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
    EMAIL VARCHAR(255),
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
    METADATA VARIANT -- Additional JSON metadata
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

-- =====================================================
-- 6. TOKEN_TAGS TABLE - Junction table for token tags
-- =====================================================
-- NOTE: TOKEN_TAGS table not created - not used by the application
-- Backend code references it but handles missing table gracefully

-- =====================================================
-- 7. CREATE INDEXES AND CONSTRAINTS
-- =====================================================

-- Create unique constraint on PATH (now possible with hybrid tables)
-- This ensures custom paths are unique when provided, but allows multiple NULLs
ALTER TABLE ENDPOINTS ADD CONSTRAINT ENDPOINTS_PATH_UNIQUE UNIQUE (PATH);

-- Add comment on PATH column
COMMENT ON COLUMN ENDPOINTS.PATH IS 'Custom URL path for endpoint (e.g., "TB1"). If null, endpoint uses UUID in URL. Must be unique and URL-safe (alphanumeric, hyphens, underscores only).';

-- Note: Hybrid tables use PRIMARY KEY constraints for performance optimization
-- Unlike standard tables, hybrid tables do not support CLUSTER BY clauses
-- Hybrid tables provide row-level locking and enforce constraints for transactional workloads

-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================

-- Grant permissions on tables to the service role (if it exists)
-- Note: If API_PROXY_SERVICE_ROLE doesn't exist, run setup_service_account.sql first
-- or create the role manually, then re-run this section

-- Grant permissions on tables to the service role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.USERS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.ENDPOINTS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.API_KEYS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.TAGS TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE API_PROXY.APP.ENDPOINT_TAGS TO ROLE API_PROXY_SERVICE_ROLE;
-- TOKEN_TAGS table removed - no grant needed

-- Alternative: Grant to current role for now (will grant to API_PROXY_SERVICE_ROLE later)
-- For now, tables are created and can be accessed by ACCOUNTADMIN

-- =====================================================
-- 6. INSERT DEFAULT ADMIN USER
-- =====================================================
-- Password hash for 'admin123' (bcrypt, cost factor 12)
-- This should be generated by the application, but we include it here for initial setup

-- Note: The password hash should be generated by the application using bcrypt
-- Example: bcrypt.hash('admin123', 12) will generate a hash
-- For now, we'll create a placeholder that needs to be updated
-- The application will generate and store the hash properly

-- Insert default admin user (password: admin123)
-- You should replace this hash with one generated by bcrypt.hash('admin123', 12)
INSERT INTO USERS (USER_ID, USERNAME, PASSWORD_HASH, EMAIL, ROLE, IS_ACTIVE, CREATED_BY)
SELECT 
    UUID_STRING(),
    'admin',
    '$2a$12$Sk0sw.rJyPUmt/TEmfjM/uS.SZvSGBSIALCefvzmrRPjnCzCOAzTC', -- admin123
    'admin@example.com',
    'admin',
    TRUE,
    'system'
WHERE NOT EXISTS (SELECT 1 FROM USERS WHERE USERNAME = 'admin');

-- =====================================================
-- 7. CREATE AUDIT/LOGGING TABLES
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
    USER_AGENT VARCHAR(500),
    REQUEST_BODY VARIANT,
    RESPONSE_STATUS INTEGER,
    RESPONSE_TIME_MS INTEGER,
    ERROR_MESSAGE VARCHAR(1000),
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

-- Create system settings table
CREATE HYBRID TABLE IF NOT EXISTS SYSTEM_SETTINGS (
    SETTING_KEY VARCHAR(100) NOT NULL PRIMARY KEY,
    SETTING_VALUE VARIANT NOT NULL,
    DESCRIPTION VARCHAR(500),
    UPDATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_BY VARCHAR(255)
);

-- Insert default system settings
INSERT INTO SYSTEM_SETTINGS (SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_BY)
SELECT 'log_level', 'info', 'Logging level (error, warn, info, debug)', 'system'
WHERE NOT EXISTS (SELECT 1 FROM SYSTEM_SETTINGS WHERE SETTING_KEY = 'log_level');

INSERT INTO SYSTEM_SETTINGS (SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_BY)
SELECT 'rate_limit_default', 100, 'Default rate limit for new endpoints (requests per minute)', 'system'
WHERE NOT EXISTS (SELECT 1 FROM SYSTEM_SETTINGS WHERE SETTING_KEY = 'rate_limit_default');

INSERT INTO SYSTEM_SETTINGS (SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_BY)
SELECT 'session_timeout', 3600, 'Session timeout in seconds (default: 1 hour)', 'system'
WHERE NOT EXISTS (SELECT 1 FROM SYSTEM_SETTINGS WHERE SETTING_KEY = 'session_timeout');

INSERT INTO SYSTEM_SETTINGS (SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_BY)
SELECT 'enable_audit_log', TRUE, 'Enable audit logging to API_AUDIT_LOG table', 'system'
WHERE NOT EXISTS (SELECT 1 FROM SYSTEM_SETTINGS WHERE SETTING_KEY = 'enable_audit_log');

-- =====================================================
-- 8. CREATE HELPFUL VIEWS
-- =====================================================

-- View for active endpoints with token info
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

-- =====================================================
-- 9. CREATE USEFUL VIEWS FOR ANALYTICS
-- =====================================================

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
-- 10. VERIFICATION
-- =====================================================

-- Verify tables were created
SHOW TABLES;

-- Verify default user was created
SELECT USER_ID, USERNAME, EMAIL, ROLE, IS_ACTIVE, CREATED_AT
FROM USERS
WHERE USERNAME = 'admin';

-- Display completion message
SELECT 'Database tables created successfully!' AS STATUS;

