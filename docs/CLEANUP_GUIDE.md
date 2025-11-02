# Cleanup Guide

The cleanup script (`scripts/cleanup.sh`) removes all resources created by the deployment script, including services, compute pools, databases, warehouses, users, and roles.

## Quick Start

### Interactive Mode (Recommended)
```bash
# Asks for confirmation before deleting
npm run cleanup
# or
./scripts/cleanup.sh
```

### Non-Interactive Mode
```bash
# Auto-confirms (useful for automation/CI)
npm run cleanup:yes
# or
./scripts/cleanup.sh --yes
```

## What Gets Removed

The cleanup script removes the following resources **in order**:

1. **Service** (`SNOWFLAKE_API_PROXY`)
   - Drops the Snowflake Container Service
   
2. **Compute Pool** (`API_PROXY_POOL`)
   - Drops the compute pool used by the service
   
3. **Database** (`API_PROXY`)
   - Drops the database (cascades to all schemas, tables, views, etc.)
   
4. **Warehouse** (`API_PROXY_WH`)
   - Drops the warehouse
   
5. **User** (`API_PROXY_SERVICE_USER`)
   - Drops the service user account
   
6. **Role** (`API_PROXY_SERVICE_ROLE`)
   - Drops the service role

## Command-Line Options

```bash
./scripts/cleanup.sh [OPTIONS]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --database NAME` | Database name to drop | `API_PROXY` |
| `-s, --schema NAME` | Schema name (for reference) | `APP` |
| `-w, --warehouse NAME` | Warehouse name to drop | `API_PROXY_WH` |
| `-c, --compute-pool NAME` | Compute pool name to drop | `API_PROXY_POOL` |
| `-n, --service NAME` | Service name to drop | `SNOWFLAKE_API_PROXY` |
| `-r, --role-mode MODE` | Role mode: ACCOUNTADMIN, SYSADMIN, USERADMIN, or AUTO | `AUTO` |
| `-y, --yes` | Auto-confirm (non-interactive) | `false` |
| `-h, --help` | Show help message | - |

## Environment Variables

You can also set defaults via environment variables:

```bash
export SNOWFLAKE_DATABASE=MY_DB
export SNOWFLAKE_SCHEMA=MY_SCHEMA
export SNOWFLAKE_WAREHOUSE=MY_WH
export SNOWFLAKE_COMPUTE_POOL=MY_POOL
export SNOWFLAKE_ROLE_MODE=AUTO

./scripts/cleanup.sh
```

## Examples

### Basic Cleanup
```bash
# Interactive cleanup with defaults
./scripts/cleanup.sh
```

### Custom Resource Names
```bash
# Cleanup with custom database and warehouse names
./scripts/cleanup.sh --database MY_CUSTOM_DB --warehouse MY_CUSTOM_WH
```

### Force Cleanup (Non-Interactive)
```bash
# Auto-confirm (useful for scripts)
./scripts/cleanup.sh --yes
```

### Using ACCOUNTADMIN Role
```bash
# Force use of ACCOUNTADMIN (if other roles have permission issues)
./scripts/cleanup.sh --role-mode ACCOUNTADMIN
```

## Role Mode Support

The cleanup script supports the same role modes as the deploy script:

- **AUTO** (default): Uses SYSADMIN for objects, USERADMIN for users/roles
- **ACCOUNTADMIN**: Uses ACCOUNTADMIN for all operations
- **SYSADMIN**: Uses SYSADMIN for objects, USERADMIN for users/roles
- **USERADMIN**: Uses USERADMIN for users/roles, SYSADMIN for objects

For more details, see [ROLE_MODE_GUIDE.md](./ROLE_MODE_GUIDE.md).

## Safety Features

### Confirmation Prompt
By default, the script asks for confirmation before proceeding:

```
⚠️  WARNING: This will permanently delete the following resources:
   Service: SNOWFLAKE_API_PROXY
   Compute Pool: API_PROXY_POOL
   Database: API_PROXY
   Schema: API_PROXY.APP
   Warehouse: API_PROXY_WH
   User: API_PROXY_SERVICE_USER
   Role: API_PROXY_SERVICE_ROLE
   All tables and views in API_PROXY.APP

Are you sure you want to continue? (yes/no):
```

Type `yes` or `y` to proceed, anything else to cancel.

### Resource Existence Checks
The script checks if each resource exists before attempting to drop it:
- Only attempts to drop resources that exist
- Provides clear messages for non-existent resources
- Continues even if some resources fail to drop (may have dependencies)

### Error Handling
- Connection test before starting
- Graceful handling of missing resources
- Clear error messages for failures
- Non-fatal errors don't stop the cleanup process

## Common Scenarios

### Cleanup After Failed Deployment
If deployment failed partway through, the cleanup script will:
- Only drop resources that were successfully created
- Skip resources that don't exist
- Provide clear feedback about what was dropped

### Partial Cleanup
If you've already manually dropped some resources:
- Script will detect missing resources
- Only attempts to drop existing resources
- Provides status for each resource

### Dependency Issues
If a resource cannot be dropped due to dependencies:
- Script reports the error
- Continues with other resources
- You may need to manually resolve dependencies

## Troubleshooting

### Error: "Failed to authenticate with Snowflake"
- **Cause**: Snow CLI connection not configured
- **Solution**: Run `snow connection test` first, or configure Snow CLI connection

### Error: "Failed to drop service"
- **Cause**: Service may be in use or already deleted
- **Solution**: Check service status with `snow spcs service list`

### Error: "Failed to drop compute pool"
- **Cause**: Pool may be in use by a service or already deleted
- **Solution**: Ensure service is dropped first, then drop compute pool

### Error: "Failed to drop database"
- **Cause**: Database may have dependencies or be in use
- **Solution**: Check for active connections or dependent objects

### Error: "Insufficient privileges"
- **Cause**: Current role doesn't have permissions
- **Solution**: Use `--role-mode ACCOUNTADMIN` or ensure your connection has necessary roles

## Manual Cleanup

If the cleanup script fails or you need to clean up manually:

```sql
-- 1. Drop service (via Snow CLI or UI)
-- snow spcs service drop SNOWFLAKE_API_PROXY

-- 2. Drop compute pool
DROP COMPUTE POOL IF EXISTS API_PROXY_POOL;

-- 3. Drop database (cascades to schema and all objects)
DROP DATABASE IF EXISTS API_PROXY CASCADE;

-- 4. Drop warehouse
DROP WAREHOUSE IF EXISTS API_PROXY_WH;

-- 5. Drop user
DROP USER IF EXISTS API_PROXY_SERVICE_USER;

-- 6. Drop role
DROP ROLE IF EXISTS API_PROXY_SERVICE_ROLE;
```

## Best Practices

1. **Always backup data** before cleanup if you have important data
2. **Use interactive mode** for safety (default)
3. **Check resource status** first if unsure what exists
4. **Verify completion** after cleanup
5. **Use non-interactive mode** only in automation/CI

## Integration with CI/CD

For automated cleanup in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Cleanup Snowflake Resources
  run: |
    export SNOWFLAKE_DATABASE=${{ env.DATABASE }}
    ./scripts/cleanup.sh --yes
  env:
    SNOWFLAKE_ROLE_MODE: ACCOUNTADMIN
```

## See Also

- [Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Role Mode Guide](./ROLE_MODE_GUIDE.md)
- [SQL Scripts Usage](./SQL_SCRIPTS_USAGE.md)

