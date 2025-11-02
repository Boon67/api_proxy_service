# PAT Token Setup Guide

This guide explains how to set up Programmatic Access Token (PAT) authentication for the `API_PROXY_SERVICE_USER` account.

## Overview

PAT tokens provide a more secure authentication method for service accounts compared to passwords. The `API_PROXY_SERVICE_USER` is created as a `SERVICE` type user and uses PAT tokens for authentication.

## Prerequisites

1. Service user must be created as `TYPE = SERVICE`
2. Network policy must be assigned to the service user
3. Service user must have the appropriate role granted

## Step 1: Verify User Setup

The `sql/setup_service_account.sql` script creates the user with the correct configuration. Verify the user exists:

```sql
SHOW USERS LIKE 'API_PROXY_SERVICE_USER';
```

The output should show `TYPE = SERVICE`.

## Step 2: Verify Network Policy

The network policy should already be created and assigned. Verify:

```sql
SHOW NETWORK POLICIES LIKE 'API_PROXY_SERVICE_NETWORK_POLICY';
SHOW USERS LIKE 'API_PROXY_SERVICE_USER';
-- Check that NETWORK_POLICY column shows API_PROXY_SERVICE_NETWORK_POLICY
```

## Step 3: Generate PAT Token

Generate a PAT token for the service user:

```sql
ALTER USER API_PROXY_SERVICE_USER
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

## Step 4: Update Configuration File

Update `config/snowflake.json` with the PAT token:

```json
{
  "account": "your-account.snowflakecomputing.com",
  "username": "API_PROXY_SERVICE_USER",
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

## Step 5: Test Connection

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

## Token Management

### View Existing Tokens

To see all PAT tokens for the user:

```sql
SHOW PROGRAMMATIC ACCESS TOKENS FOR USER API_PROXY_SERVICE_USER;
```

### Rotate Token

To create a new token (before the old one expires):

1. Generate new token:
```sql
ALTER USER API_PROXY_SERVICE_USER
  ADD PROGRAMMATIC ACCESS TOKEN API_PROXY_SERVICE_TOKEN_V2
  DAYS_TO_EXPIRY = 365;
```

2. Update `config/snowflake.json` with new token

3. Revoke old token:
```sql
ALTER USER API_PROXY_SERVICE_USER
  REVOKE PROGRAMMATIC ACCESS TOKEN API_PROXY_SERVICE_TOKEN;
```

### Check Token Expiration

```sql
SHOW PROGRAMMATIC ACCESS TOKENS FOR USER API_PROXY_SERVICE_USER;
-- Check EXPIRES_AT column
```

## Environment Variables (Alternative)

Instead of using `snowflake.json`, you can set environment variables:

```bash
export SNOWFLAKE_ACCOUNT="your-account.snowflakecomputing.com"
export SNOWFLAKE_USERNAME="API_PROXY_SERVICE_USER"
export SNOWFLAKE_TOKEN="snpat_xxxxxxxxxxxxxxxxxxxx..."
export SNOWFLAKE_WAREHOUSE="API_PROXY_WH"
export SNOWFLAKE_DATABASE="API_PROXY"
export SNOWFLAKE_SCHEMA="APP"
export SNOWFLAKE_ROLE="API_PROXY_SERVICE_ROLE"
```

## Authentication Priority

The backend uses the following authentication priority:

1. **SPCS (Production)**: OAuth token from `/snowflake/session/token` (automatically provided by Snowflake)
2. **Local Development**: PAT token from `config/snowflake.json` or `SNOWFLAKE_TOKEN` environment variable
3. **Fallback**: Username/password (not recommended, legacy support only)

## Security Best Practices

1. **Never commit tokens to version control**: Ensure `config/snowflake.json` is in `.gitignore`
2. **Use long expiration periods**: Set `DAYS_TO_EXPIRY` to 365 days for service accounts
3. **Rotate tokens regularly**: Create new tokens before expiration
4. **Use least privilege**: The service user should only have the minimum required permissions
5. **Monitor token usage**: Regularly check token usage and expiration dates
6. **Network policy**: In production, restrict the network policy to specific IP ranges instead of `0.0.0.0/0`

## Troubleshooting

### "Invalid credentials" error

- Verify the token was copied correctly (no extra spaces or line breaks)
- Check token hasn't expired: `SHOW PROGRAMMATIC ACCESS TOKENS FOR USER API_PROXY_SERVICE_USER;`
- Ensure network policy is assigned to the user

### "Network policy required" error

- Ensure network policy is created and assigned:
  ```sql
  ALTER USER API_PROXY_SERVICE_USER SET NETWORK_POLICY = API_PROXY_SERVICE_NETWORK_POLICY;
  ```

### "User type must be SERVICE" error

- Recreate the user with `TYPE = SERVICE`:
  ```sql
  DROP USER API_PROXY_SERVICE_USER;
  -- Then re-run setup_service_account.sql
  ```

## References

- [Snowflake PAT Token Documentation](https://docs.snowflake.com/en/user-guide/programmatic-access-tokens)
- [Snowflake SDK Authentication](https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-use#connecting)

