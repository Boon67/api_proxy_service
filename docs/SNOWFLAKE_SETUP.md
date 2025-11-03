# Snowflake Setup Guide

## Overview

This guide walks you through setting up a dedicated Snowflake user and role for the API Proxy Service. The service account will have minimal required permissions for secure operation.

## Prerequisites

- Snowflake account with ACCOUNTADMIN or appropriate privileges
- Access to create users, roles, databases, and warehouses
- Understanding of Snowflake security model

## Quick Setup

### 1. Run the Setup Script

The deployment script automatically runs the setup. For manual setup:

```sql
-- Execute the setup script
-- This creates the service account with essential permissions
\i sql/setup_service_account.sql
```

**Note**: For production deployments, use the deployment script which automatically runs `setup_service_account.sql`.

### 2. Update Configuration

After running the script, update your configuration files:

**config/snowflake.json:**
```json
{
  "account": "your-account.snowflakecomputing.com",
  "username": "API_PROXY_SERVICE_MANAGER",
  "password": "ChangeThisPassword123!",
  "warehouse": "API_PROXY_WH",
  "database": "API_PROXY",
  "schema": "APP",
  "role": "API_PROXY_SERVICE_ROLE"
}
```

**Environment Variables:**
```bash
export SNOWFLAKE_ACCOUNT="your-account.snowflakecomputing.com"
export SNOWFLAKE_USERNAME="API_PROXY_SERVICE_MANAGER"
export SNOWFLAKE_PASSWORD="ChangeThisPassword123!"
export SNOWFLAKE_WAREHOUSE="API_PROXY_WH"
export SNOWFLAKE_DATABASE="API_PROXY"
export SNOWFLAKE_SCHEMA="APP"
export SNOWFLAKE_ROLE="API_PROXY_SERVICE_ROLE"
```

## Detailed Setup Steps

### Step 1: Create Database and Schema

```sql
CREATE DATABASE IF NOT EXISTS API_PROXY;
CREATE SCHEMA IF NOT EXISTS API_PROXY.APP;
```

### Step 2: Create Warehouse

```sql
CREATE WAREHOUSE IF NOT EXISTS API_PROXY_WH
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;
```

### Step 3: Create Service Role

```sql
CREATE ROLE IF NOT EXISTS API_PROXY_SERVICE_ROLE
  COMMENT = 'Role for Snowflake API Proxy Service';
```

### Step 4: Create Service User

```sql
CREATE USER IF NOT EXISTS API_PROXY_SERVICE_MANAGER
  PASSWORD = 'ChangeThisPassword123!'
  LOGIN_NAME = 'API_PROXY_SERVICE_MANAGER'
  DISPLAY_NAME = 'API Proxy Service Manager'
  EMAIL = 'api-proxy-service@yourcompany.com'
  MUST_CHANGE_PASSWORD = FALSE
  DEFAULT_WAREHOUSE = 'API_PROXY_WH'
  DEFAULT_ROLE = 'API_PROXY_SERVICE_ROLE';
```

### Step 5: Grant Permissions

```sql
-- Grant warehouse usage
GRANT USAGE ON WAREHOUSE API_PROXY_WH TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant database and schema access
GRANT USAGE ON DATABASE API_PROXY TO ROLE API_PROXY_SERVICE_ROLE;
GRANT USAGE ON SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant table creation permissions
GRANT CREATE TABLE ON SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant permissions on existing and future tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON FUTURE TABLES IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Grant permissions on views
GRANT SELECT ON ALL VIEWS IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;
GRANT SELECT ON FUTURE VIEWS IN SCHEMA API_PROXY.APP TO ROLE API_PROXY_SERVICE_ROLE;

-- Assign role to user
GRANT ROLE API_PROXY_SERVICE_ROLE TO USER API_PROXY_SERVICE_MANAGER;

-- Set default role
ALTER USER API_PROXY_SERVICE_MANAGER SET DEFAULT_ROLE = 'API_PROXY_SERVICE_ROLE';
```

## PAT Token Authentication (Recommended)

PAT tokens provide a more secure authentication method for service accounts compared to passwords. The `API_PROXY_SERVICE_MANAGER` should use PAT tokens for authentication.

### Prerequisites for PAT Tokens

1. Service user must be created (the setup script handles this)
2. Network policy must be assigned to the service user
3. Service user must have the appropriate role granted

### Step 1: Verify User Setup

Verify the user exists and is configured correctly:

```sql
SHOW USERS LIKE 'API_PROXY_SERVICE_MANAGER';
```

The output should show the user details.

### Step 2: Verify Network Policy

The network policy should already be created and assigned. Verify:

```sql
SHOW NETWORK POLICIES LIKE 'API_PROXY_SERVICE_NETWORK_POLICY';
SHOW USERS LIKE 'API_PROXY_SERVICE_MANAGER';
-- Check that NETWORK_POLICY column shows API_PROXY_SERVICE_NETWORK_POLICY
```

### Step 3: Generate PAT Token

Generate a PAT token for the service user:

```sql
ALTER USER API_PROXY_SERVICE_MANAGER
  ADD PROGRAMMATIC ACCESS TOKEN API_PROXY_SERVICE_TOKEN
  DAYS_TO_EXPIRY = 365;
```

**IMPORTANT**: The command will return the `token_secret` value. **COPY THIS VALUE IMMEDIATELY** - it will not be displayed again!

Example output:
```
Statement executed successfully.

+-----------------------------------------------------------------+
| TOKEN_NAME                    | TOKEN_SECRET                   |
|-------------------------------+--------------------------------|
| API_PROXY_SERVICE_TOKEN       | snpat_xxxxxxxxxxxxxxxxxxxx... |
+-----------------------------------------------------------------+
```

### Step 4: Update Configuration File

Update `config/snowflake.json` with the PAT token:

```json
{
  "account": "your-account.snowflakecomputing.com",
  "username": "API_PROXY_SERVICE_MANAGER",
  "token": "snpat_xxxxxxxxxxxxxxxxxxxx...",
  "warehouse": "API_PROXY_WH",
  "database": "API_PROXY",
  "schema": "APP",
  "role": "API_PROXY_SERVICE_ROLE"
}
```

**Important**: 
- Remove the `password` field (if present)
- Add the `token` field with the token_secret value from Step 3
- Keep the token secure and never commit it to version control

### Step 5: Test Connection

Test the connection locally:

```bash
cd backend
npm start
```

Check the logs to confirm PAT token authentication:

```
Creating Snowflake connection using PAT token (local environment)
Snowflake connection established
```

### PAT Token Management

#### View Existing Tokens

To see all PAT tokens for the user:

```sql
SHOW PROGRAMMATIC ACCESS TOKENS FOR USER API_PROXY_SERVICE_MANAGER;
```

#### Rotate Token

To create a new token (before the old one expires):

1. Generate new token:
```sql
ALTER USER API_PROXY_SERVICE_MANAGER
  ADD PROGRAMMATIC ACCESS TOKEN API_PROXY_SERVICE_TOKEN_V2
  DAYS_TO_EXPIRY = 365;
```

2. Update `config/snowflake.json` with new token

3. Revoke old token:
```sql
ALTER USER API_PROXY_SERVICE_MANAGER
  REVOKE PROGRAMMATIC ACCESS TOKEN API_PROXY_SERVICE_TOKEN;
```

#### Check Token Expiration

```sql
SHOW PROGRAMMATIC ACCESS TOKENS FOR USER API_PROXY_SERVICE_MANAGER;
-- Check EXPIRES_AT column
```

### Environment Variables (Alternative)

Instead of using `snowflake.json`, you can set environment variables:

```bash
export SNOWFLAKE_ACCOUNT="your-account.snowflakecomputing.com"
export SNOWFLAKE_USERNAME="API_PROXY_SERVICE_MANAGER"
export SNOWFLAKE_TOKEN="snpat_xxxxxxxxxxxxxxxxxxxx..."
export SNOWFLAKE_WAREHOUSE="API_PROXY_WH"
export SNOWFLAKE_DATABASE="API_PROXY"
export SNOWFLAKE_SCHEMA="APP"
export SNOWFLAKE_ROLE="API_PROXY_SERVICE_ROLE"
```

### Authentication Priority

The backend uses the following authentication priority:

1. **SPCS (Production)**: OAuth token from `/snowflake/session/token` (automatically provided by Snowflake)
2. **Local Development**: PAT token from `config/snowflake.json` or `SNOWFLAKE_TOKEN` environment variable
3. **Fallback**: Username/password (not recommended, legacy support only)

### PAT Token Security Best Practices

1. **Never commit tokens to version control**: Ensure `config/snowflake.json` is in `.gitignore`
2. **Use long expiration periods**: Set `DAYS_TO_EXPIRY` to 365 days for service accounts
3. **Rotate tokens regularly**: Create new tokens before expiration
4. **Use least privilege**: The service user should only have the minimum required permissions
5. **Monitor token usage**: Regularly check token usage and expiration dates
6. **Network policy**: In production, restrict the network policy to specific IP ranges instead of `0.0.0.0/0`

### Troubleshooting PAT Tokens

#### "Invalid credentials" error

- Verify the token was copied correctly (no extra spaces or line breaks)
- Check token hasn't expired: `SHOW PROGRAMMATIC ACCESS TOKENS FOR USER API_PROXY_SERVICE_MANAGER;`
- Ensure network policy is assigned to the user

#### "Network policy required" error

- Ensure network policy is created and assigned:
  ```sql
  ALTER USER API_PROXY_SERVICE_MANAGER SET NETWORK_POLICY = API_PROXY_SERVICE_NETWORK_POLICY;
  ```

#### "User type must be SERVICE" error

- The user should be created normally (not necessarily as SERVICE type for PAT tokens)
- Verify user exists: `SHOW USERS LIKE 'API_PROXY_SERVICE_MANAGER';`

## Production Recommendations

### 1. Security Hardening

- Use PAT tokens instead of passwords
- Enable MFA if possible
- Implement IP whitelisting via network policy
- Use key-pair authentication for administrative access
- Regular token rotation

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

### Remove Service Account

```sql
-- Run as ACCOUNTADMIN
DROP USER API_PROXY_SERVICE_MANAGER;
DROP ROLE API_PROXY_SERVICE_ROLE;
DROP DATABASE API_PROXY;
DROP WAREHOUSE API_PROXY_WH;
```

### Verify Cleanup

```sql
-- Verify objects are removed
SELECT NAME FROM SNOWFLAKE.ACCOUNT_USAGE.USERS WHERE NAME = 'API_PROXY_SERVICE_MANAGER';
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
- [Snowflake PAT Token Documentation](https://docs.snowflake.com/en/user-guide/programmatic-access-tokens)
- [Snowflake SDK Authentication](https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-use#connecting)
