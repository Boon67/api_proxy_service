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

For detailed Snow CLI setup, see [SNOW_CLI_SETUP.md](./SNOW_CLI_SETUP.md).

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

See [ROLE_MODE_GUIDE.md](./ROLE_MODE_GUIDE.md) for detailed information.

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

See [DEPLOYMENT_TESTING.md](./DEPLOYMENT_TESTING.md) for detailed testing information.

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
  -d '{"username":"admin","password":"admin123"}'
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
SNOWFLAKE_USERNAME=API_PROXY_SERVICE_USER
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
- **Service User**: `API_PROXY_SERVICE_USER`

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

To remove all deployed resources:

```bash
# Interactive (asks for confirmation)
npm run cleanup

# Non-interactive (auto-confirms)
npm run cleanup:yes

# With custom names
./scripts/cleanup.sh \
  --database API_PROXY \
  --warehouse API_PROXY_WH \
  --yes
```

The cleanup script removes:
- Container Service
- Compute Pool
- Database (cascades to schema and all objects)
- Warehouse
- Service User
- Service Role

See [CLEANUP_GUIDE.md](./CLEANUP_GUIDE.md) for detailed cleanup instructions.

## Useful Snow CLI Commands

```bash
# Service Management
snow spcs service list
snow spcs service status SNOWFLAKE_API_PROXY --database API_PROXY --schema APP
snow spcs service logs SNOWFLAKE_API_PROXY --database API_PROXY --schema APP
snow spcs service suspend SNOWFLAKE_API_PROXY --database API_PROXY --schema APP
snow spcs service resume SNOWFLAKE_API_PROXY --database API_PROXY --schema APP
snow spcs service drop SNOWFLAKE_API_PROXY --database API_PROXY --schema APP

# Image Management
snow spcs image list
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
- [Role Mode Guide](./ROLE_MODE_GUIDE.md)
- [Snow CLI Setup](./SNOW_CLI_SETUP.md)
- [Snowflake Setup](./SNOWFLAKE_SETUP.md)
- [Deployment Testing](./DEPLOYMENT_TESTING.md)
