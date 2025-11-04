# Deployment Guide

Complete guide for deploying the Snowflake API Proxy Service to production using Snowflake Container Services.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Production Deployment](#production-deployment)
5. [Testing Deployment](#testing-deployment)
6. [Post-Deployment](#post-deployment)
7. [Configuration](#configuration)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Cleanup](#cleanup)

## Prerequisites

### System Requirements

- **Node.js** 18+ and npm
- **Docker** installed and running (for building images)
- **Git** for cloning repository
- **curl** (for health checks)

### Snowflake Requirements

- Snowflake account with **Container Services enabled**
- Appropriate permissions for creating compute pools and services
- Snowflake registry access for storing container images

### Required Tools

1. **Snow CLI** (Required for Container Services deployment)
   ```bash
   # macOS
   brew install snowflake-labs/snowflake/snow-cli
   
   # Verify installation
   snow --version
   ```

2. **Docker** (Required for building images)
   ```bash
   # Verify Docker is running
   docker --version
   docker ps
   ```

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd api_proxy_service
chmod +x scripts/*.sh
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 2. Configure Snow CLI

```bash
# Test default connection
snow connection test

# If connection fails, configure it:
snow connection add
# Follow prompts to enter:
# - Connection name
# - Account identifier
# - Username
# - Password
# - Role (ACCOUNTADMIN, SYSADMIN, or USERADMIN)
```

### Detailed Snow CLI Setup

#### Installation

**macOS:**
```bash
brew install snowflake-labs/snowflake/snow-cli
snow --version
```

**Linux:**
```bash
curl -O https://github.com/snowflakedb/snowflake-cli/releases/latest/download/snowflake_cli_linux_x86_64.tar.gz
tar -xzf snowflake_cli_linux_x86_64.tar.gz
sudo mv snow /usr/local/bin/
sudo chmod +x /usr/local/bin/snow
snow --version
```

**Windows:**
1. Download from: https://github.com/snowflakedb/snowflake-cli/releases
2. Extract ZIP and add `snow.exe` to PATH
3. Verify: `snow --version`

#### Configuration

**Option 1: Interactive Setup**
```bash
snow connection setup
# Follow prompts to configure connection
```

**Option 2: Configuration File** (`~/.snowflake/config.toml`):
```toml
[connections.default]
account = "your-account.snowflakecomputing.com"
user = "your-username"
password = "your-password"
warehouse = "API_PROXY_WH"
database = "API_PROXY"
schema = "APP"
role = "ACCOUNTADMIN"
```

**Option 3: Environment Variables:**
```bash
export SNOWFLAKE_ACCOUNT="your-account.snowflakecomputing.com"
export SNOWFLAKE_USERNAME="your-username"
export SNOWFLAKE_PASSWORD="your-password"
export SNOWFLAKE_WAREHOUSE="API_PROXY_WH"
export SNOWFLAKE_DATABASE="API_PROXY"
export SNOWFLAKE_SCHEMA="APP"
export SNOWFLAKE_ROLE="ACCOUNTADMIN"
```

**Verify Installation:**
```bash
snow connection test
snow connection show
```

### 3. Quick Deploy

```bash
# Deploy to Snowflake Container Services
npm run deploy:production

# Or with custom parameters:
./scripts/deploy.sh \
  --database MY_DB \
  --schema MY_SCHEMA \
  --warehouse MY_WH \
  --role-mode AUTO
```

The deployment script automatically:
1. ✅ Checks prerequisites (Snow CLI, Docker)
2. ✅ Validates environment variables
3. ✅ Authenticates with Snowflake
4. ✅ Creates database, warehouse, role, and user (via SQL scripts)
5. ✅ Builds Docker images
6. ✅ Pushes images to Snowflake Image Registry
7. ✅ Creates/updates the Container Service
8. ✅ Verifies deployment

## Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] **Snow CLI is installed** (`snow --version`)
- [ ] **Snow CLI connection works** (`snow connection test`)
- [ ] **Docker is installed and running** (`docker ps`)
- [ ] **Environment variables configured** (see [Configuration](#configuration))
- [ ] **JWT_SECRET is secure** (at least 32 characters, generated with `openssl rand -base64 64`)
- [ ] **Snowflake credentials are set** (username, password, account)
- [ ] **Frontend is built** (`frontend/build` directory exists - built automatically during deployment)
- [ ] **Backup procedures are in place**

### Generate Secure JWT Secret

```bash
# Generate a secure JWT secret (64 characters)
openssl rand -base64 64
```

Add to your `.env` file:
```bash
JWT_SECRET="your-generated-secret-here"
```

## Production Deployment

### Automated Deployment (Recommended)

The `deploy.sh` script handles the entire deployment process:

```bash
# Standard deployment
npm run deploy:production

# Or directly:
./scripts/deploy.sh

# With version tag:
./scripts/deploy.sh v1.0.0

# With custom resource names:
./scripts/deploy.sh \
  --database API_PROXY_PROD \
  --schema APP \
  --warehouse API_PROXY_WH_PROD \
  --compute-pool API_PROXY_POOL_PROD
```

### Deployment Options

The deploy script supports several options:

```bash
./scripts/deploy.sh [OPTIONS] [VERSION]

Options:
  -v, --version VERSION       Deployment version (default: latest)
  -c, --compute-pool NAME     Compute pool name (default: API_PROXY_POOL)
  -d, --database NAME         Database name (default: API_PROXY)
  -s, --schema NAME           Schema name (default: APP)
  -w, --warehouse NAME        Warehouse name (default: API_PROXY_WH)
  -r, --role-mode MODE        Role mode: ACCOUNTADMIN, SYSADMIN, USERADMIN, or AUTO (default: AUTO)
      --recreate-compute-pool Drop and recreate compute pool if it exists
  -h, --help                  Show help message
```

### Role Mode

The `--role-mode` option allows deployment with least privilege:

- **ACCOUNTADMIN**: Full permissions (default in SQL scripts)
- **SYSADMIN**: Can create objects (databases, warehouses, roles)
- **USERADMIN**: Can create users and roles (requires SYSADMIN for objects)
- **AUTO**: Automatically uses SYSADMIN for objects and USERADMIN for users/roles

Note: The deployment script uses your default Snow CLI role. Ensure your default role has sufficient permissions.

### Manual Deployment Steps

If you prefer manual control:

```bash
# 1. Authenticate with Snowflake
snow connection test

# 2. Build Docker images
docker build -t snowflake-api-proxy-backend:latest ./backend --platform linux/amd64
docker build -t snowflake-api-proxy-frontend:latest ./frontend --platform linux/amd64

# 3. Get registry URL
REGISTRY_URL=$(snow spcs image-registry url)

# 4. Login to registry (uses Snow CLI credentials automatically)
snow spcs image-registry login

# 5. Tag and push images
docker tag snowflake-api-proxy-backend:latest ${REGISTRY_URL}/api_proxy/app/repository/snowflake-api-proxy-backend:latest
docker tag snowflake-api-proxy-frontend:latest ${REGISTRY_URL}/api_proxy/app/repository/snowflake-api-proxy-frontend:latest
docker push ${REGISTRY_URL}/api_proxy/app/repository/snowflake-api-proxy-backend:latest
docker push ${REGISTRY_URL}/api_proxy/app/repository/snowflake-api-proxy-frontend:latest

# 6. Create/update service
snow spcs service create SNOWFLAKE_API_PROXY \
  --compute-pool API_PROXY_POOL \
  --spec service-spec.yaml \
  --wait
```

## Testing Deployment

Before deploying to production, test the deployment process:

### Quick Validation Test

```bash
# Validates prerequisites without creating resources
npm run test:deploy
```

### End-to-End Test

```bash
# Creates test resources, verifies, and cleans up
npm run test:deploy:e2e

# With options:
./scripts/test-deploy-e2e.sh \
  --skip-deployment \  # Skip service deployment
  --skip-cleanup \     # Leave resources for inspection
  --verbose            # Show detailed output
```

See the [Testing Deployment](#testing-deployment) section above for detailed testing information.

## Post-Deployment

### 1. Verify Deployment

```bash
# Check service status
snow spcs service status SNOWFLAKE_API_PROXY --database API_PROXY --schema APP

# Get service URL
SERVICE_URL=$(snow spcs service status SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --output json | jq -r '.external_url')

# Health check
curl ${SERVICE_URL}/health

# View logs
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP
```

### 2. Create Application Tables

After deployment, create the application tables:

```bash
# Run create_tables.sql
snow sql -f sql/create_tables.sql --database API_PROXY --schema APP
```

### 3. Test Endpoints

```bash
# Get service URL
SERVICE_URL=$(snow spcs service status SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --output json | jq -r '.external_url')

# Test root endpoint
curl ${SERVICE_URL}/

# Test health endpoint
curl ${SERVICE_URL}/health

# Test login
curl -X POST ${SERVICE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-username","password":"your-password"}'
```

### 4. Access the Application

- **Frontend**: `${SERVICE_URL}` (or check service status for exact URL)
- **Backend API**: `${SERVICE_URL}/api`
- **Health Check**: `${SERVICE_URL}/health`

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Snowflake Configuration
SNOWFLAKE_ACCOUNT=your-account.snowflakecomputing.com
SNOWFLAKE_USERNAME=API_PROXY_SERVICE_MANAGER
SNOWFLAKE_PASSWORD=<secure-password>
SNOWFLAKE_WAREHOUSE=API_PROXY_WH
SNOWFLAKE_DATABASE=API_PROXY
SNOWFLAKE_SCHEMA=APP
SNOWFLAKE_ROLE=API_PROXY_SERVICE_ROLE

# JWT Configuration (MUST be changed for production!)
JWT_SECRET=<generate-strong-secret-64-chars-minimum>
JWT_EXPIRES_IN=24h

# Application Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-service-url.snowflakecomputing.com

# Logging
LOG_LEVEL=info
```

### Snowflake Configuration

The deployment script creates the following resources automatically:

- **Database**: `API_PROXY` (customizable with `--database`)
- **Schema**: `APP` (customizable with `--schema`)
- **Warehouse**: `API_PROXY_WH` (customizable with `--warehouse`)
- **Compute Pool**: `API_PROXY_POOL` (customizable with `--compute-pool`)
- **Service Role**: `API_PROXY_SERVICE_ROLE`
- **Service User**: `API_PROXY_SERVICE_MANAGER`

For SQL script details, see [SQL_SCRIPTS.md](./SQL_SCRIPTS.md).

## Monitoring & Maintenance

### Health Monitoring

**Health Check Endpoints:**
- `/health` - Basic health status
- `/health/detailed` - Detailed health information
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe

**Monitoring Script:**
```bash
./scripts/health-check.sh
```

### Log Management

**View Service Logs:**
```bash
# All containers
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP

# Specific container
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --container backend
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --container frontend

# Follow logs (tail)
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --tail 100
```

### Regular Maintenance

**Daily:**
- Monitor logs for errors
- Check service health
- Review performance metrics

**Weekly:**
- Review security logs
- Check for dependency updates
- Review error rates

**Monthly:**
- Security audit
- Performance review
- Backup verification
- Dependency updates

### Updating the Service

```bash
# 1. Pull latest code
git pull

# 2. Rebuild and redeploy
./scripts/deploy.sh v1.1.0

# Or manually update service
snow spcs service upgrade SNOWFLAKE_API_PROXY \
  --compute-pool API_PROXY_POOL \
  --spec service-spec.yaml \
  --wait
```

### Rollback Procedure

```bash
# Suspend service
snow spcs service suspend SNOWFLAKE_API_PROXY --database API_PROXY --schema APP

# Redeploy previous version
./scripts/deploy.sh <previous-version>
```

## Troubleshooting

### Services Won't Start

```bash
# Check service status
snow spcs service status SNOWFLAKE_API_PROXY --database API_PROXY --schema APP

# View service logs
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --tail 100

# Check compute pool status
snow spcs compute-pool status API_PROXY_POOL

# Check container logs
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --container backend
```

### Connection Issues

```bash
# Test Snowflake connection
snow connection test

# Get service URL and test
SERVICE_URL=$(snow spcs service status SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --output json | jq -r '.external_url')
curl ${SERVICE_URL}/health

# Check service configuration
snow spcs service describe SNOWFLAKE_API_PROXY --database API_PROXY --schema APP
```

### Performance Issues

```bash
# View resource usage
snow spcs service status SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --output json

# Review logs
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP --tail 500

# Check compute pool metrics
snow spcs compute-pool status API_PROXY_POOL
```

### Common Errors

**Error: "SQL compilation error"**
- Check that database/schema/warehouse names don't contain special characters
- Use simple names (letters, numbers, underscores)

**Error: "Insufficient privileges"**
- Run with `--role-mode ACCOUNTADMIN`
- Or ensure your connection has necessary roles (SYSADMIN, USERADMIN)

**Error: "Service already exists"**
- The deploy script will upgrade existing services automatically
- To recreate, use `--recreate-compute-pool` (for compute pools only)

## Cleanup

The cleanup script (`scripts/cleanup.sh`) removes all resources created by the deployment script, including services, compute pools, databases, warehouses, users, and roles.

### Quick Start

**Interactive Mode (Recommended):**
```bash
# Asks for confirmation before deleting
npm run cleanup
# or
./scripts/cleanup.sh
```

**Non-Interactive Mode:**
```bash
# Auto-confirms (useful for automation/CI)
npm run cleanup:yes
# or
./scripts/cleanup.sh --yes
```

### What Gets Removed

The cleanup script removes the following resources **in order**:

1. **Service** (`SNOWFLAKE_API_PROXY`) - Drops the Snowflake Container Service
2. **Compute Pool** (`API_PROXY_POOL`) - Drops the compute pool used by the service
3. **Database** (`API_PROXY`) - Drops the database (cascades to all schemas, tables, views, etc.)
4. **Warehouse** (`API_PROXY_WH`) - Drops the warehouse
5. **User** (`API_PROXY_SERVICE_MANAGER`) - Drops the service user account
6. **Role** (`API_PROXY_SERVICE_ROLE`) - Drops the service role

### Command-Line Options

```bash
./scripts/cleanup.sh [OPTIONS]
```

**Options:**
- `-d, --database NAME` - Database name to drop (default: `API_PROXY`)
- `-s, --schema NAME` - Schema name (for reference) (default: `APP`)
- `-w, --warehouse NAME` - Warehouse name to drop (default: `API_PROXY_WH`)
- `-c, --compute-pool NAME` - Compute pool name to drop (default: `API_PROXY_POOL`)
- `-n, --service NAME` - Service name to drop (default: `SNOWFLAKE_API_PROXY`)
- `-y, --yes` - Auto-confirm (non-interactive)
- `-h, --help` - Show help message

**Note:** This script uses your default Snow CLI role. Ensure your default role has sufficient permissions to drop all resources.

### Examples

**Basic Cleanup:**
```bash
./scripts/cleanup.sh
```

**Custom Resource Names:**
```bash
./scripts/cleanup.sh --database MY_CUSTOM_DB --warehouse MY_CUSTOM_WH
```

**Force Cleanup (Non-Interactive):**
```bash
./scripts/cleanup.sh --yes
```

### Safety Features

**Confirmation Prompt:**
By default, the script asks for confirmation before proceeding:
```
⚠️  WARNING: This will permanently delete the following resources:
   Service: SNOWFLAKE_API_PROXY
   Compute Pool: API_PROXY_POOL
   Database: API_PROXY
   Schema: API_PROXY.APP
   Warehouse: API_PROXY_WH
   User: API_PROXY_SERVICE_MANAGER
   Role: API_PROXY_SERVICE_ROLE
   All tables and views in API_PROXY.APP

Are you sure you want to continue? (yes/no):
```

**Resource Existence Checks:**
The script checks if each resource exists before attempting to drop it:
- Only attempts to drop resources that exist
- Provides clear messages for non-existent resources
- Continues even if some resources fail to drop (may have dependencies)

### Manual Cleanup

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
DROP USER IF EXISTS API_PROXY_SERVICE_MANAGER;

-- 6. Drop role
DROP ROLE IF EXISTS API_PROXY_SERVICE_ROLE;
```

### Troubleshooting Cleanup

**Error: "Failed to authenticate with Snowflake"**
- Run `snow connection test` first, or configure Snow CLI connection

**Error: "Failed to drop service"**
- Check service status with `snow spcs service list`

**Error: "Failed to drop compute pool"**
- Ensure service is dropped first, then drop compute pool

**Error: "Failed to drop database"**
- Check for active connections or dependent objects

**Error: "Insufficient privileges"**
- Ensure your default Snow CLI role has permissions to drop all resources

## Deployment Scripts Reference

This section provides detailed information about the deployment scripts available in the `scripts/` directory.

### `deploy.sh` - Main Deployment Script

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
- Automatically grants service roles for PAT token access

**Key Options**:
- `--database`, `-d`: Database name (default: API_PROXY)
- `--schema`, `-s`: Schema name (default: APP)
- `--warehouse`, `-w`: Warehouse name (default: API_PROXY_WH)
- `--compute-pool`, `-c`: Compute pool name (default: API_PROXY_POOL)
- `--version`, `-v`: Image version tag (default: latest)
- `--service-only`: Only deploy/update service (skip build/push)
- `--build-and-deploy`: Build, push, and deploy (skip resource creation)
- `--create-service-pat`: Create PAT token for service user
- `--sample-data-only`: Only create sample data (tags, endpoint, initial user)
- `--verbose`, `-v`: Enable verbose output for debugging

**Deployment Modes**:

1. **Full Deployment** (default):
   ```bash
   ./scripts/deploy.sh
   ```
   - Creates all resources
   - Builds images
   - Pushes images
   - Deploys service

2. **Service Only** (skip build/push):
   ```bash
   ./scripts/deploy.sh --service-only
   ```
   - Skips resource creation
   - Skips image build/push
   - Only deploys/updates service
   - Assumes images already exist

3. **Build and Deploy** (skip resource creation):
   ```bash
   ./scripts/deploy.sh --build-and-deploy
   ```
   - Skips resource creation
   - Builds images
   - Pushes images
   - Deploys service
   - Useful for updating code/images

### `cleanup.sh` - Resource Cleanup Script

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
- `--database-only`: Only remove database (keep service, compute pool, etc.)
- `--skip-service`: Don't remove service
- `--skip-compute-pool`: Don't remove compute pool
- `--skip-warehouse`: Don't remove warehouse
- `--skip-user`: Don't remove user
- `--skip-role`: Don't remove role
- `--yes`, `-y`: Skip confirmation prompt

### `health-check.sh` - Service Health Monitoring

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

### `setup.sh` - Development Environment Setup

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

### Script Relationships

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

### Common Workflows

**First-Time Setup**:
```bash
# 1. Set up development environment
npm run setup

# 2. Validate prerequisites
npm run test:deploy

# 3. Deploy to Snowflake
npm run deploy:production
```

**Regular Deployment**:
```bash
# Deploy new version
./scripts/deploy.sh v1.1.0

# Check service health
npm run health-check

# Or check via Snow CLI
snow spcs service list --database API_PROXY --schema APP
```

**Cleanup and Redeploy**:
```bash
# Remove existing deployment
npm run cleanup:yes

# Deploy fresh
npm run deploy:production
```

**Testing Before Deployment**:
```bash
# Quick validation
npm run test:deploy

# Full E2E test (creates and cleans up test resources)
npm run test:deploy:e2e
```

## Useful Snow CLI Commands

```bash
# Service Management
snow spcs service list --database API_PROXY --schema APP
snow spcs service logs SNOWFLAKE_API_PROXY --container-name backend --instance-id 0 --database API_PROXY --schema APP
snow spcs service suspend SNOWFLAKE_API_PROXY --database API_PROXY --schema APP
snow spcs service resume SNOWFLAKE_API_PROXY --database API_PROXY --schema APP
snow spcs service drop SNOWFLAKE_API_PROXY --database API_PROXY --schema APP

# Image Management
snow spcs image-repository list
snow spcs image-registry url
snow spcs image-registry login

# Compute Pool Management
snow spcs compute-pool list
snow spcs compute-pool status API_PROXY_POOL
snow spcs compute-pool drop API_PROXY_POOL

# Connection Testing
snow connection test
snow connection list
```

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Security Guide](./SECURITY.md)
- [SQL Scripts Guide](./SQL_SCRIPTS.md)
- [Snowflake Setup](./SNOWFLAKE_SETUP.md) - Complete Snowflake account setup including PAT tokens
