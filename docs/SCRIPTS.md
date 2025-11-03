# Scripts Guide

This document describes all scripts available in the `scripts/` directory.

## Script Overview

### Core Scripts

#### `deploy.sh` - Main Deployment Script
**Purpose**: Deploys the service to Snowflake Container Services

**Usage**:
```bash
./scripts/deploy.sh [OPTIONS] [VERSION]
# or
npm run deploy
npm run deploy:production
```

**Features**:
- Creates Snowflake resources (database, warehouse, role, user) via SQL scripts
- Builds Docker images for linux/amd64
- Pushes images to Snowflake Image Registry
- Deploys service to Snowflake Container Services
- Verifies deployment

**Options**:
- `--database`, `-d`: Database name (default: API_PROXY)
- `--schema`, `-s`: Schema name (default: APP)
- `--warehouse`, `-w`: Warehouse name (default: API_PROXY_WH)
- `--compute-pool`, `-c`: Compute pool name (default: API_PROXY_POOL)
- `--role-mode`, `-r`: Role mode (ACCOUNTADMIN, SYSADMIN, USERADMIN, AUTO)
- `--version`, `-v`: Image version tag (default: latest)

See [Deployment Guide](./DEPLOYMENT.md) for detailed documentation.

#### `cleanup.sh` - Resource Cleanup Script
**Purpose**: Removes all deployed Snowflake resources

**Usage**:
```bash
./scripts/cleanup.sh [OPTIONS]
# or
npm run cleanup           # Interactive
npm run cleanup:yes      # Auto-confirm
```

**Removes**:
- Container Service
- Compute Pool
- Database (and all contained objects)
- Warehouse
- Service User
- Service Role

**Options**:
- `--database`, `-d`: Database name to remove
- `--warehouse`, `-w`: Warehouse name to remove
- `--compute-pool`, `-c`: Compute pool name to remove
- `--yes`, `-y`: Skip confirmation prompt

See the [Deployment Guide](./DEPLOYMENT.md#cleanup) for detailed cleanup documentation.

#### `setup.sh` - Development Environment Setup
**Purpose**: Sets up local development environment

**Usage**:
```bash
./scripts/setup.sh
# or
npm run setup
```

**Features**:
- Checks Node.js and Docker installation
- Installs all dependencies (root, backend, frontend)
- Creates necessary directories
- Sets up configuration files (.env, config/snowflake.json)
- Provides next steps guidance

**Note**: This script is for local development setup only. For production deployment, use `deploy.sh`.

#### `health-check.sh` - Service Health Monitoring
**Purpose**: Monitors service health and status

**Usage**:
```bash
./scripts/health-check.sh
# or
npm run health-check
```

**Features**:
- Checks backend health endpoint
- Checks frontend accessibility
- Tests API endpoints
- Monitors Docker containers (if running locally)
- Checks system resources (memory, disk, ports)
- Generates health report

**Environment Variables**:
- `BACKEND_URL`: Backend URL (default: http://localhost:3001)
- `FRONTEND_URL`: Frontend URL (default: http://localhost:3000)
- `SERVICE_URL`: Service URL (overrides both URLs for production)
- `TIMEOUT`: Request timeout in seconds (default: 10)

### Testing Scripts

#### `test-deploy-validation.sh` - Quick Validation Test
**Purpose**: Validates deployment prerequisites without creating resources

**Usage**:
```bash
./scripts/test-deploy-validation.sh
# or
npm run test:deploy
```

**Tests**:
- Snow CLI installation and version
- Snow CLI connection
- SQL query execution
- Role creation permissions
- Variable expansion
- Docker availability

#### `test-deploy-e2e.sh` - End-to-End Deployment Test
**Purpose**: Full deployment test including resource creation and cleanup

**Usage**:
```bash
./scripts/test-deploy-e2e.sh [OPTIONS]
# or
npm run test:deploy:e2e
```

**Options**:
- `--skip-deployment`: Skip service deployment (only test setup)
- `--skip-cleanup`: Skip cleanup (leave resources for inspection)
- `--database`, `-d`: Test database name
- `--verbose`, `-v`: Show verbose output

**Tests**:
1. Prerequisites (Snow CLI, Docker, etc.)
2. SQL script execution with variable substitution
3. Resource creation (database, warehouse, role, user)
4. Resource verification
5. Cleanup (removes test resources)

See [Deployment Testing](./DEPLOYMENT_TESTING.md) for detailed documentation.

## Script Relationships

```
deploy.sh
  ├── Uses SQL scripts (setup_service_account.sql, create_tables.sql)
  ├── Calls: build_images(), push_images(), deploy_service()
  └── Creates resources that cleanup.sh can remove

cleanup.sh
  └── Removes resources created by deploy.sh

test-deploy-validation.sh
  └── Quick validation before running deploy.sh

test-deploy-e2e.sh
  └── Full test of deploy.sh functionality (uses test resources)

setup.sh
  └── Local development setup (separate from deployment)

health-check.sh
  └── Monitoring (works with both local and deployed services)
```

## Common Workflows

### First-Time Setup

```bash
# 1. Set up development environment
npm run setup

# 2. Validate prerequisites
npm run test:deploy

# 3. Deploy to Snowflake
npm run deploy:production
```

### Regular Deployment

```bash
# Deploy new version
./scripts/deploy.sh v1.1.0

# Check service health
npm run health-check

# Or check via Snow CLI
snow spcs service status SNOWFLAKE_API_PROXY
```

### Cleanup and Redeploy

```bash
# Remove existing deployment
npm run cleanup:yes

# Deploy fresh
npm run deploy:production
```

### Testing Before Deployment

```bash
# Quick validation
npm run test:deploy

# Full E2E test (creates and cleans up test resources)
npm run test:deploy:e2e
```

## Environment Variables

Scripts use the following environment variables (can be set in `.env` file):

**Deployment**:
- `SNOWFLAKE_ACCOUNT`: Snowflake account identifier
- `SNOWFLAKE_USERNAME`: Snowflake username
- `SNOWFLAKE_PASSWORD`: Snowflake password
- `SNOWFLAKE_WAREHOUSE`: Warehouse name
- `SNOWFLAKE_DATABASE`: Database name
- `SNOWFLAKE_SCHEMA`: Schema name
- `SNOWFLAKE_COMPUTE_POOL`: Compute pool name
- `SNOWFLAKE_ROLE_MODE`: Role mode (AUTO, ACCOUNTADMIN, SYSADMIN, USERADMIN)
- `SNOWFLAKE_SERVICE_USER_PASSWORD`: Service user password

**Health Check**:
- `BACKEND_URL`: Backend URL
- `FRONTEND_URL`: Frontend URL
- `SERVICE_URL`: Service URL (overrides backend/frontend)
- `TIMEOUT`: Request timeout

## Best Practices

1. **Always run validation tests** before deploying to production
2. **Use test resources** with `_TEST` suffix for testing
3. **Clean up test resources** after testing (unless inspecting)
4. **Check prerequisites** before running expensive operations
5. **Review script output** for warnings and errors
6. **Use verbose mode** when debugging failures

## Troubleshooting

### Script Execution Errors

**Permission Denied**:
```bash
chmod +x scripts/*.sh
```

**Command Not Found**:
- Ensure required tools are installed (Snow CLI, Docker)
- Check PATH environment variable

**SQL Script Errors**:
- Verify Snowflake connection: `snow connection test`
- Check role permissions
- Review SQL script syntax

**Image Push Failures**:
- Verify Docker is running
- Check registry authentication: `snow spcs image-registry login`
- Review registry permissions

## See Also

- [Deployment Guide](./DEPLOYMENT.md#cleanup) - Includes cleanup instructions
- [Deployment Testing](./DEPLOYMENT_TESTING.md)
- [SQL Scripts Guide](./SQL_SCRIPTS.md)

