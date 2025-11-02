# Snow CLI Setup Guide

This guide explains how to install and configure Snow CLI for deploying to Snowflake Container Services.

## Installation

### macOS

```bash
# Using Homebrew
brew install snowflake-labs/snowflake/snow-cli

# Verify installation
snow --version
```

### Linux

```bash
# Download latest release
curl -O https://github.com/snowflakedb/snowflake-cli/releases/latest/download/snowflake_cli_linux_x86_64.tar.gz

# Extract and install
tar -xzf snowflake_cli_linux_x86_64.tar.gz
sudo mv snow /usr/local/bin/
sudo chmod +x /usr/local/bin/snow

# Verify installation
snow --version
```

### Windows

1. Download the latest release from: https://github.com/snowflakedb/snowflake-cli/releases
2. Extract the ZIP file
3. Add the `snow.exe` to your PATH
4. Verify: `snow --version`

## Configuration

### Option 1: Configuration File

Create a configuration file at `~/.snowflake/config.toml`:

```toml
[connections.default]
account = "your-account.snowflakecomputing.com"
user = "your-username"
password = "your-password"
warehouse = "API_PROXY_WH"
database = "API_PROXY"
schema = "PUBLIC"
role = "ACCOUNTADMIN"

[spcs]
compute_pool = "API_PROXY_POOL"
image_registry = "API_PROXY.PUBLIC"
```

### Option 2: Environment Variables

Set environment variables in your `.env` file:

```bash
SNOWFLAKE_ACCOUNT=your-account.snowflakecomputing.com
SNOWFLAKE_USERNAME=your-username
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_WAREHOUSE=API_PROXY_WH
SNOWFLAKE_DATABASE=API_PROXY
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_ROLE=ACCOUNTADMIN
SNOWFLAKE_COMPUTE_POOL=API_PROXY_POOL
```

### Option 3: Interactive Setup

```bash
# Run interactive setup
snow connection setup

# Follow the prompts to configure your connection
```

## Verify Installation

```bash
# Test connection
snow connection test

# List connections
snow connection list

# Get connection details
snow connection show
```

## Prerequisites in Snowflake

Before deploying, ensure you have:

1. **Compute Pool** created:
```sql
CREATE COMPUTE POOL API_PROXY_POOL
  MIN_NODES = 1
  MAX_NODES = 3
  INSTANCE_FAMILY = CPU_X64_XS;
```

2. **Image Registry** configured:
```sql
-- Image registry is automatically created when you first push an image
-- Or create manually:
CREATE IMAGE REPOSITORY API_PROXY_REPO
  IN SCHEMA API_PROXY.PUBLIC;
```

3. **Required Permissions**:
   - `CREATE SERVICE` on compute pool
   - `CREATE IMAGE REPOSITORY` on schema
   - `USAGE` on compute pool
   - `USAGE` on warehouse

## Common Commands

### Connection Management

```bash
# Test connection
snow connection test

# List connections
snow connection list

# Show current connection
snow connection show

# Switch connection
snow connection set <connection-name>
```

### Container Services

```bash
# List services
snow spcs service list

# Create service
snow spcs service create <service-name> \
  --compute-pool <compute-pool> \
  --spec <spec-file.yaml>

# Get service status
snow spcs service status <service-name>

# View service logs
snow spcs service logs <service-name>

# Suspend service
snow spcs service suspend <service-name>

# Resume service
snow spcs service resume <service-name>

# Drop service
snow spcs service drop <service-name>
```

### Image Registry

```bash
# Get registry URL
snow spcs image-registry url

# List images
snow spcs image list

# Describe image
snow spcs image describe <image-name>

# Login to registry (for Docker)
REGISTRY_URL=$(snow spcs image-registry url)
echo $SNOWFLAKE_PASSWORD | docker login $REGISTRY_URL -u $SNOWFLAKE_USERNAME --password-stdin
```

### Compute Pools

```bash
# List compute pools
snow spcs compute-pool list

# Get compute pool status
snow spcs compute-pool status <pool-name>

# Create compute pool (via SQL)
# Use SQL commands in Snowflake UI or SnowSQL
```

## Deployment Workflow

1. **Authenticate**:
   ```bash
   snow connection test
   ```

2. **Build Images**:
   ```bash
   docker build -t backend:latest ./backend
   docker build -t frontend:latest ./frontend
   ```

3. **Get Registry URL**:
   ```bash
   REGISTRY_URL=$(snow spcs image-registry url)
   ```

4. **Push Images**:
   ```bash
   # Login
   echo $SNOWFLAKE_PASSWORD | docker login $REGISTRY_URL -u $SNOWFLAKE_USERNAME --password-stdin
   
   # Tag and push
   docker tag backend:latest $REGISTRY_URL/backend:v1.0.0
   docker push $REGISTRY_URL/backend:v1.0.0
   ```

5. **Deploy Service**:
   ```bash
   snow spcs service create snowflake-api-proxy \
     --compute-pool API_PROXY_POOL \
     --spec service-spec.yaml
   ```

## Troubleshooting

### Connection Issues

```bash
# Test connection
snow connection test

# Check configuration
snow connection show

# View connection details
cat ~/.snowflake/config.toml
```

### Permission Issues

Ensure your user has the required permissions:
- `CREATE SERVICE` on compute pool
- `USAGE` on compute pool
- `CREATE IMAGE REPOSITORY` or `USAGE` on schema
- `USAGE` on warehouse

### Registry Access Issues

```bash
# Verify registry URL
snow spcs image-registry url

# Test Docker login
REGISTRY_URL=$(snow spcs image-registry url)
docker login $REGISTRY_URL -u $SNOWFLAKE_USERNAME -p $SNOWFLAKE_PASSWORD
```

## Resources

- [Snow CLI Documentation](https://docs.snowflake.com/en/developer-guide/snowflake-cli)
- [Container Services Documentation](https://docs.snowflake.com/en/user-guide/snowpark-container-services)
- [GitHub Repository](https://github.com/snowflakedb/snowflake-cli)
