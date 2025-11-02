-- =====================================================
-- Snowflake API Proxy Service - Performance Monitoring
-- =====================================================
-- This script provides queries to monitor and optimize
-- the performance of the API Proxy Service tables
--
-- Run as API_PROXY_SERVICE_ROLE or higher
-- =====================================================

-- Set context
USE ROLE API_PROXY_SERVICE_ROLE;
USE DATABASE API_PROXY;
USE SCHEMA PUBLIC;

-- =====================================================
-- 1. CLUSTERING INFORMATION
-- =====================================================

-- Check clustering information for API_AUDIT_LOG
SELECT SYSTEM$CLUSTERING_INFORMATION('API_AUDIT_LOG');

-- Check clustering information for TOKEN_USAGE_LOG
SELECT SYSTEM$CLUSTERING_INFORMATION('TOKEN_USAGE_LOG');

-- =====================================================
-- 2. TABLE STATISTICS
-- =====================================================

-- Get table row counts and sizes
SELECT 
    TABLE_NAME,
    ROW_COUNT,
    BYTES,
    ROUND(BYTES / 1024 / 1024, 2) AS SIZE_MB,
    ROUND(BYTES / ROW_COUNT, 2) AS BYTES_PER_ROW
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'PUBLIC'
  AND TABLE_NAME IN ('API_AUDIT_LOG', 'TOKEN_USAGE_LOG')
ORDER BY BYTES DESC;

-- =====================================================
-- 3. QUERY PERFORMANCE ANALYSIS
-- =====================================================

-- Analyze query performance for common patterns
-- (Run these queries and check the query profile in Snowflake UI)

-- Time-based queries (should use clustering)
SELECT 
    ENDPOINT_ID,
    COUNT(*) AS REQUEST_COUNT,
    AVG(RESPONSE_TIME_MS) AS AVG_RESPONSE_TIME
FROM API_AUDIT_LOG
WHERE CREATED_AT >= DATEADD(DAY, -7, CURRENT_TIMESTAMP())
GROUP BY ENDPOINT_ID
ORDER BY REQUEST_COUNT DESC;

-- Token-based queries (should use clustering)
SELECT 
    TOKEN_ID,
    COUNT(*) AS USAGE_COUNT,
    MAX(LAST_USED) AS LAST_USED
FROM TOKEN_USAGE_LOG
WHERE LAST_USED >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
GROUP BY TOKEN_ID
ORDER BY USAGE_COUNT DESC;

-- =====================================================
-- 4. CLUSTERING DEPTH ANALYSIS
-- =====================================================

-- Check clustering depth for API_AUDIT_LOG
SELECT 
    'API_AUDIT_LOG' AS TABLE_NAME,
    CLUSTERING_KEY,
    TOTAL_CLUSTER_COUNT,
    AVERAGE_OVERLAPS,
    AVERAGE_DEPTH,
    CASE 
        WHEN AVERAGE_DEPTH < 1.0 THEN 'Excellent'
        WHEN AVERAGE_DEPTH < 2.0 THEN 'Good'
        WHEN AVERAGE_DEPTH < 4.0 THEN 'Fair'
        ELSE 'Poor - Consider reclustering'
    END AS CLUSTERING_QUALITY
FROM TABLE(SYSTEM$CLUSTERING_INFORMATION('API_AUDIT_LOG'));

-- Check clustering depth for TOKEN_USAGE_LOG
SELECT 
    'TOKEN_USAGE_LOG' AS TABLE_NAME,
    CLUSTERING_KEY,
    TOTAL_CLUSTER_COUNT,
    AVERAGE_OVERLAPS,
    AVERAGE_DEPTH,
    CASE 
        WHEN AVERAGE_DEPTH < 1.0 THEN 'Excellent'
        WHEN AVERAGE_DEPTH < 2.0 THEN 'Good'
        WHEN AVERAGE_DEPTH < 4.0 THEN 'Fair'
        ELSE 'Poor - Consider reclustering'
    END AS CLUSTERING_QUALITY
FROM TABLE(SYSTEM$CLUSTERING_INFORMATION('TOKEN_USAGE_LOG'));

-- =====================================================
-- 5. RECLUSTERING RECOMMENDATIONS
-- =====================================================

-- Check if tables need reclustering
SELECT 
    TABLE_NAME,
    CASE 
        WHEN AVERAGE_DEPTH > 4.0 THEN 'RECLUSTER RECOMMENDED'
        WHEN AVERAGE_DEPTH > 2.0 THEN 'MONITOR CLOSELY'
        ELSE 'CLUSTERING IS GOOD'
    END AS RECLUSTERING_STATUS
FROM (
    SELECT 'API_AUDIT_LOG' AS TABLE_NAME, AVERAGE_DEPTH
    FROM TABLE(SYSTEM$CLUSTERING_INFORMATION('API_AUDIT_LOG'))
    UNION ALL
    SELECT 'TOKEN_USAGE_LOG' AS TABLE_NAME, AVERAGE_DEPTH
    FROM TABLE(SYSTEM$CLUSTERING_INFORMATION('TOKEN_USAGE_LOG'))
);

-- =====================================================
-- 6. PERFORMANCE OPTIMIZATION QUERIES
-- =====================================================

-- Create materialized view for frequently accessed statistics
CREATE OR REPLACE MATERIALIZED VIEW API_PERFORMANCE_SUMMARY AS
SELECT 
    DATE_TRUNC('HOUR', CREATED_AT) AS HOUR,
    ENDPOINT_ID,
    COUNT(*) AS REQUEST_COUNT,
    AVG(RESPONSE_TIME_MS) AS AVG_RESPONSE_TIME_MS,
    MAX(RESPONSE_TIME_MS) AS MAX_RESPONSE_TIME_MS,
    COUNT(CASE WHEN RESPONSE_STATUS >= 400 THEN 1 END) AS ERROR_COUNT,
    ROUND(ERROR_COUNT / REQUEST_COUNT * 100, 2) AS ERROR_RATE_PERCENT
FROM API_AUDIT_LOG
WHERE CREATED_AT >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
GROUP BY DATE_TRUNC('HOUR', CREATED_AT), ENDPOINT_ID;

-- Create materialized view for token usage patterns
CREATE OR REPLACE MATERIALIZED VIEW TOKEN_USAGE_SUMMARY AS
SELECT 
    TOKEN_ID,
    ENDPOINT_ID,
    COUNT(*) AS TOTAL_REQUESTS,
    SUM(REQUEST_COUNT) AS TOTAL_REQUEST_COUNT,
    MIN(LAST_USED) AS FIRST_USED,
    MAX(LAST_USED) AS LAST_USED,
    DATEDIFF(DAY, MIN(LAST_USED), MAX(LAST_USED)) AS ACTIVE_DAYS
FROM TOKEN_USAGE_LOG
WHERE LAST_USED >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
GROUP BY TOKEN_ID, ENDPOINT_ID;

-- =====================================================
-- 7. DATA RETENTION AND CLEANUP
-- =====================================================

-- Query to identify old data for cleanup
SELECT 
    'API_AUDIT_LOG' AS TABLE_NAME,
    MIN(CREATED_AT) AS OLDEST_RECORD,
    MAX(CREATED_AT) AS NEWEST_RECORD,
    COUNT(*) AS TOTAL_RECORDS,
    COUNT(CASE WHEN CREATED_AT < DATEADD(DAY, -90, CURRENT_TIMESTAMP()) THEN 1 END) AS RECORDS_OLDER_THAN_90_DAYS
FROM API_AUDIT_LOG

UNION ALL

SELECT 
    'TOKEN_USAGE_LOG' AS TABLE_NAME,
    MIN(CREATED_AT) AS OLDEST_RECORD,
    MAX(CREATED_AT) AS NEWEST_RECORD,
    COUNT(*) AS TOTAL_RECORDS,
    COUNT(CASE WHEN CREATED_AT < DATEADD(DAY, -90, CURRENT_TIMESTAMP()) THEN 1 END) AS RECORDS_OLDER_THAN_90_DAYS
FROM TOKEN_USAGE_LOG;

-- =====================================================
-- 8. WAREHOUSE USAGE MONITORING
-- =====================================================

-- Check warehouse usage for the service
SELECT 
    WAREHOUSE_NAME,
    CREDITS_USED,
    CREDITS_USED_COMPUTE,
    CREDITS_USED_CLOUD_SERVICES,
    START_TIME,
    END_TIME
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_EVENTS_HISTORY
WHERE WAREHOUSE_NAME = 'API_PROXY_WH'
  AND START_TIME >= DATEADD(DAY, -7, CURRENT_TIMESTAMP())
ORDER BY START_TIME DESC;

-- =====================================================
-- 9. QUERY HISTORY ANALYSIS
-- =====================================================

-- Analyze recent queries for performance issues
SELECT 
    QUERY_ID,
    QUERY_TEXT,
    EXECUTION_TIME,
    BYTES_SCANNED,
    ROWS_PRODUCED,
    PARTITIONS_SCANNED,
    PARTITIONS_TOTAL,
    START_TIME
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE USER_NAME = 'API_PROXY_SERVICE_USER'
  AND START_TIME >= DATEADD(HOUR, -24, CURRENT_TIMESTAMP())
  AND EXECUTION_TIME > 1000  -- Queries taking more than 1 second
ORDER BY EXECUTION_TIME DESC
LIMIT 10;

-- =====================================================
-- 10. AUTOMATED RECLUSTERING (if needed)
-- =====================================================

-- Procedure to automatically recluster tables if needed
CREATE OR REPLACE PROCEDURE AUTO_RECLUSTER_TABLES()
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE
    api_depth FLOAT;
    token_depth FLOAT;
    result STRING := '';
BEGIN
    -- Check API_AUDIT_LOG clustering
    SELECT AVERAGE_DEPTH INTO api_depth
    FROM TABLE(SYSTEM$CLUSTERING_INFORMATION('API_AUDIT_LOG'));
    
    -- Check TOKEN_USAGE_LOG clustering
    SELECT AVERAGE_DEPTH INTO token_depth
    FROM TABLE(SYSTEM$CLUSTERING_INFORMATION('TOKEN_USAGE_LOG'));
    
    -- Recluster API_AUDIT_LOG if needed
    IF api_depth > 4.0 THEN
        ALTER TABLE API_AUDIT_LOG RECLUSTER;
        result := result || 'API_AUDIT_LOG reclustered. ';
    END IF;
    
    -- Recluster TOKEN_USAGE_LOG if needed
    IF token_depth > 4.0 THEN
        ALTER TABLE TOKEN_USAGE_LOG RECLUSTER;
        result := result || 'TOKEN_USAGE_LOG reclustered. ';
    END IF;
    
    -- Return result
    IF result = '' THEN
        result := 'No reclustering needed.';
    END IF;
    
    RETURN result;
END;
$$;

-- Grant usage on the procedure
GRANT USAGE ON PROCEDURE AUTO_RECLUSTER_TABLES() TO ROLE API_PROXY_SERVICE_ROLE;

-- =====================================================
-- 11. PERFORMANCE MONITORING DASHBOARD QUERIES
-- =====================================================

-- Top endpoints by request count (last 24 hours)
SELECT 
    ENDPOINT_ID,
    COUNT(*) AS REQUEST_COUNT,
    AVG(RESPONSE_TIME_MS) AS AVG_RESPONSE_TIME_MS,
    COUNT(CASE WHEN RESPONSE_STATUS >= 400 THEN 1 END) AS ERROR_COUNT
FROM API_AUDIT_LOG
WHERE CREATED_AT >= DATEADD(DAY, -1, CURRENT_TIMESTAMP())
GROUP BY ENDPOINT_ID
ORDER BY REQUEST_COUNT DESC
LIMIT 10;

-- Response time trends (hourly)
SELECT 
    DATE_TRUNC('HOUR', CREATED_AT) AS HOUR,
    AVG(RESPONSE_TIME_MS) AS AVG_RESPONSE_TIME_MS,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY RESPONSE_TIME_MS) AS P95_RESPONSE_TIME_MS,
    COUNT(*) AS REQUEST_COUNT
FROM API_AUDIT_LOG
WHERE CREATED_AT >= DATEADD(DAY, -7, CURRENT_TIMESTAMP())
GROUP BY DATE_TRUNC('HOUR', CREATED_AT)
ORDER BY HOUR;

-- Token usage patterns
SELECT 
    TOKEN_ID,
    COUNT(*) AS USAGE_SESSIONS,
    SUM(REQUEST_COUNT) AS TOTAL_REQUESTS,
    MAX(LAST_USED) AS LAST_USED
FROM TOKEN_USAGE_LOG
WHERE LAST_USED >= DATEADD(DAY, -7, CURRENT_TIMESTAMP())
GROUP BY TOKEN_ID
ORDER BY TOTAL_REQUESTS DESC
LIMIT 10;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

SELECT 'Performance monitoring queries completed successfully!' AS STATUS;
