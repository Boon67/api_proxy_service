# Snowflake Setup Guide

## Overview

This guide walks you through setting up a dedicated Snowflake user and role for the API Proxy Service. The service account will have minimal required permissions for secure operation.

## Prerequisites

- Snowflake account with ACCOUNTADMIN or SYSADMIN privileges
- Access to create users, roles, databases, and warehouses
- Understanding of Snowflake security model

## Quick Setup

### 1. Run the Quick Setup Script

```sql
-- Execute the quick setup script
-- This creates a basic service account with essential permissions
\i sql/quick_setup.sql
```

### 2. Update Configuration

After running the script, update your configuration files:

**config/snowflake.json:**
```json
{
  "account": "your-account.snowflakecomputing.com",
  "username": "API_PROXY_SERVICE_USER",
  "password": "ChangeThisPassword123!",
  "warehouse": "API_PROXY_WH",
  "database": "API_PROXY",
  "schema": "PUBLIC",
  "role": "API_PROXY_SERVICE_ROLE"
}
```

**Environment Variables:**
```bash
export SNOWFLAKE_ACCOUNT="your-account.snowflakecomputing.com"
export SNOWFLAKE_USERNAME="API_PROXY_SERVICE_USER"
export SNOWFLAKE_PASSWORD="ChangeThisPassword123!"
export SNOWFLAKE_WAREHOUSE="API_PROXY_WH"
export SNOWFLAKE_DATABASE="API_PROXY"
export SNOWFLAKE_SCHEMA="PUBLIC"
export SNOWFLAKE_ROLE="API_PROXY_SERVICE_ROLE"
```

## Complete Setup

### 1. Run the Complete Setup Script

```sql
-- Execute the complete setup script
-- This creates a comprehensive service account with audit logging
\i sql/setup_service_account.sql
```

### 2. Features of Complete Setup

- **Service User**: `API_PROXY_SERVICE_USER`
- **Service Role**: `API_PROXY_SERVICE_ROLE`
- **Database**: `API_PROXY` with `PUBLIC` schema
- **Warehouse**: `API_PROXY_WH` (X-SMALL, auto-suspend enabled)
- **Audit Tables**: For logging API requests and token usage
- **Stored Procedures**: For common operations
- **Views**: For usage statistics and monitoring

## Security Considerations

### 1. Password Security

**Change the default password immediately:**
```sql
-- Change password for the service user
ALTER USER API_PROXY_SERVICE_USER SET PASSWORD = 'YourSecurePassword123!';
```

### 2. Network Security

**IP Whitelisting (Recommended):**
```sql
-- Restrict access to specific IP addresses
ALTER USER API_PROXY_SERVICE_USER SET NETWORK_POLICY = 'your_network_policy';
```

### 3. Data Access Control

**Row-Level Security (if needed):**
```sql
-- Example: Restrict data access based on user context
CREATE POLICY user_data_policy ON your_table
  FOR ALL TO API_PROXY_SERVICE_ROLE
  USING (user_id = CURRENT_USER());
```

**Column-Level Security (if needed):**
```sql
-- Example: Mask sensitive columns
CREATE MASKING POLICY email_mask ON (email string)
  RETURNS string ->
  CASE WHEN CURRENT_ROLE() = 'API_PROXY_SERVICE_ROLE' 
       THEN email
       ELSE REGEXP_REPLACE(email, '(.)(.*)@', '\\1***@')
  END;
```

## Permission Details

### 1. Warehouse Permissions
- `USAGE`: Execute queries using the warehouse

### 2. Database Permissions
- `USAGE`: Access the database

### 3. Schema Permissions
- `USAGE`: Access the schema
- `CREATE TABLE`: Create audit/logging tables
- `CREATE STAGE`: Create stages for file operations
- `CREATE PROCEDURE`: Create stored procedures
- `CREATE FUNCTION`: Create user-defined functions

### 4. Data Access Permissions
- `SELECT` on all current and future tables
- `SELECT` on all current and future views
- `USAGE` on all current and future procedures
- `USAGE` on all current and future functions

### 5. Information Schema Access
- `USAGE` on `INFORMATION_SCHEMA` database
- `SELECT` on `INFORMATION_SCHEMA` views for metadata queries

## Monitoring and Auditing

### 1. Audit Tables

The complete setup creates two audit tables with clustering keys for optimal performance:

**API_AUDIT_LOG:**
- Logs all API requests and responses
- Tracks performance metrics
- Records error information
- Clustered by (CREATED_AT, ENDPOINT_ID) for efficient time-based and endpoint queries

**TOKEN_USAGE_LOG:**
- Tracks token usage patterns
- Monitors endpoint access
- Provides usage statistics
- Clustered by (TOKEN_ID, LAST_USED) for efficient token-based queries

**Note:** Snowflake uses clustering keys instead of traditional indexes for query optimization.

### 2. Performance Optimization

**Clustering Keys:**
- `API_AUDIT_LOG` is clustered by `(CREATED_AT, ENDPOINT_ID)` for efficient time-range and endpoint-specific queries
- `TOKEN_USAGE_LOG` is clustered by `(TOKEN_ID, LAST_USED)` for efficient token-based lookups

**Query Optimization Tips:**
- Use `WHERE` clauses on clustered columns for best performance
- Consider partitioning large tables by date if they grow very large
- Use materialized views for frequently accessed aggregations
- Monitor clustering depth with `SYSTEM$CLUSTERING_INFORMATION()`

**Performance Monitoring:**
- Run `sql/performance_monitoring.sql` to analyze table performance
- Monitor clustering depth and recluster when needed
- Use materialized views for common aggregations
- Set up automated reclustering procedures for large tables

### 3. Monitoring Views

**API_USAGE_STATS:**
- Hourly request counts by endpoint
- Average response times
- Error rates

**TOKEN_USAGE_STATS:**
- Token usage patterns
- Active days per token
- Total request counts

### 3. Stored Procedures

**LOG_API_REQUEST:**
- Logs API requests to audit table
- Can be called from the application

**UPDATE_TOKEN_USAGE:**
- Updates token usage statistics
- Tracks access patterns

## Testing the Setup

### 1. Test Connection

```sql
-- Test the service account connection
USE ROLE API_PROXY_SERVICE_ROLE;
USE DATABASE API_PROXY;
USE SCHEMA PUBLIC;

-- Test basic query
SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_DATABASE(), CURRENT_SCHEMA();
```

### 2. Test Permissions

```sql
-- Test table creation
CREATE TABLE test_table (id INTEGER, name VARCHAR(100));
INSERT INTO test_table VALUES (1, 'test');
SELECT * FROM test_table;
DROP TABLE test_table;
```

### 3. Test Information Schema Access

```sql
-- Test metadata queries
SELECT TABLE_NAME, TABLE_TYPE 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'PUBLIC';
```

## Troubleshooting

### 1. Connection Issues

**Check user status:**
```sql
SELECT NAME, LOGIN_NAME, DISABLED, DEFAULT_ROLE, DEFAULT_WAREHOUSE
FROM SNOWFLAKE.ACCOUNT_USAGE.USERS 
WHERE NAME = 'API_PROXY_SERVICE_USER';
```

**Check role assignment:**
```sql
SHOW GRANTS TO USER API_PROXY_SERVICE_USER;
```

### 2. Permission Issues

**Check role permissions:**
```sql
SHOW GRANTS TO ROLE API_PROXY_SERVICE_ROLE;
```

**Test specific permissions:**
```sql
-- Test warehouse usage
USE WAREHOUSE API_PROXY_WH;

-- Test database access
USE DATABASE API_PROXY;

-- Test schema access
USE SCHEMA PUBLIC;
```

### 3. Common Issues

**Issue: User cannot connect**
- Check if user is disabled
- Verify password is correct
- Check network policies

**Issue: Permission denied**
- Verify role is assigned to user
- Check if role has required permissions
- Ensure user is using correct role

**Issue: Warehouse not found**
- Check if warehouse exists
- Verify role has USAGE permission on warehouse
- Check if warehouse is suspended

## Production Recommendations

### 1. Security Hardening

- Use strong, unique passwords
- Enable MFA if possible
- Implement IP whitelisting
- Use key-pair authentication
- Regular password rotation

### 2. Monitoring

- Set up alerts for failed logins
- Monitor warehouse usage
- Track API request patterns
- Review audit logs regularly

### 3. Backup and Recovery

- Regular backup of configuration
- Document all custom permissions
- Test disaster recovery procedures
- Maintain service account documentation

## Cleanup

### 1. Remove Service Account

```sql
-- Run as ACCOUNTADMIN
DROP USER API_PROXY_SERVICE_USER;
DROP ROLE API_PROXY_SERVICE_ROLE;
DROP DATABASE API_PROXY;
DROP WAREHOUSE API_PROXY_WH;
```

### 2. Verify Cleanup

```sql
-- Verify objects are removed
SELECT NAME FROM SNOWFLAKE.ACCOUNT_USAGE.USERS WHERE NAME = 'API_PROXY_SERVICE_USER';
SELECT ROLE_NAME FROM SNOWFLAKE.ACCOUNT_USAGE.ROLES WHERE ROLE_NAME = 'API_PROXY_SERVICE_ROLE';
```

## Support

For issues with Snowflake setup:

1. Check Snowflake documentation
2. Review error messages in query history
3. Verify account permissions
4. Contact Snowflake support if needed

## Additional Resources

- [Snowflake User Management](https://docs.snowflake.com/en/user-guide/admin-user-management.html)
- [Snowflake Role-Based Access Control](https://docs.snowflake.com/en/user-guide/security-access-control-overview.html)
- [Snowflake Security Best Practices](https://docs.snowflake.com/en/user-guide/security-best-practices.html)
