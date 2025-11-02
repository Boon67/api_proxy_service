# SQL Scripts Guide

Complete guide to SQL scripts used for database setup and management.

## Overview

The deployment script (`scripts/deploy.sh`) uses SQL scripts as the **single source of truth** for database setup, eliminating duplication between shell scripts and SQL.

## Architecture

### Single Source of Truth

- **SQL Scripts**: Define all database objects, users, roles, and permissions
- **Deploy Script**: Executes SQL scripts with variable substitution
- **Benefits**:
  - No duplication - database logic exists in one place
  - Easier maintenance - update SQL scripts, deploy script automatically uses them
  - Manual execution - SQL scripts can still be run manually if needed
  - Version control - SQL scripts are easier to review and version

## SQL Scripts

### 1. `sql/setup_service_account.sql`

**Purpose**: Comprehensive service account setup with all permissions

**Creates**:
- Database (`API_PROXY` → customizable via deploy script)
- Schema (`APP` → customizable via deploy script)
- Warehouse (`API_PROXY_WH` → customizable via deploy script)
- Service Role (`API_PROXY_SERVICE_ROLE`)
- Service User (`API_PROXY_SERVICE_USER`)
- All permissions and grants
- Audit/logging tables (optional)

**Used by**: `scripts/deploy.sh` (automated) or manual execution

**Resource Creation Order**:
1. Database and Schema (created first)
2. Warehouse
3. Service Role
4. Service User (references database/schema for DEFAULT_NAMESPACE)
5. Permissions and Grants
6. Audit Tables

### 2. `sql/create_tables.sql`

**Purpose**: Creates application tables for the service

**Creates**:
- `USERS` table
- `ENDPOINTS` table
- `API_KEYS` table (formerly PAT_TOKENS)
- Views and default data

**Prerequisites**: 
- Database, Schema (APP), Role with CREATE TABLE permission
- Run after `setup_service_account.sql` or after deploy script creates resources

**Usage**: 
```bash
# After deployment
snow sql -f sql/create_tables.sql --database API_PROXY --schema APP
```

### 3. `sql/quick_setup.sql`

**Purpose**: Simplified setup script for quick manual installation

**Creates**:
- Database, Schema (APP), Warehouse, Role, User
- Basic Permissions

**Use When**: 
- Manual setup
- Testing
- Quick start (without audit tables)

**Does NOT Create**: Audit tables, comprehensive permissions

**Run Before**: `sql/create_tables.sql`

### 4. `sql/performance_monitoring.sql`

**Purpose**: Optional performance monitoring and optimization

**Creates**:
- Monitoring views
- Performance metrics tables
- Query optimization helpers

## Resource Naming Convention

All scripts and `deploy.sh` use consistent naming:

| Resource | Default Name | Customizable |
|----------|-------------|--------------|
| Database | `API_PROXY` | ✅ `--database` flag |
| Schema | `APP` | ✅ `--schema` flag |
| Warehouse | `API_PROXY_WH` | ✅ `--warehouse` flag |
| Compute Pool | `API_PROXY_POOL` | ✅ `--compute-pool` flag |
| Service Role | `API_PROXY_SERVICE_ROLE` | ❌ Fixed |
| Service User | `API_PROXY_SERVICE_USER` | ❌ Fixed |

**Important**: Schema is `APP` (not `PUBLIC`) to align with deploy script defaults.

## Variable Substitution

The deploy script automatically replaces hardcoded values in SQL scripts:

| SQL Script Value | Deploy Script Variable | Default |
|------------------|------------------------|---------|
| `API_PROXY` | `DATABASE` or `--database` | `API_PROXY` |
| `API_PROXY_WH` | `WAREHOUSE` or `--warehouse` | `API_PROXY_WH` |
| `API_PROXY.APP` | `${DATABASE}.${SCHEMA}` | `API_PROXY.APP` |
| `API_PROXY_SERVICE_USER` | `SERVICE_USER_NAME` | `API_PROXY_SERVICE_USER` |
| `API_PROXY_SERVICE_ROLE` | `SERVICE_ROLE_NAME` | `API_PROXY_SERVICE_ROLE` |
| `'ChangeThisPassword123!'` | `SNOWFLAKE_SERVICE_USER_PASSWORD` | `ChangeThisPassword123!` |

### How Variable Substitution Works

1. **Deploy script reads SQL file**
2. **Replaces hardcoded values** using `sed`:
   ```bash
   sed -e "s/API_PROXY\.APP/${DATABASE}.${SCHEMA}/g" \
       -e "s/API_PROXY_WH/${WAREHOUSE}/g" \
       -e "s/\bAPI_PROXY\b/${DATABASE}/g" \
       ...
   ```
3. **Creates temporary SQL file** with replacements
4. **Executes modified SQL** using `snow sql -f`
5. **Cleans up temporary file**

## Usage Scenarios

### Scenario 1: Automated Deployment (Recommended)

```bash
# deploy.sh creates everything automatically using setup_service_account.sql
./scripts/deploy.sh

# Then create application tables
snow sql -f sql/create_tables.sql --database API_PROXY --schema APP
```

### Scenario 2: Manual Setup - Quick Start

```bash
# Run in Snowflake as ACCOUNTADMIN
snow sql -f sql/quick_setup.sql
snow sql -f sql/create_tables.sql
```

### Scenario 3: Manual Setup - Full Setup

```bash
# Run in Snowflake as ACCOUNTADMIN
snow sql -f sql/setup_service_account.sql
snow sql -f sql/create_tables.sql
```

### Scenario 4: Custom Resource Names

```bash
# Deploy with custom names
./scripts/deploy.sh \
  --database MY_DB \
  --schema MY_SCHEMA \
  --warehouse MY_WH

# SQL scripts are automatically updated with your names
```

For manual SQL with custom names, update all occurrences of:
- `API_PROXY` → your database name
- `APP` → your schema name
- `API_PROXY_WH` → your warehouse name

## Permissions

Both `deploy.sh` and SQL scripts grant the same permissions to `API_PROXY_SERVICE_ROLE`:

### Schema Permissions
- `CREATE TABLE`
- `CREATE STAGE`
- `CREATE PROCEDURE`
- `CREATE FUNCTION`

### Data Access Permissions
- `SELECT, INSERT, UPDATE, DELETE` on ALL TABLES (current and future)
- `SELECT` on ALL VIEWS (current and future)
- `USAGE` on ALL PROCEDURES (current and future)
- `USAGE` on ALL FUNCTIONS (current and future)

## Role Mode Compatibility

The SQL scripts use `ACCOUNTADMIN` by default. For non-ACCOUNTADMIN modes:

1. **ACCOUNTADMIN mode** (default in SQL): Works as-is
2. **AUTO/SYSADMIN/USERADMIN modes**: 
   - Deploy script attempts to modify `USE ROLE` statements
   - If errors occur, use `--role-mode ACCOUNTADMIN`

See [ROLE_MODE_GUIDE.md](./ROLE_MODE_GUIDE.md) for detailed role mode information.

## Verification

After setup (automated or manual), verify resources exist:

```sql
-- Verify database and schema
SHOW DATABASES LIKE 'API_PROXY';
SHOW SCHEMAS IN DATABASE API_PROXY;

-- Verify warehouse
SHOW WAREHOUSES LIKE 'API_PROXY_WH';

-- Verify role and user
SHOW ROLES LIKE 'API_PROXY_SERVICE_ROLE';
SHOW USERS LIKE 'API_PROXY_SERVICE_USER';

-- Verify tables (after running create_tables.sql)
SHOW TABLES IN SCHEMA API_PROXY.APP;
```

## Troubleshooting

### Schema Mismatch Error

**Symptom**: `Schema 'API_PROXY.PUBLIC' does not exist`

**Cause**: Scripts were run with old PUBLIC schema references

**Solution**: Ensure all scripts use `APP` schema, or manually create `APP` schema:
```sql
CREATE SCHEMA IF NOT EXISTS API_PROXY.APP;
```

### Permission Denied

**Symptom**: `Insufficient privileges to operate on account`

**Cause**: Not running as ACCOUNTADMIN or appropriate role

**Solution**: Switch to appropriate role:
```sql
USE ROLE ACCOUNTADMIN;
```

Or use deploy script with `--role-mode` option.

### Service Account Already Exists

**Symptom**: `User 'API_PROXY_SERVICE_USER' already exists`

**Cause**: Previous setup or deploy.sh already created it

**Solution**: Scripts use `IF NOT EXISTS`, so it's safe to re-run. Or drop and recreate:
```sql
DROP USER IF EXISTS API_PROXY_SERVICE_USER;
DROP ROLE IF EXISTS API_PROXY_SERVICE_ROLE;
```

### SQL Compilation Error

**Cause**: Variable substitution may have created invalid SQL

**Solution**: 
- Check that database/schema/warehouse names don't contain special characters
- Use simple names (letters, numbers, underscores)
- Review the temporary SQL file if deploy script shows errors

### SQL File Not Found

**Cause**: SQL directory path incorrect

**Solution**: Ensure you're running deploy.sh from project root, or SQL scripts are in `sql/` directory

## Best Practices

1. **Always update SQL scripts**, not deploy script inline code
2. **Test SQL scripts manually** before running deploy script
3. **Use version control** to track SQL script changes
4. **Document customizations** in SQL script comments
5. **Keep SQL scripts parameterized** (use consistent naming that deploy script can replace)
6. **Order matters**: Database and schema must be created before user (for DEFAULT_NAMESPACE)

## File Locations

```
api_proxy_service/
├── scripts/
│   └── deploy.sh          # Executes SQL scripts with variable substitution
└── sql/
    ├── setup_service_account.sql  # Main setup (used by deploy.sh)
    ├── create_tables.sql          # Application tables (run separately)
    ├── quick_setup.sql            # Simplified setup
    └── performance_monitoring.sql # Optional monitoring
```

## Migration Notes

If you were using deploy script with inline SQL:

1. ✅ **Already done**: Deploy script now uses SQL scripts
2. **Manual steps**: If you have custom SQL, add it to `sql/setup_service_account.sql`
3. **Verify**: Test deployment with `./scripts/deploy.sh --help` to see current behavior

## Additional Resources

- [Deployment Guide](./DEPLOYMENT.md) - Complete deployment instructions
- [Role Mode Guide](./ROLE_MODE_GUIDE.md) - Role-based deployment options
- [Deployment Testing](./DEPLOYMENT_TESTING.md) - Testing deployment process

