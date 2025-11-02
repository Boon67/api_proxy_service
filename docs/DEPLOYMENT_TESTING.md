# Deployment Testing Guide

This guide explains how to test the deployment process end-to-end to ensure everything works correctly before deploying to production.

## Available Test Scripts

### 1. `test-deploy-validation.sh` - Quick Validation
**Purpose**: Validates prerequisites and basic functionality without creating resources.

```bash
npm run test:deploy
# or
./scripts/test-deploy-validation.sh
```

**What it tests:**
- ✅ Snow CLI installation and version
- ✅ Snow CLI connection
- ✅ SQL query execution
- ✅ Role creation permissions (ACCOUNTADMIN)
- ✅ Variable expansion in GRANT statements
- ✅ Docker availability

**Use when**: You want a quick check before attempting deployment.

### 2. `test-deploy-e2e.sh` - Full End-to-End Test
**Purpose**: Tests the complete deployment process including resource creation and cleanup.

```bash
npm run test:deploy:e2e
# or
./scripts/test-deploy-e2e.sh
```

**What it tests:**
1. ✅ Prerequisites (Snow CLI, Docker, etc.)
2. ✅ SQL script execution with variable substitution
3. ✅ Resource creation (database, warehouse, role, user)
4. ✅ Resource verification
5. ✅ Cleanup (removes test resources)

**Options:**
```bash
# Skip actual service deployment (faster, only tests setup)
./scripts/test-deploy-e2e.sh --skip-deployment

# Leave resources for inspection (no cleanup)
./scripts/test-deploy-e2e.sh --skip-cleanup

# Use custom test database name
./scripts/test-deploy-e2e.sh --database MY_TEST_DB

# Verbose output (see SQL execution)
./scripts/test-deploy-e2e.sh --verbose
```

**Use when**: You want to fully test the deployment process including actual resource creation.

## Test Workflow

### Recommended Testing Sequence

1. **Quick Validation** (1-2 minutes)
   ```bash
   npm run test:deploy
   ```
   This ensures all prerequisites are met before spending time on full deployment.

2. **End-to-End Test** (5-10 minutes)
   ```bash
   npm run test:deploy:e2e
   ```
   This creates actual resources, verifies them, and cleans up.

3. **Full Deployment Test** (if needed)
   ```bash
   # Use test names to avoid conflicts
   ./scripts/deploy.sh --database API_PROXY_TEST --warehouse API_PROXY_WH_TEST
   
   # Verify deployment
   ./scripts/health-check.sh
   
   # Cleanup
   ./scripts/cleanup.sh --database API_PROXY_TEST --warehouse API_PROXY_WH_TEST --yes
   ```

## What Gets Created During E2E Test

The end-to-end test creates the following **test resources** (with `_TEST` suffix):

- **Database**: `API_PROXY_TEST`
- **Warehouse**: `API_PROXY_WH_TEST`
- **Role**: `API_PROXY_SERVICE_ROLE_TEST`
- **User**: `API_PROXY_SERVICE_USER_TEST`
- **Schema**: `APP` (inside test database)

These are automatically cleaned up unless you use `--skip-cleanup`.

## Test Output

### Successful Test Output

```
╔════════════════════════════════════════════════════════════╗
║   End-to-End Deployment Test                               ║
╚════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: Testing Prerequisites
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Snow CLI is installed
✅ Snow CLI connection works
✅ SQL queries work
✅ Docker is running

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2: Testing SQL Script Execution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ SQL scripts found
✅ SQL script variable substitution works

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3: Testing Resource Creation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ SQL script executed successfully
✅ Database API_PROXY_TEST was created
✅ Warehouse API_PROXY_WH_TEST was created
✅ Role API_PROXY_SERVICE_ROLE_TEST was created
✅ User API_PROXY_SERVICE_USER_TEST was created

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5: Cleaning Up Test Resources
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Database API_PROXY_TEST dropped
✅ Warehouse API_PROXY_WH_TEST dropped
✅ User API_PROXY_SERVICE_USER_TEST dropped
✅ Role API_PROXY_SERVICE_ROLE_TEST dropped

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tests Passed: 12
Tests Failed: 0

✅ All tests passed!
```

## Troubleshooting

### Test Failures

**Snow CLI not installed**
```bash
# Install Snow CLI
brew install snowflake-labs/snowflake/snow-cli
```

**Snow CLI connection fails**
```bash
# Configure connection
snow connection add
# or test existing connection
snow connection test
```

**SQL script execution fails**
- Check if you have ACCOUNTADMIN role (or appropriate permissions)
- Verify Snowflake connection is working: `snow sql -q "SELECT 1"`
- Use `--verbose` flag to see detailed SQL output

**Docker not running**
```bash
# Start Docker Desktop (macOS/Windows)
# or start Docker daemon (Linux)
sudo systemctl start docker
```

**Resource creation fails**
- Ensure you have appropriate permissions
- Check if test resources already exist (from previous failed test)
- Clean up manually: `./scripts/cleanup.sh --database API_PROXY_TEST --yes`

### Manual Cleanup

If tests fail partway through and leave test resources:

```bash
# Clean up test resources
./scripts/cleanup.sh \
  --database API_PROXY_TEST \
  --warehouse API_PROXY_WH_TEST \
  --yes

# Or manually via SQL
snow sql << EOF
DROP DATABASE IF EXISTS API_PROXY_TEST CASCADE;
DROP WAREHOUSE IF EXISTS API_PROXY_WH_TEST;
DROP USER IF EXISTS API_PROXY_SERVICE_USER_TEST;
DROP ROLE IF EXISTS API_PROXY_SERVICE_ROLE_TEST;
EOF
```

## Continuous Integration

For CI/CD pipelines, use non-interactive mode:

```yaml
# Example GitHub Actions
- name: Test Deployment
  run: |
    ./scripts/test-deploy-e2e.sh --skip-deployment --verbose
  env:
    SNOWFLAKE_ROLE_MODE: ACCOUNTADMIN
```

## Best Practices

1. **Always run validation first** before full deployment
2. **Use test resources** with `_TEST` suffix to avoid conflicts
3. **Run cleanup** after tests (unless inspecting resources)
4. **Check prerequisites** before running expensive operations
5. **Use verbose mode** when debugging test failures
6. **Clean up manually** if automated cleanup fails

## Next Steps

After tests pass:

1. **Review deployment checklist**: `DEPLOYMENT_CHECKLIST.md`
2. **Run actual deployment**: `npm run deploy:production`
3. **Verify deployment**: `./scripts/health-check.sh`
4. **Monitor logs**: `snow spcs service logs SNOWFLAKE_API_PROXY`

## See Also

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Deployment Checklist](../DEPLOYMENT_CHECKLIST.md)
- [Cleanup Guide](./CLEANUP_GUIDE.md)
- [Role Mode Guide](./ROLE_MODE_GUIDE.md)

