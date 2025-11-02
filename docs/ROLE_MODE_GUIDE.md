# Role Mode Configuration Guide

The deployment script supports using different Snowflake roles instead of always requiring ACCOUNTADMIN. This follows the principle of least privilege.

## Available Role Modes

### AUTO (Default)
- **SYSADMIN**: Used for creating databases, warehouses, schemas, and granting object permissions
- **USERADMIN**: Used for creating users, roles, and role assignments

**Usage:**
```bash
./scripts/deploy.sh
# or
SNOWFLAKE_ROLE_MODE=AUTO ./scripts/deploy.sh
```

### SYSADMIN
- Uses **SYSADMIN** for all object operations (databases, warehouses, schemas, grants)
- Automatically switches to **USERADMIN** for user/role creation and management

**Usage:**
```bash
./scripts/deploy.sh --role-mode SYSADMIN
# or
SNOWFLAKE_ROLE_MODE=SYSADMIN ./scripts/deploy.sh
```

**Prerequisites:**
- Your Snow CLI connection must be authenticated as SYSADMIN (or have SYSADMIN role)
- SYSADMIN must be able to create databases, warehouses, and schemas
- For INFORMATION_SCHEMA access, ACCOUNTADMIN will be used as fallback

### USERADMIN
- Uses **USERADMIN** for user and role management
- Automatically switches to **SYSADMIN** for object creation (databases, warehouses, etc.)

**Usage:**
```bash
./scripts/deploy.sh --role-mode USERADMIN
```

**Prerequisites:**
- Your Snow CLI connection must have both USERADMIN and SYSADMIN roles
- USERADMIN can create users and roles
- SYSADMIN (or the user's role) can create databases and warehouses

### ACCOUNTADMIN
- Uses **ACCOUNTADMIN** for all operations (original behavior)

**Usage:**
```bash
./scripts/deploy.sh --role-mode ACCOUNTADMIN
```

## Role Capabilities

### SYSADMIN Can:
- Create databases, warehouses, schemas
- Grant permissions on objects it owns
- Create roles (in some configurations)
- **Cannot** create users (requires USERADMIN)

### USERADMIN Can:
- Create users and roles
- Grant roles to users
- Manage user properties
- **Cannot** create databases, warehouses, or schemas

### ACCOUNTADMIN Can:
- Everything SYSADMIN and USERADMIN can do
- Grant INFORMATION_SCHEMA access
- Manage account-level settings
- Has full account privileges

## Operation Mapping

| Operation | AUTO Mode | SYSADMIN Mode | USERADMIN Mode | ACCOUNTADMIN Mode |
|-----------|-----------|---------------|----------------|-------------------|
| Create Database | SYSADMIN | SYSADMIN | SYSADMIN | ACCOUNTADMIN |
| Create Warehouse | SYSADMIN | SYSADMIN | SYSADMIN | ACCOUNTADMIN |
| Create Schema | SYSADMIN | SYSADMIN | SYSADMIN | ACCOUNTADMIN |
| Create Role | USERADMIN | USERADMIN | USERADMIN | ACCOUNTADMIN |
| Create User | USERADMIN | USERADMIN | USERADMIN | ACCOUNTADMIN |
| Grant Object Permissions | SYSADMIN | SYSADMIN | SYSADMIN | ACCOUNTADMIN |

## Best Practices

1. **Use AUTO mode** (default) for most deployments - it automatically uses the least privilege role for each operation

2. **Pre-create resources** if using limited roles:
   ```sql
   -- As ACCOUNTADMIN, create and grant ownership:
   CREATE DATABASE API_PROXY;
   GRANT OWNERSHIP ON DATABASE API_PROXY TO ROLE SYSADMIN;
   
   CREATE WAREHOUSE API_PROXY_WH ...;
   GRANT OWNERSHIP ON WAREHOUSE API_PROXY_WH TO ROLE SYSADMIN;
   ```

3. **For production**, consider using AUTO mode with a deployment user that has:
   - SYSADMIN role (for object creation)
   - USERADMIN role (for user/role management)
   - Or use ACCOUNTADMIN only when absolutely necessary

4. **Check your current role**:
   ```bash
   snow sql -q "SELECT CURRENT_ROLE()"
   ```

## Troubleshooting

### Error: "Insufficient privileges to operate on account"
- **Cause**: Your connection doesn't have the required role
- **Solution**: 
  - Check your Snow CLI connection role: `snow connection test`
  - Update connection to use appropriate role
  - Or use `--role-mode ACCOUNTADMIN`


### Error: "Failed to create database/warehouse"
- **Cause**: SYSADMIN may not have permission if resources were created by ACCOUNTADMIN
- **Solution**:
  - Grant ownership to SYSADMIN: `GRANT OWNERSHIP ON DATABASE API_PROXY TO ROLE SYSADMIN;`
  - Or use `--role-mode ACCOUNTADMIN`

## Examples

```bash
# Default (AUTO mode - uses SYSADMIN/USERADMIN as appropriate)
./scripts/deploy.sh

# Explicitly use SYSADMIN for objects, USERADMIN for users
./scripts/deploy.sh --role-mode SYSADMIN

# Use only ACCOUNTADMIN (original behavior)
./scripts/deploy.sh --role-mode ACCOUNTADMIN

# With environment variable
export SNOWFLAKE_ROLE_MODE=AUTO
./scripts/deploy.sh
```

