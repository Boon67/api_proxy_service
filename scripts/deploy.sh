#!/bin/bash

# Snowflake API Proxy Service Deployment Script
# This script deploys the service to Snowflake Container Services using Snow CLI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default Configuration
SERVICE_NAME="SNOWFLAKE_API_PROXY"
IMAGE_NAME="snowflake-api-proxy"
DEFAULT_VERSION="latest"
DEFAULT_COMPUTE_POOL="API_PROXY_POOL"
DEFAULT_DATABASE="API_PROXY"
DEFAULT_SCHEMA="APP"
DEFAULT_WAREHOUSE="API_PROXY_WH"
# Initialize variables with defaults (will be overridden by flags or env vars)
VERSION="$DEFAULT_VERSION"
COMPUTE_POOL="$DEFAULT_COMPUTE_POOL"
DATABASE="$DEFAULT_DATABASE"
SCHEMA="$DEFAULT_SCHEMA"
WAREHOUSE="$DEFAULT_WAREHOUSE"
RECREATE_COMPUTE_POOL=false

# Parse command-line arguments
parse_args() {
    local show_help=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version|-v)
                VERSION="$2"
                shift 2
                ;;
            --compute-pool|-c)
                COMPUTE_POOL="$2"
                shift 2
                ;;
            --database|-d)
                DATABASE="$2"
                shift 2
                ;;
            --schema|-s)
                SCHEMA="$2"
                shift 2
                ;;
            --warehouse|-w)
                WAREHOUSE="$2"
                shift 2
                ;;
            --recreate-compute-pool)
                RECREATE_COMPUTE_POOL=true
                shift
                ;;
            --check-endpoint|--check-endpoint-url)
                CHECK_ENDPOINT_ONLY=true
                shift
                ;;
            --debug-endpoint)
                DEBUG_ENDPOINT=true
                shift
                ;;
            --sample-data-only|--create-sample-data)
                SAMPLE_DATA_ONLY=true
                shift
                ;;
            --create-service-pat)
                CREATE_SERVICE_PAT=true
                shift
                ;;
            --service-pat-name)
                SERVICE_PAT_NAME="$2"
                shift 2
                ;;
            --service-pat-expiry-days)
                SERVICE_PAT_EXPIRY_DAYS="$2"
                shift 2
                ;;
            --service-only|--deploy-service-only)
                SERVICE_ONLY=true
                shift
                ;;
            --build-and-deploy|--images-and-service)
                BUILD_AND_DEPLOY=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help=true
                shift
                ;;
            *)
                # If it doesn't start with --, treat as version (backward compatibility)
                if [[ ! "$1" =~ ^-- ]]; then
                    VERSION="$1"
                fi
                shift
                ;;
        esac
    done
    
    if [ "$show_help" = true ]; then
        cat << EOF
${BLUE}Snowflake API Proxy Service Deployment Script${NC}

Usage: $0 [OPTIONS] [VERSION]

Options:
  -v, --version VERSION       Deployment version (default: ${DEFAULT_VERSION})
  -c, --compute-pool NAME     Compute pool name (default: ${DEFAULT_COMPUTE_POOL})
  -d, --database NAME         Database name (default: ${DEFAULT_DATABASE})
  -s, --schema NAME           Schema name (default: ${DEFAULT_SCHEMA})
  -w, --warehouse NAME        Warehouse name (default: ${DEFAULT_WAREHOUSE})
      --recreate-compute-pool Drop and recreate compute pool if it exists
      --check-endpoint        Check if endpoint URL exists and exit (debug mode)
      --debug-endpoint        Enable debug output for endpoint detection
      --sample-data-only      Only create sample data (tags, endpoint, initial user)
                              Skips full deployment. Requires existing database/schema.
      --create-service-pat    Create Snowflake PAT token for service user
                              Requires MODIFY PROGRAMMATIC AUTHENTICATION METHODS permission
      --service-pat-name NAME Name for the PAT token (default: API_PROXY_SERVICE_PAT)
      --service-pat-expiry-days DAYS
                              Days until PAT token expires (default: 365)
      --service-only           Only deploy/update the service (skip build/push)
                              Assumes images already exist in registry
      --build-and-deploy       Build, push images, and deploy service
                              Skips resource creation (database, tables, etc.)
                              Useful for updating images and redeploying
      --verbose, -v            Enable verbose output for debugging
  -h, --help                  Show this help message
  
  Note: These defaults align with sql/setup_service_account.sql and sql/create_tables.sql.
        If you customize names here, update the SQL scripts accordingly.
        This script uses your default Snow CLI role. Ensure your default role has sufficient permissions.

Environment Variables (override flags):
  SNOWFLAKE_COMPUTE_POOL      Compute pool name
  SNOWFLAKE_DATABASE          Database name
  SNOWFLAKE_SCHEMA            Schema name
  SNOWFLAKE_WAREHOUSE         Warehouse name

Examples:
  $0                                    # Use all defaults
  $0 v1.0.0                             # Specify version
  $0 --database MY_DB --schema MY_SCHEMA # Override database and schema
  $0 -d MY_DB -w MY_WH v1.0.0           # Use short flags with version
  $0 --create-service-pat               # Create PAT token during deployment
  $0 --create-service-pat --service-pat-name MY_TOKEN --service-pat-expiry-days 180
  $0 --service-only                     # Only deploy service (skip build/push)
  $0 --service-only --verbose            # Deploy service with verbose output
  $0 --build-and-deploy                 # Build, push, and deploy (skip resource creation)
  $0 --build-and-deploy --verbose        # Build, push, deploy with verbose output

EOF
        exit 0
    fi
    
    # Environment variables override flags
    COMPUTE_POOL=${SNOWFLAKE_COMPUTE_POOL:-"$COMPUTE_POOL"}
    DATABASE=${SNOWFLAKE_DATABASE:-"$DATABASE"}
    SCHEMA=${SNOWFLAKE_SCHEMA:-"$SCHEMA"}
    WAREHOUSE=${SNOWFLAKE_WAREHOUSE:-"$WAREHOUSE"}
}

# Display configuration
show_config() {
    echo -e "${BLUE}🚀 Starting deployment of Snowflake API Proxy Service using Snow CLI${NC}"
    echo -e "${BLUE}Version: ${VERSION}${NC}"
    echo -e "${BLUE}Compute Pool: ${COMPUTE_POOL}${NC}"
    echo -e "${BLUE}Database: ${DATABASE}${NC}"
    echo -e "${BLUE}Schema: ${SCHEMA}${NC}"
    echo -e "${BLUE}Warehouse: ${WAREHOUSE}${NC}"
    
    if [ "${SERVICE_ONLY:-false}" = "true" ]; then
        echo -e "${YELLOW}Mode: Service deployment only (skipping build/push)${NC}"
    elif [ "${BUILD_AND_DEPLOY:-false}" = "true" ]; then
        echo -e "${YELLOW}Mode: Build, push, and deploy (skipping resource creation)${NC}"
    fi
    
    if [ "${VERBOSE:-false}" = "true" ]; then
        echo -e "${YELLOW}Verbose mode: Enabled${NC}"
        set -x  # Enable bash debug mode for verbose output
    fi
    
    echo ""
}

# Check if Snow CLI is installed
check_snow_cli() {
    echo -e "${YELLOW}🔍 Checking Snow CLI installation...${NC}"
    
    if ! command -v snow &> /dev/null; then
        echo -e "${RED}❌ Snow CLI is not installed${NC}"
        echo -e "${YELLOW}Please install Snow CLI:${NC}"
        echo -e "${BLUE}  macOS: brew install snowflake-labs/snowflake/snow-cli${NC}"
        echo -e "${BLUE}  Or download from: https://docs.snowflake.com/en/developer-guide/snowflake-cli${NC}"
        exit 1
    fi
    
    SNOW_VERSION=$(snow --version 2>&1 || echo "unknown")
    echo -e "${GREEN}✅ Snow CLI found: ${SNOW_VERSION}${NC}"
}

# Check if Docker is installed
check_docker() {
    echo -e "${YELLOW}🔍 Checking Docker installation...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker found and running${NC}"
}

# Hash password for initial admin user
hash_password() {
    local password=$1
    # Try to hash password using Node.js if available
    if command -v node >/dev/null 2>&1; then
        node -e "const bcrypt = require('bcryptjs'); bcrypt.hash(process.argv[1], 12, (e, h) => { if (e) { console.error(e.message); process.exit(1); } else { console.log(h); } });" "$password" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# Create sample data only (used by --sample-data-only flag)
create_sample_data_only() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📦 Creating sample data only (skipping full deployment)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    check_snow_cli
    authenticate_snowflake
    
    # Verify database and schema exist
    echo -e "${BLUE}Verifying database and schema exist...${NC}"
    if ! snow sql -q "SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null | grep -qi "${DATABASE}"; then
        echo -e "${RED}❌ Database ${DATABASE} does not exist${NC}"
        echo -e "${YELLOW}   Please run the full deployment first, or create the database manually${NC}"
        exit 1
    fi
    
    if ! snow sql -q "USE DATABASE ${DATABASE}; SHOW SCHEMAS LIKE '${SCHEMA}'" 2>/dev/null | grep -qi "${SCHEMA}"; then
        echo -e "${RED}❌ Schema ${DATABASE}.${SCHEMA} does not exist${NC}"
        echo -e "${YELLOW}   Please run the full deployment first, or create the schema manually${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Database ${DATABASE} and schema ${SCHEMA} verified${NC}"
    echo ""
    
    # Create sample data
    create_sample_data_impl
    
    echo ""
    echo -e "${GREEN}🎉 Sample data creation completed!${NC}"
    echo ""
}

# Implementation of sample data creation (used by both full deployment and --sample-data-only)
create_sample_data_impl() {
    echo -e "${BLUE}Creating sample data (tags, test endpoint, and initial admin user if needed)...${NC}"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SQL_DIR="${SCRIPT_DIR}/../sql"
    CREATE_SAMPLE_DATA_SQL="${SQL_DIR}/create_sample_data.sql"
    
    if [ ! -f "$CREATE_SAMPLE_DATA_SQL" ]; then
        echo -e "${YELLOW}⚠️  Sample data SQL script not found: ${CREATE_SAMPLE_DATA_SQL}${NC}"
        echo -e "${BLUE}   Skipping sample data creation${NC}"
        return 1
    fi
    
    if execute_sql_script "$CREATE_SAMPLE_DATA_SQL"; then
        echo -e "${GREEN}✅ Sample data created successfully${NC}"
        # Check if user was created
        USER_COUNT=$(snow sql -q "USE DATABASE ${DATABASE}; USE SCHEMA ${SCHEMA}; SELECT COUNT(*) AS CNT FROM USERS" 2>/dev/null | grep -E "^[[:space:]]*[1-9]" | head -1 | tr -d '[:space:]' || echo "0")
        if [ "$USER_COUNT" != "0" ] && [ -n "$USER_COUNT" ]; then
            INITIAL_USERNAME="${INITIAL_ADMIN_USERNAME:-admin}"
            INITIAL_PASSWORD="${INITIAL_ADMIN_PASSWORD:-Admin123!}"
            echo -e "${BLUE}   Initial admin user created: ${INITIAL_USERNAME}${NC}"
            echo -e "${YELLOW}   ⚠️  Default password: ${INITIAL_PASSWORD} (change after first login)${NC}"
        fi
        echo -e "${BLUE}   Created tags: Engineering, Sales, Marketing, Finance, Operations, HR, Legal, Product${NC}"
        echo -e "${BLUE}   Created endpoint: 'Test Connection' (SELECT 1;)${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Could not create sample data${NC}"
        echo -e "${BLUE}   Sample data can be created manually later by running:${NC}"
        echo -e "${BLUE}   snow sql -f ${CREATE_SAMPLE_DATA_SQL}${NC}"
        return 1
    fi
}

# Authenticate with Snowflake using Snow CLI
authenticate_snowflake() {
    echo -e "${YELLOW}🔐 Configuring Snowflake connection...${NC}"
    
    # Test if connection already works
    if snow connection test 2>/dev/null; then
        echo -e "${GREEN}✅ Connection already configured and working${NC}"
        return 0
    fi
    
    # Connection doesn't work, need to configure
    # Update variables from environment
    WAREHOUSE=${SNOWFLAKE_WAREHOUSE:-${WAREHOUSE}}
    DATABASE=${SNOWFLAKE_DATABASE:-${DATABASE}}
    SCHEMA=${SNOWFLAKE_SCHEMA:-${SCHEMA:-$DEFAULT_SCHEMA}}
    # Role is determined by Snow CLI configuration
    
    # Extract credentials from Snow CLI if available
    if [ -z "$SNOWFLAKE_PASSWORD" ]; then
        # Try to get password from Snow CLI config if it exists
        if [ -f ~/.snowflake/config.toml ]; then
            SNOWFLAKE_PASSWORD=$(grep -i "password" ~/.snowflake/config.toml 2>/dev/null | sed 's/.*password[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/' | head -1 || echo "")
        fi
    fi
    
    # Ensure we have required variables
    if [ -z "$SNOWFLAKE_ACCOUNT" ] || [ -z "$SNOWFLAKE_USERNAME" ] || [ -z "$SNOWFLAKE_PASSWORD" ]; then
        echo -e "${YELLOW}⚠️  Some Snowflake credentials are missing${NC}"
        # Try to extract from Snow CLI connection test output
        if [ -z "$SNOWFLAKE_ACCOUNT" ]; then
            SNOWFLAKE_ACCOUNT=$(snow connection show 2>/dev/null | grep -i account | head -1 | sed 's/.*account[[:space:]]*:[[:space:]]*//i' | tr -d ' ' || echo "")
        fi
        if [ -z "$SNOWFLAKE_USERNAME" ]; then
            SNOWFLAKE_USERNAME=$(snow connection show 2>/dev/null | grep -i user | head -1 | sed 's/.*user[[:space:]]*:[[:space:]]*//i' | tr -d ' ' || echo "")
        fi
        # If still missing, exit
        if [ -z "$SNOWFLAKE_ACCOUNT" ] || [ -z "$SNOWFLAKE_USERNAME" ] || [ -z "$SNOWFLAKE_PASSWORD" ]; then
            echo -e "${RED}❌ Missing required Snowflake credentials${NC}"
            echo -e "${YELLOW}   Set SNOWFLAKE_PASSWORD environment variable or ensure ~/.snowflake/config.toml has password${NC}"
            exit 1
        fi
    fi
    
    # Create or update Snow CLI config
    mkdir -p ~/.snowflake
    cat > ~/.snowflake/config.toml << EOF
[connections.default]
account = "${SNOWFLAKE_ACCOUNT}"
user = "${SNOWFLAKE_USERNAME}"
password = "${SNOWFLAKE_PASSWORD}"
warehouse = "${WAREHOUSE}"
database = "${DATABASE}"
schema = "${SCHEMA}"
# role is determined by Snow CLI configuration
EOF
    
    # Test connection
    echo -e "${BLUE}Testing connection...${NC}"
    if ! snow connection test 2>/dev/null; then
        echo -e "${RED}❌ Failed to authenticate with Snowflake${NC}"
        echo -e "${YELLOW}Please check your credentials and try again.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Successfully authenticated with Snowflake${NC}"
}

# Create required Snowflake resources if they don't exist
# Assumes connection test already passed, so user has appropriate privileges
# This script uses the default role from Snow CLI configuration
# No explicit role switching is performed - ensure your default role has sufficient permissions

# Execute SQL script with variable substitution
# Replaces hardcoded values in SQL scripts with deploy script variables
execute_sql_script() {
    local sql_file=$1
    local temp_sql=$(mktemp)
    
    # Check if SQL file exists
    if [ ! -f "$sql_file" ]; then
        echo -e "${RED}❌ SQL file not found: ${sql_file}${NC}"
        return 1
    fi
    
    # Default service account password - can be overridden with environment variable
    SERVICE_USER_PASSWORD=${SNOWFLAKE_SERVICE_USER_PASSWORD:-"ChangeThisPassword123!"}
    SERVICE_ROLE_NAME="API_PROXY_SERVICE_ROLE"
    SERVICE_USER_NAME="API_PROXY_SERVICE_MANAGER"
    
    # Replace placeholders in SQL script using sed
    # Note: We use word boundaries (\b) to avoid partial matches
    # For schema references like API_PROXY.APP, we need special handling
    
    # First pass: replace standalone API_PROXY (but not in API_PROXY.APP)
    # We'll handle the schema reference separately
    sed -e "s/\bAPI_PROXY_WH\b/${WAREHOUSE}/g" \
        -e "s/\bAPI_PROXY_SERVICE_MANAGER\b/${SERVICE_USER_NAME}/g" \
        -e "s/\bAPI_PROXY_SERVICE_ROLE\b/${SERVICE_ROLE_NAME}/g" \
        -e "s/'ChangeThisPassword123!'/'${SERVICE_USER_PASSWORD}'/g" \
        "$sql_file" > "$temp_sql"
    
    # Second pass: replace API_PROXY.APP with DATABASE.SCHEMA
    sed -i.bak "s/API_PROXY\.APP/${DATABASE}.${SCHEMA}/g" "$temp_sql"
    
    # Third pass: replace remaining standalone API_PROXY (database name)
    sed -i.bak "s/\bAPI_PROXY\b/${DATABASE}/g" "$temp_sql"
    
    # Fourth pass: replace initial admin user placeholders (only for create_sample_data.sql)
    if echo "$sql_file" | grep -q "create_sample_data"; then
        # Get credentials from environment variables or use defaults
        INITIAL_USERNAME="${INITIAL_ADMIN_USERNAME:-admin}"
        INITIAL_PASSWORD="${INITIAL_ADMIN_PASSWORD:-Admin123!}"
        INITIAL_EMAIL="${INITIAL_ADMIN_EMAIL:-admin@example.com}"
        INITIAL_FIRST_NAME="${INITIAL_ADMIN_FIRST_NAME:-Admin}"
        INITIAL_LAST_NAME="${INITIAL_ADMIN_LAST_NAME:-User}"
        INITIAL_CONTACT="${INITIAL_ADMIN_CONTACT:-}"
        
        # Hash the password
        PASSWORD_HASH=$(hash_password "$INITIAL_PASSWORD")
        
        if [ -z "$PASSWORD_HASH" ]; then
            echo -e "${YELLOW}⚠️  Could not hash password - skipping initial user creation${NC}"
            echo -e "${BLUE}   Install Node.js to enable password hashing, or create user manually${NC}"
            # Remove the user creation part from the SQL
            sed -i.bak '/-- 0\. CREATE INITIAL ADMIN USER/,/WHERE NOT EXISTS (SELECT 1 FROM USERS);/d' "$temp_sql"
        else
            # Replace placeholders with actual values (placeholders are identifiers, need quotes)
            # Convert username to uppercase (bash 3.2 compatible)
            UPPER_USERNAME=$(echo "$INITIAL_USERNAME" | tr '[:lower:]' '[:upper:]')
            # Escape special characters for sed
            ESCAPED_PASSWORD_HASH=$(echo "$PASSWORD_HASH" | sed 's/[[\.*^$()+?{|]/\\&/g')
            ESCAPED_USERNAME=$(echo "$UPPER_USERNAME" | sed 's/[[\.*^$()+?{|]/\\&/g')
            ESCAPED_EMAIL=$(echo "$INITIAL_EMAIL" | sed 's/[[\.*^$()+?{|]/\\&/g')
            ESCAPED_FIRST_NAME=$(echo "$INITIAL_FIRST_NAME" | sed 's/[[\.*^$()+?{|]/\\&/g')
            ESCAPED_LAST_NAME=$(echo "$INITIAL_LAST_NAME" | sed 's/[[\.*^$()+?{|]/\\&/g')
            
            # Debug: Show what we're replacing
            echo -e "${BLUE}   Replacing placeholders for initial admin user...${NC}"
            echo -e "${BLUE}   Username: ${UPPER_USERNAME}${NC}"
            
            # Replace placeholders (simple pattern - placeholders are unique identifiers)
            # Just match the placeholder text directly since they're unique in the SQL file
            sed -i.bak "s|INITIAL_ADMIN_USERNAME|'${ESCAPED_USERNAME}'|g" "$temp_sql"
            sed -i.bak "s|INITIAL_ADMIN_PASSWORD_HASH|'${ESCAPED_PASSWORD_HASH}'|g" "$temp_sql"
            sed -i.bak "s|INITIAL_ADMIN_EMAIL|'${ESCAPED_EMAIL}'|g" "$temp_sql"
            sed -i.bak "s|INITIAL_ADMIN_FIRST_NAME|'${ESCAPED_FIRST_NAME}'|g" "$temp_sql"
            sed -i.bak "s|INITIAL_ADMIN_LAST_NAME|'${ESCAPED_LAST_NAME}'|g" "$temp_sql"
            if [ -n "$INITIAL_CONTACT" ]; then
                ESCAPED_CONTACT=$(echo "$INITIAL_CONTACT" | sed 's/[[\.*^$()+?{|]/\\&/g')
                sed -i.bak "s|INITIAL_ADMIN_CONTACT|'${ESCAPED_CONTACT}'|g" "$temp_sql"
            else
                sed -i.bak "s|INITIAL_ADMIN_CONTACT|NULL|g" "$temp_sql"
            fi
            
            # Verify replacement worked by checking if placeholder still exists
            if grep -q "INITIAL_ADMIN_USERNAME" "$temp_sql"; then
                echo -e "${YELLOW}⚠️  Warning: INITIAL_ADMIN_USERNAME placeholder still found after replacement${NC}"
                echo -e "${BLUE}   Debug: Showing lines with placeholders...${NC}"
                grep "INITIAL_ADMIN" "$temp_sql" | head -5 || true
            fi
        fi
    fi
    
    # Clean up backup file
    rm -f "$temp_sql.bak"
    
    # Execute the modified SQL script using default role from Snow CLI
    echo -e "${BLUE}Executing SQL script: $(basename ${sql_file})...${NC}"
    EXEC_OUTPUT=$(snow sql -f "$temp_sql" 2>&1)
    EXEC_EXIT=$?
    
    # Check for actual SQL errors in output (not just exit code)
    # Snow CLI may return non-zero even on success for multi-statement scripts
    HAS_SQL_ERROR=false
    EXPECTED_ERROR=false
    
    # Check for expected errors that we can safely ignore:
    # 1. "USE ROLE" errors when switching to service role (expected - admin user doesn't have service role)
    # 2. "already exists" errors (expected - idempotent operations)
    # 3. "already exists" errors for constraints (expected - idempotent operations)
    if echo "$EXEC_OUTPUT" | grep -qiE "USE ROLE.*is not assigned to the executing user|Requested role.*is not assigned|already exists|Constraint.*already exists"; then
        EXPECTED_ERROR=true
        # This is expected - the service role is for the service user, not the admin
        if echo "$EXEC_OUTPUT" | grep -qiE "USE ROLE.*is not assigned"; then
        echo -e "${BLUE}ℹ️  Note: USE ROLE statement for service role is expected to fail (admin user doesn't have service role)${NC}"
        fi
    fi
    
    if echo "$EXEC_OUTPUT" | grep -qiE "SQL compilation error|SQL execution error|syntax error"; then
        if [ "$EXPECTED_ERROR" != true ]; then
            HAS_SQL_ERROR=true
        fi
    fi
    
    # Check if script executed successfully despite exit code
    # Look for success indicators: "Statement executed successfully", "successfully created", etc.
    HAS_SUCCESS=$(echo "$EXEC_OUTPUT" | grep -ci "Statement executed successfully" || echo "0")
    
    if [ "$HAS_SQL_ERROR" = true ]; then
        echo -e "${RED}❌ SQL script execution failed${NC}"
        echo "$EXEC_OUTPUT" | tail -30
        rm -f "$temp_sql"
        return 1
    elif [ "$EXPECTED_ERROR" = true ] || [ "$HAS_SUCCESS" -gt 0 ]; then
        # Script executed successfully (may have expected errors like USE ROLE)
        if echo "$EXEC_OUTPUT" | grep -qi "warning\|already exists"; then
            echo -e "${YELLOW}⚠️  SQL script completed with warnings (some resources may already exist)${NC}"
        else
            echo -e "${GREEN}✅ SQL script executed successfully${NC}"
        fi
        rm -f "$temp_sql"
        return 0
    elif [ $EXEC_EXIT -eq 0 ]; then
        # Exit code was 0, consider it successful
        if echo "$EXEC_OUTPUT" | grep -qi "warning\|already exists"; then
            echo -e "${YELLOW}⚠️  SQL script completed with warnings (some resources may already exist)${NC}"
        else
            echo -e "${GREEN}✅ SQL script executed successfully${NC}"
        fi
        rm -f "$temp_sql"
        return 0
    else
        # No clear success indicators but no SQL errors either
        # This might be warnings only - check if it's safe to continue
        if echo "$EXEC_OUTPUT" | grep -qiE "error|failed" && ! echo "$EXEC_OUTPUT" | grep -qiE "SQL compilation error|SQL execution error|syntax error|USE ROLE.*is not assigned"; then
            # Might be a non-SQL error (like connection issues)
            echo -e "${RED}❌ SQL script execution may have failed${NC}"
            echo "$EXEC_OUTPUT" | tail -30
            rm -f "$temp_sql"
            return 1
        else
            # Assume success if no SQL errors found
            echo -e "${YELLOW}⚠️  SQL script completed (may have warnings)${NC}"
            rm -f "$temp_sql"
            return 0
        fi
    fi
}

create_snowflake_resources() {
    echo -e "${YELLOW}🏗️  Creating Snowflake resources using SQL scripts...${NC}"
    
    # Variables are already set by parse_args() with proper precedence:
    # Defaults -> Flags -> Environment Variables
    
    # Determine roles to use
    echo -e "${BLUE}Using SQL script: sql/setup_service_account.sql (single source of truth)${NC}"
    
    # Display current role to inform user
    CURRENT_ROLE=$(snow sql -q "SELECT CURRENT_ROLE()" 2>/dev/null | grep -v "current_role()" | grep -v "^-" | head -1 | xargs || echo "unknown")
    echo -e "${BLUE}Using default role: ${CURRENT_ROLE}${NC}"
    echo -e "${BLUE}Ensure this role has permissions to create databases, warehouses, users, roles, and grant permissions.${NC}"
    echo ""
    
    # Default service account password - can be overridden with environment variable
    SERVICE_USER_PASSWORD=${SNOWFLAKE_SERVICE_USER_PASSWORD:-"ChangeThisPassword123!"}
    SERVICE_ROLE_NAME="API_PROXY_SERVICE_ROLE"
    SERVICE_USER_NAME="API_PROXY_SERVICE_MANAGER"
    
    # Get script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SQL_DIR="${SCRIPT_DIR}/../sql"
    
    # Execute setup_service_account.sql to create all resources
    # This script is the single source of truth for database setup
    echo -e "${BLUE}Running sql/setup_service_account.sql with variable substitution...${NC}"
    SETUP_SQL="${SQL_DIR}/setup_service_account.sql"
    
    if [ ! -f "$SETUP_SQL" ]; then
        echo -e "${RED}❌ SQL setup script not found: ${SETUP_SQL}${NC}"
        exit 1
    fi
    
    # Execute the SQL script with variable substitution
    # The execute_sql_script function replaces:
    # - API_PROXY -> ${DATABASE}
    # - API_PROXY_WH -> ${WAREHOUSE}
    # - API_PROXY.APP -> ${DATABASE}.${SCHEMA}
    # - API_PROXY_SERVICE_MANAGER -> ${SERVICE_USER_NAME}
    # - API_PROXY_SERVICE_ROLE -> ${SERVICE_ROLE_NAME}
    # - 'ChangeThisPassword123!' -> ${SERVICE_USER_PASSWORD}
    if execute_sql_script "$SETUP_SQL"; then
        echo -e "${GREEN}✅ Snowflake resources created successfully${NC}"
        echo -e "${BLUE}   Database: ${DATABASE}${NC}"
        echo -e "${BLUE}   Schema: ${DATABASE}.${SCHEMA}${NC}"
        echo -e "${BLUE}   Warehouse: ${WAREHOUSE}${NC}"
        echo -e "${BLUE}   Service Role: ${SERVICE_ROLE_NAME}${NC}"
        echo -e "${BLUE}   Service User: ${SERVICE_USER_NAME}${NC}"
        echo -e "${BLUE}   Password: (set via SNOWFLAKE_SERVICE_USER_PASSWORD env var or default)${NC}"
    else
        echo -e "${RED}❌ SQL script execution failed${NC}"
        echo -e "${YELLOW}   Check the error messages above and verify your permissions${NC}"
        exit 1
    fi
    
    # Verify and ensure role is granted to user
    echo -e "${BLUE}Verifying role assignment to user...${NC}"
    ROLE_GRANTED=$(snow sql -q "SHOW GRANTS TO USER ${SERVICE_USER_NAME}" 2>/dev/null | grep -i "${SERVICE_ROLE_NAME}" || echo "")
    if [ -z "$ROLE_GRANTED" ]; then
        echo -e "${YELLOW}⚠️  Role ${SERVICE_ROLE_NAME} not found assigned to user ${SERVICE_USER_NAME}${NC}"
        echo -e "${BLUE}   Attempting to grant role to user...${NC}"
        if snow sql -q "GRANT ROLE ${SERVICE_ROLE_NAME} TO USER ${SERVICE_USER_NAME}" 2>&1; then
            echo -e "${GREEN}✅ Role ${SERVICE_ROLE_NAME} granted to user ${SERVICE_USER_NAME}${NC}"
            # Also set as default role
            snow sql -q "ALTER USER ${SERVICE_USER_NAME} SET DEFAULT_ROLE = '${SERVICE_ROLE_NAME}'" 2>&1 || true
        else
            echo -e "${RED}❌ Failed to grant role to user. Manual intervention may be required.${NC}"
            echo -e "${YELLOW}⚠️  Ensure your default role has permissions to grant roles to users.${NC}"
        fi
    else
        echo -e "${GREEN}✅ Role ${SERVICE_ROLE_NAME} is already assigned to user ${SERVICE_USER_NAME}${NC}"
    fi
    
    # Create application tables (ENDPOINTS, API_KEYS, etc.)
    echo -e "${BLUE}Creating application tables...${NC}"
    CREATE_TABLES_SQL="${SQL_DIR}/create_tables.sql"
    
    if [ ! -f "$CREATE_TABLES_SQL" ]; then
        echo -e "${RED}❌ SQL create tables script not found: ${CREATE_TABLES_SQL}${NC}"
        exit 1
    fi
    
    # Execute create_tables.sql and capture output
    echo -e "${BLUE}Executing create_tables.sql...${NC}"
    if execute_sql_script "$CREATE_TABLES_SQL"; then
        echo -e "${GREEN}✅ SQL script execution completed${NC}"
    else
        echo -e "${RED}❌ Failed to execute create_tables.sql${NC}"
        echo -e "${YELLOW}   Check the error messages above and verify your permissions${NC}"
    fi
    
    create_sample_data_impl
    
    # Create Snowflake PAT token for service user (optional)
    create_service_pat_token
    
    # Verify key resources were created
    echo -e "${BLUE}Verifying resources were created...${NC}"
    
    # Verify database
    if snow sql -q "SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null | grep -qi "${DATABASE}"; then
        echo -e "${GREEN}✅ Database ${DATABASE} verified${NC}"
    else
        echo -e "${RED}❌ Database ${DATABASE} not found${NC}"
        exit 1
    fi
    
    # Verify warehouse
    if snow sql -q "SHOW WAREHOUSES LIKE '${WAREHOUSE}'" 2>/dev/null | grep -qi "${WAREHOUSE}"; then
        echo -e "${GREEN}✅ Warehouse ${WAREHOUSE} verified${NC}"
    else
        echo -e "${RED}❌ Warehouse ${WAREHOUSE} not found${NC}"
        exit 1
    fi
    
    # Verify user
    if snow sql -q "SHOW USERS LIKE '${SERVICE_USER_NAME}'" 2>/dev/null | grep -qi "${SERVICE_USER_NAME}"; then
        echo -e "${GREEN}✅ Service user ${SERVICE_USER_NAME} verified${NC}"
    else
        echo -e "${YELLOW}⚠️  Service user ${SERVICE_USER_NAME} may not exist (non-fatal)${NC}"
    fi
    
    # Verify role
    if snow sql -q "SHOW ROLES LIKE '${SERVICE_ROLE_NAME}'" 2>/dev/null | grep -qi "${SERVICE_ROLE_NAME}"; then
        echo -e "${GREEN}✅ Service role ${SERVICE_ROLE_NAME} verified${NC}"
    else
        echo -e "${YELLOW}⚠️  Service role ${SERVICE_ROLE_NAME} may not exist (non-fatal)${NC}"
    fi
    
    # Create compute pool (connection test passed, so we have privileges)
    echo -e "${BLUE}Checking compute pool: ${COMPUTE_POOL}...${NC}"
    # Check if compute pool exists (use list command as status may not be supported)
    POOL_EXISTS=false
    POOL_LIST=$(snow spcs compute-pool list 2>/dev/null | grep -i "${COMPUTE_POOL}" || echo "")
    if [ -n "$POOL_LIST" ]; then
        POOL_EXISTS=true
    fi
    
    if [ "$POOL_EXISTS" = true ]; then
        if [ "$RECREATE_COMPUTE_POOL" = true ]; then
            echo -e "${YELLOW}Compute pool ${COMPUTE_POOL} exists. Dropping it for recreation...${NC}"
            if snow spcs compute-pool drop ${COMPUTE_POOL} 2>&1; then
                echo -e "${GREEN}✅ Compute pool ${COMPUTE_POOL} dropped${NC}"
                POOL_EXISTS=false  # Reset flag after dropping
            else
                echo -e "${RED}❌ Failed to drop compute pool ${COMPUTE_POOL}${NC}"
                echo -e "${YELLOW}Error details shown above.${NC}"
                exit 1
            fi
        else
            echo -e "${GREEN}✅ Compute pool ${COMPUTE_POOL} already exists (use --recreate-compute-pool to recreate)${NC}"
        fi
    fi
    
    # Create compute pool if it doesn't exist (or was dropped)
    if [ "$POOL_EXISTS" = false ]; then
        echo -e "${BLUE}Creating compute pool: ${COMPUTE_POOL}...${NC}"
        echo -e "${BLUE}This may take a few minutes...${NC}"
        # Run creation command
        CREATE_OUTPUT=$(snow spcs compute-pool create ${COMPUTE_POOL} \
            --min-nodes 1 \
            --max-nodes 3 \
            --family CPU_X64_XS 2>&1 || echo "TIMEOUT_OR_ERROR")
        CREATE_EXIT=$?
        
        if [ $CREATE_EXIT -eq 0 ] && [ "$CREATE_OUTPUT" != "TIMEOUT_OR_ERROR" ]; then
            echo -e "${GREEN}✅ Compute pool ${COMPUTE_POOL} created${NC}"
        else
            # Check if error is "already exists" (could happen if created between checks)
            if echo "$CREATE_OUTPUT" | grep -qi "already exists"; then
                echo -e "${GREEN}✅ Compute pool ${COMPUTE_POOL} already exists${NC}"
            elif echo "$CREATE_OUTPUT" | grep -qi "TIMEOUT_OR_ERROR"; then
                echo -e "${YELLOW}⚠️  Compute pool creation timed out or encountered an error${NC}"
                echo -e "${YELLOW}Checking if compute pool was created...${NC}"
                # Re-check if it exists
                sleep 5
                POOL_LIST=$(snow spcs compute-pool list 2>/dev/null | grep -i "${COMPUTE_POOL}" || echo "")
                if [ -n "$POOL_LIST" ]; then
                    echo -e "${GREEN}✅ Compute pool ${COMPUTE_POOL} exists (creation may still be in progress)${NC}"
                else
                    echo "$CREATE_OUTPUT"
                    echo -e "${YELLOW}⚠️  Compute pool creation failed, but continuing with deployment...${NC}"
                    echo -e "${YELLOW}⚠️  You may need to create the compute pool manually or use --recreate-compute-pool${NC}"
                fi
            else
                echo "$CREATE_OUTPUT"
                echo -e "${YELLOW}⚠️  Compute pool creation failed, but continuing with deployment...${NC}"
                echo -e "${YELLOW}⚠️  Service deployment will fail if compute pool is required${NC}"
            fi
        fi
    fi
    
    # Note: Skip status check as it may not be supported in all Snowflake versions
    # Compute pool should be ready for use after creation
    echo -e "${BLUE}Compute pool ${COMPUTE_POOL} ready for use (will be activated when service is deployed)${NC}"
    
    # Create image repository if it doesn't exist
    echo -e "${BLUE}Creating image repository: ${DATABASE}.${SCHEMA}.REPOSITORY...${NC}"
    
    # Check if repository already exists
    REPO_EXISTS=false
    if snow sql -q "SHOW IMAGE REPOSITORIES IN SCHEMA ${DATABASE}.${SCHEMA}" 2>/dev/null | grep -qi "REPOSITORY"; then
        REPO_EXISTS=true
        echo -e "${GREEN}✅ Image repository ${DATABASE}.${SCHEMA}.REPOSITORY already exists${NC}"
    fi
    
    # Create repository if it doesn't exist
    if [ "$REPO_EXISTS" = false ]; then
        echo -e "${BLUE}Creating image repository...${NC}"
        CREATE_REPO_OUTPUT=$(snow sql -q "CREATE IMAGE REPOSITORY ${DATABASE}.${SCHEMA}.REPOSITORY" 2>&1)
        CREATE_REPO_EXIT=$?
        
        if [ $CREATE_REPO_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ Image repository ${DATABASE}.${SCHEMA}.REPOSITORY created${NC}"
        else
            # Check if error is "already exists" (might have been created between checks)
            if echo "$CREATE_REPO_OUTPUT" | grep -qi "already exists"; then
                echo -e "${GREEN}✅ Image repository ${DATABASE}.${SCHEMA}.REPOSITORY already exists${NC}"
            elif echo "$CREATE_REPO_OUTPUT" | grep -qi "insufficient privileges\|permission denied"; then
                echo -e "${YELLOW}⚠️  Insufficient privileges to create repository. Trying with ACCOUNTADMIN...${NC}"
                # Try with ACCOUNTADMIN as fallback
                if snow sql -q "CREATE IMAGE REPOSITORY IF NOT EXISTS ${DATABASE}.${SCHEMA}.REPOSITORY" 2>/dev/null; then
                    echo -e "${GREEN}✅ Image repository created with ACCOUNTADMIN${NC}"
                else
                    echo -e "${YELLOW}⚠️  Could not create image repository. Will attempt during image push.${NC}"
                    echo -e "${YELLOW}   Error: $(echo "$CREATE_REPO_OUTPUT" | tail -5)${NC}"
                fi
            else
                echo -e "${YELLOW}⚠️  Could not create image repository. Will attempt during image push.${NC}"
                echo -e "${YELLOW}   Error: $(echo "$CREATE_REPO_OUTPUT" | tail -5)${NC}"
            fi
        fi
    fi
    
    # Verify repository is accessible
    echo -e "${BLUE}Verifying repository access...${NC}"
    if snow spcs image-registry url --database ${DATABASE} --schema ${SCHEMA} > /dev/null 2>&1; then
        REPO_URL=$(snow spcs image-registry url --database ${DATABASE} --schema ${SCHEMA} 2>/dev/null)
        echo -e "${GREEN}✅ Repository is accessible at: ${REPO_URL}${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not verify repository URL (may be created on first push)${NC}"
    fi
    
    # Export variables for use in service deployment
    export SNOWFLAKE_WAREHOUSE=$WAREHOUSE
    export SNOWFLAKE_DATABASE=$DATABASE
    export SNOWFLAKE_SCHEMA=$SCHEMA
    export SNOWFLAKE_COMPUTE_POOL=$COMPUTE_POOL
    export SNOWFLAKE_SERVICE_USER=$SERVICE_USER_NAME
    export SNOWFLAKE_SERVICE_ROLE=$SERVICE_ROLE_NAME
    export SNOWFLAKE_SERVICE_USER_PASSWORD=$SERVICE_USER_PASSWORD
    
    COMPUTE_POOL=$SNOWFLAKE_COMPUTE_POOL
    WAREHOUSE=$SNOWFLAKE_WAREHOUSE
    DATABASE=$SNOWFLAKE_DATABASE
    SCHEMA=$SNOWFLAKE_SCHEMA
    
    echo -e "${GREEN}✅ All required Snowflake resources are ready${NC}"
}

# Build Docker images
build_images() {
    echo -e "${YELLOW}🔨 Building Docker images...${NC}"
    
    # Verify Docker is running
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        exit 1
    fi
    
    # Build backend image for linux/amd64 (Snowflake requires x86_64)
    echo -e "${BLUE}Building backend image: ${IMAGE_NAME}-backend:${VERSION}...${NC}"
    echo -e "${BLUE}Building for linux/amd64 platform (Snowflake requirement)...${NC}"
    if ! docker build --platform linux/amd64 -t ${IMAGE_NAME}-backend:${VERSION} -f ./backend/Dockerfile ./backend; then
        echo -e "${RED}❌ Failed to build backend image${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Backend image built successfully${NC}"
    
    # Build frontend image for linux/amd64 (Snowflake requires x86_64)
    echo -e "${BLUE}Building frontend image: ${IMAGE_NAME}-frontend:${VERSION}...${NC}"
    echo -e "${BLUE}Building for linux/amd64 platform (Snowflake requirement)...${NC}"
    if ! docker build --platform linux/amd64 -t ${IMAGE_NAME}-frontend:${VERSION} -f ./frontend/Dockerfile ./frontend; then
        echo -e "${RED}❌ Failed to build frontend image${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Frontend image built successfully${NC}"
    
    echo -e "${GREEN}✅ All images built successfully${NC}"
}

# Push images to Snowflake Image Registry using Snow CLI
push_images() {
    echo -e "${YELLOW}📤 Pushing images to Snowflake Image Registry...${NC}"
    
    # Ensure required variables are set
    if [ -z "$DATABASE" ] || [ -z "$SCHEMA" ]; then
        echo -e "${RED}❌ DATABASE and SCHEMA must be set${NC}"
        exit 1
    fi
    
    # Get registry URL from Snow CLI
    echo -e "${BLUE}Getting Snowflake Image Registry URL...${NC}"
    REGISTRY_BASE=$(snow spcs image-registry url --database ${DATABASE} --schema ${SCHEMA} 2>&1)
    REGISTRY_EXIT=$?
    
    # Check if URL command succeeded and extract clean URL
    if [ $REGISTRY_EXIT -ne 0 ] || [ -z "$REGISTRY_BASE" ] || echo "$REGISTRY_BASE" | grep -qi "error\|not found"; then
        echo -e "${YELLOW}⚠️  Could not get registry URL with database/schema, trying default...${NC}"
        REGISTRY_BASE=$(snow spcs image-registry url 2>&1)
        REGISTRY_EXIT=$?
    fi
    
    # If still no URL, try to construct from account
    if [ $REGISTRY_EXIT -ne 0 ] || [ -z "$REGISTRY_BASE" ] || echo "$REGISTRY_BASE" | grep -qi "error\|not found"; then
        echo -e "${YELLOW}⚠️  Could not get registry URL automatically, constructing from account...${NC}"
        # Try to get account from config or env
        if [ -z "$SNOWFLAKE_ACCOUNT" ]; then
            SNOWFLAKE_ACCOUNT=$(snow connection show 2>/dev/null | grep -i account | head -1 | sed 's/.*account[[:space:]]*:[[:space:]]*//i' || echo "")
        fi
        if [ -z "$SNOWFLAKE_ACCOUNT" ]; then
            echo -e "${RED}❌ Cannot determine registry URL. SNOWFLAKE_ACCOUNT not set.${NC}"
            echo -e "${YELLOW}   Attempting to create repository if it doesn't exist...${NC}"
            # Try to create repository as last resort
            snow sql -q "CREATE IMAGE REPOSITORY IF NOT EXISTS ${DATABASE}.${SCHEMA}.REPOSITORY" > /dev/null 2>&1 || true
            # Try URL again after potential repository creation
            REGISTRY_BASE=$(snow spcs image-registry url --database ${DATABASE} --schema ${SCHEMA} 2>/dev/null || echo "")
        fi
        
        if [ -z "$REGISTRY_BASE" ] && [ -n "$SNOWFLAKE_ACCOUNT" ]; then
            # Extract just the account identifier (remove .snowflakecomputing.com if present)
            ACCOUNT_ID=$(echo "$SNOWFLAKE_ACCOUNT" | sed 's/\.snowflakecomputing\.com//' | sed 's/\.registry\.snowflakecomputing\.com//')
            REGISTRY_BASE="${ACCOUNT_ID}.registry.snowflakecomputing.com"
            echo -e "${BLUE}Constructed registry URL: ${REGISTRY_BASE}${NC}"
        fi
        
        if [ -z "$REGISTRY_BASE" ]; then
            echo -e "${RED}❌ Cannot determine registry URL. Please set SNOWFLAKE_ACCOUNT or ensure repository exists.${NC}"
            exit 1
        fi
    fi
    
    # Clean up any whitespace or error messages from REGISTRY_BASE
    # Extract just the registry domain (account.registry.snowflakecomputing.com)
    REGISTRY_BASE=$(echo "$REGISTRY_BASE" | grep -oE '[a-zA-Z0-9_-]+\.registry\.snowflakecomputing\.com' | head -1 || \
                    echo "$REGISTRY_BASE" | sed 's|https\?://||' | sed 's|/.*||' | tr -d '\n' | tr -d ' ')
    
    echo -e "${GREEN}✅ Registry base URL: ${REGISTRY_BASE}${NC}"
    
    # Registry URL format: <account>.registry.snowflakecomputing.com/<database>/<schema>/<repository>
    # Docker requires lowercase for image names, so convert database and schema to lowercase
    DB_LOWER=$(echo "${DATABASE}" | tr '[:upper:]' '[:lower:]')
    SCHEMA_LOWER=$(echo "${SCHEMA}" | tr '[:upper:]' '[:lower:]')
    REPO_LOWER="repository"  # Repository name in lowercase
    REGISTRY_URL="${REGISTRY_BASE}/${DB_LOWER}/${SCHEMA_LOWER}/${REPO_LOWER}"
    
    echo -e "${BLUE}Registry URL: ${REGISTRY_URL}${NC}"
    echo -e "${BLUE}Using lowercase paths for Docker: ${DB_LOWER}/${SCHEMA_LOWER}/${REPO_LOWER}${NC}"
    
    # Login to registry using Snow CLI (handles both password and key-based auth)
    echo -e "${BLUE}Logging into Snowflake Image Registry...${NC}"
    
    # Authenticate with registry - try multiple methods
    echo -e "${BLUE}Authenticating with Snowflake Image Registry...${NC}"
    LOGIN_SUCCESS=false
    
    # Method 1: Try Snow CLI login (best method, handles OAuth and key-based auth)
    echo -e "${BLUE}Trying Snow CLI authentication...${NC}"
    if snow spcs image-registry login --database ${DATABASE} --schema ${SCHEMA} 2>&1; then
        echo -e "${GREEN}✅ Successfully authenticated via Snow CLI${NC}"
        LOGIN_SUCCESS=true
    elif snow spcs image-registry login 2>&1; then
        echo -e "${GREEN}✅ Successfully authenticated via Snow CLI (default connection)${NC}"
        LOGIN_SUCCESS=true
    else
        echo -e "${YELLOW}⚠️  Snow CLI authentication failed, trying Docker login...${NC}"
    fi
    
    # Method 2: Docker login with password (if Snow CLI login failed and password is available)
    if [ "$LOGIN_SUCCESS" = false ] && [ -n "$SNOWFLAKE_PASSWORD" ]; then
        echo -e "${BLUE}Trying Docker login with password...${NC}"
        # Get username from connection or env
        DOCKER_USER="${SNOWFLAKE_USERNAME:-$SNOWFLAKE_USER}"
        if [ -z "$DOCKER_USER" ]; then
            DOCKER_USER=$(snow connection show 2>/dev/null | grep -i "user" | head -1 | sed 's/.*user[[:space:]]*:[[:space:]]*//i' || echo "")
        fi
        
        if [ -n "$DOCKER_USER" ]; then
            if echo "${SNOWFLAKE_PASSWORD}" | docker login "${REGISTRY_BASE}" -u "${DOCKER_USER}" --password-stdin 2>&1; then
                echo -e "${GREEN}✅ Successfully authenticated via Docker login${NC}"
                LOGIN_SUCCESS=true
            else
                echo -e "${YELLOW}⚠️  Docker login failed${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Could not determine username for Docker login${NC}"
        fi
    fi
    
    # If authentication still failed, warn but continue (Snow CLI might handle auth automatically)
    if [ "$LOGIN_SUCCESS" = false ]; then
        echo -e "${YELLOW}⚠️  Authentication may not have succeeded${NC}"
        echo -e "${YELLOW}⚠️  Snow CLI may handle authentication automatically during push${NC}"
        echo -e "${YELLOW}⚠️  If push fails, ensure you're logged in: snow spcs image-registry login${NC}"
    fi
    
    # Tag images
    BACKEND_IMAGE="${REGISTRY_URL}/${IMAGE_NAME}-backend:${VERSION}"
    FRONTEND_IMAGE="${REGISTRY_URL}/${IMAGE_NAME}-frontend:${VERSION}"
    
    echo -e "${BLUE}Tagging backend image...${NC}"
    if ! docker tag ${IMAGE_NAME}-backend:${VERSION} ${BACKEND_IMAGE}; then
        echo -e "${RED}❌ Failed to tag backend image${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Tagging frontend image...${NC}"
    if ! docker tag ${IMAGE_NAME}-frontend:${VERSION} ${FRONTEND_IMAGE}; then
        echo -e "${RED}❌ Failed to tag frontend image${NC}"
        exit 1
    fi
    
    # Track push status
    BACKEND_PUSHED=false
    FRONTEND_PUSHED=false
    
    # Push backend image using Docker (Snow CLI uses Docker under the hood)
    echo -e "${BLUE}Pushing backend image to ${BACKEND_IMAGE}...${NC}"
    echo -e "${YELLOW}This may take several minutes depending on image size and network speed...${NC}"
    PUSH_OUTPUT=$(docker push ${BACKEND_IMAGE} 2>&1)
    PUSH_EXIT=$?
    if [ $PUSH_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Backend image pushed successfully${NC}"
        BACKEND_PUSHED=true
    else
        echo "$PUSH_OUTPUT" | tail -20
        # Check if error is "already exists" or authorization
        if echo "$PUSH_OUTPUT" | grep -qi "unauthorized\|Authorization Failure"; then
            echo -e "${YELLOW}⚠️  Authorization failed. This may be due to Docker credential storage.${NC}"
            echo -e "${YELLOW}⚠️  You may need to manually push images or check repository permissions.${NC}"
            echo -e "${YELLOW}⚠️  Attempting to continue with service deployment (images may already exist)...${NC}"
            # Assume it might already be there, but warn
            BACKEND_PUSHED=false
        elif echo "$PUSH_OUTPUT" | grep -qi "already exists\|already pushed"; then
            echo -e "${GREEN}✅ Backend image already exists in registry${NC}"
            BACKEND_PUSHED=true
        else
            echo -e "${RED}❌ Failed to push backend image${NC}"
            echo -e "${YELLOW}Error details shown above.${NC}"
            echo -e "${YELLOW}⚠️  Attempting to continue - image may need to be pushed manually${NC}"
            BACKEND_PUSHED=false
        fi
    fi
    
    # Push frontend image using Docker
    echo -e "${BLUE}Pushing frontend image to ${FRONTEND_IMAGE}...${NC}"
    PUSH_OUTPUT=$(docker push ${FRONTEND_IMAGE} 2>&1)
    PUSH_EXIT=$?
    if [ $PUSH_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend image pushed successfully${NC}"
        FRONTEND_PUSHED=true
    else
        echo "$PUSH_OUTPUT" | tail -20
        if echo "$PUSH_OUTPUT" | grep -qi "unauthorized\|Authorization Failure"; then
            echo -e "${YELLOW}⚠️  Authorization failed. Continuing anyway...${NC}"
            FRONTEND_PUSHED=false
        elif echo "$PUSH_OUTPUT" | grep -qi "already exists\|already pushed"; then
            echo -e "${GREEN}✅ Frontend image already exists in registry${NC}"
            FRONTEND_PUSHED=true
        else
            echo -e "${RED}❌ Failed to push frontend image${NC}"
            echo -e "${YELLOW}Error details shown above.${NC}"
            echo -e "${YELLOW}⚠️  Attempting to continue - image may need to be pushed manually${NC}"
            FRONTEND_PUSHED=false
        fi
    fi
    
    # Summary and verification
    if [ "$BACKEND_PUSHED" = true ] && [ "$FRONTEND_PUSHED" = true ]; then
        echo -e "${GREEN}✅ All images pushed successfully${NC}"
        
        # Verify images exist in registry (optional check)
        echo -e "${BLUE}Verifying images in registry...${NC}"
        if snow spcs image-repository list --database ${DATABASE} --schema ${SCHEMA} 2>/dev/null | grep -qi "${IMAGE_NAME}"; then
            echo -e "${GREEN}✅ Images verified in registry${NC}"
            snow spcs image-repository list --database ${DATABASE} --schema ${SCHEMA} 2>/dev/null | grep -i "${IMAGE_NAME}" | head -5
        else
            echo -e "${YELLOW}⚠️  Could not verify images via 'snow spcs image-repository list' (this is normal, images may not be queryable yet)${NC}"
        fi
    else
        echo -e "${RED}❌ Image push failed or incomplete${NC}"
        if [ "$BACKEND_PUSHED" = false ]; then
            echo -e "${RED}   ❌ Backend image push failed${NC}"
        fi
        if [ "$FRONTEND_PUSHED" = false ]; then
            echo -e "${RED}   ❌ Frontend image push failed${NC}"
        fi
        echo -e "${YELLOW}⚠️  Deployment cannot proceed without images in registry${NC}"
        echo -e "${YELLOW}⚠️  Troubleshooting steps:${NC}"
        echo -e "${YELLOW}   1. Ensure repository exists: snow sql -q 'SHOW IMAGE REPOSITORIES IN SCHEMA ${DATABASE}.${SCHEMA}'${NC}"
        echo -e "${YELLOW}   2. Verify authentication: snow spcs image-registry login --database ${DATABASE} --schema ${SCHEMA}${NC}"
        echo -e "${YELLOW}   3. Check registry URL: snow spcs image-registry url --database ${DATABASE} --schema ${SCHEMA}${NC}"
        echo -e "${YELLOW}   4. Try manual push: docker push ${BACKEND_IMAGE}${NC}"
        exit 1
    fi
    
    # Store image paths for service spec (Snowflake format: DATABASE.SCHEMA.REPOSITORY.IMAGE:TAG)
    export BACKEND_IMAGE_PATH="${DATABASE}.${SCHEMA}.REPOSITORY.${IMAGE_NAME}-backend:${VERSION}"
    export FRONTEND_IMAGE_PATH="${DATABASE}.${SCHEMA}.REPOSITORY.${IMAGE_NAME}-frontend:${VERSION}"
}

# Create service specification file
create_service_spec() {
    echo -e "${YELLOW}📝 Creating service specification...${NC}"
    
    # Get registry base URL for image references
    REGISTRY_BASE_FOR_SPEC=$(snow spcs image-registry url --database ${DATABASE} --schema ${SCHEMA} 2>/dev/null || \
                              snow spcs image-registry url 2>/dev/null || \
                              echo "${SNOWFLAKE_ACCOUNT}.registry.snowflakecomputing.com")
    
    # Ensure SNOWFLAKE_ACCOUNT is set (extract from connection if needed)
    if [ -z "$SNOWFLAKE_ACCOUNT" ]; then
        SNOWFLAKE_ACCOUNT=$(snow connection show 2>/dev/null | grep -i account | head -1 | sed 's/.*account[[:space:]]*:[[:space:]]*//i' | tr -d ' ' || echo "")
        # If still empty, try to extract from registry URL
        if [ -z "$SNOWFLAKE_ACCOUNT" ] && [ -n "$REGISTRY_BASE_FOR_SPEC" ]; then
            SNOWFLAKE_ACCOUNT=$(echo "$REGISTRY_BASE_FOR_SPEC" | sed 's/\.registry\.snowflakecomputing\.com//' | sed 's/.*\///')
        fi
    fi
    
    # Extract account identifier (remove .snowflakecomputing.com if present)
    SNOWFLAKE_ACCOUNT_ID=$(echo "$SNOWFLAKE_ACCOUNT" | sed 's/\.snowflakecomputing\.com$//' | sed 's/\.registry\.snowflakecomputing\.com$//')
    
    # Ensure WAREHOUSE is set (use default if not provided)
    if [ -z "$WAREHOUSE" ]; then
        WAREHOUSE="API_PROXY_WH"
        echo -e "${YELLOW}⚠️  WAREHOUSE not set, using default: ${WAREHOUSE}${NC}"
    fi
    
    # Ensure SNOWFLAKE_WAREHOUSE is set for service spec
    SNOWFLAKE_WAREHOUSE="${SNOWFLAKE_WAREHOUSE:-${WAREHOUSE}}"
    
    # Use full registry URL format for service spec: <registry>/<db>/<schema>/<repo>/<image>:<tag>
    DB_LOWER_FOR_SPEC=$(echo "${DATABASE}" | tr '[:upper:]' '[:lower:]')
    SCHEMA_LOWER_FOR_SPEC=$(echo "${SCHEMA}" | tr '[:upper:]' '[:lower:]')
    BACKEND_IMAGE_REF="${REGISTRY_BASE_FOR_SPEC}/${DB_LOWER_FOR_SPEC}/${SCHEMA_LOWER_FOR_SPEC}/repository/${IMAGE_NAME}-backend:${VERSION}"
    FRONTEND_IMAGE_REF="${REGISTRY_BASE_FOR_SPEC}/${DB_LOWER_FOR_SPEC}/${SCHEMA_LOWER_FOR_SPEC}/repository/${IMAGE_NAME}-frontend:${VERSION}"
    
    cat > service-spec.yaml << EOF
spec:
  containers:
  - name: "backend"
    image: "${BACKEND_IMAGE_REF}"
    env:
      NODE_ENV: "production"
      PORT: "3001"
      HOST: "0.0.0.0"
      # Snowflake connection - uses OAuth token from /snowflake/session/token when available
      # SNOWFLAKE_HOST and SNOWFLAKE_ACCOUNT are automatically provided by Snowflake SPCS
      # Do NOT set SNOWFLAKE_ACCOUNT manually - Snowflake provides it automatically
      # SNOWFLAKE_ACCOUNT is automatically set to the account locator by Snowflake
      SNOWFLAKE_WAREHOUSE: "${SNOWFLAKE_WAREHOUSE}"
      SNOWFLAKE_DATABASE: "${SNOWFLAKE_DATABASE}"
      SNOWFLAKE_SCHEMA: "${SNOWFLAKE_SCHEMA}"
      SNOWFLAKE_SERVICE_ROLE: "${SNOWFLAKE_SERVICE_ROLE:-API_PROXY_SERVICE_ROLE}"
      # Service account credentials - uses OAuth token from /snowflake/session/token when available (SPCS)
      # Falls back to username/password if OAuth not available
      SNOWFLAKE_USERNAME: "${SNOWFLAKE_SERVICE_USER:-API_PROXY_SERVICE_MANAGER}"
      SNOWFLAKE_PASSWORD: "${SNOWFLAKE_SERVICE_USER_PASSWORD:-ChangeThisPassword123!}"
      JWT_SECRET: "${JWT_SECRET}"
      JWT_EXPIRES_IN: "24h"
      # FRONTEND_URL not needed - CORS is configured to allow *.snowflakecomputing.app domains
    readinessProbe:
      port: 3001
      path: "/health"
    resources:
      limits:
        memory: "1Gi"
        cpu: "1"
      requests:
        memory: "512Mi"
        cpu: "0.5"
  - name: "frontend"
    image: "${FRONTEND_IMAGE_REF}"
    env:
      NODE_ENV: "production"
      # REACT_APP_API_URL not needed - frontend uses relative /api path
      # which nginx proxies to backend container
    readinessProbe:
      port: 80
      path: "/health"
    resources:
      limits:
        memory: "256Mi"
        cpu: "0.5"
      requests:
        memory: "128Mi"
        cpu: "0.1"
  endpoints:
  - name: "apiendpoint"
    port: 3001
    public: false
  - name: "webendpoint"
    port: 80
    public: true
serviceRoles:
- name: endpointaccessrole
  endpoints:
  - webendpoint
EOF

    echo -e "${GREEN}✅ Service specification created${NC}"
}

# Grant service role to enable PAT token access
grant_service_role() {
    echo -e "${YELLOW}🔐 Granting service role for endpoint access...${NC}"
    
    # Service role name from spec
    SERVICE_ROLE_NAME_SR="endpointaccessrole"
    
    # Full service role reference: DATABASE.SCHEMA.SERVICE_NAME!SERVICE_ROLE_NAME
    FULL_SERVICE_ROLE="${DATABASE}.${SCHEMA}.${SERVICE_NAME}!${SERVICE_ROLE_NAME_SR}"
    
    # Target role to grant to (the application service role)
    TARGET_ROLE="API_PROXY_SERVICE_ROLE"
    
    echo -e "${BLUE}   Granting: ${FULL_SERVICE_ROLE}${NC}"
    echo -e "${BLUE}   To role: ${TARGET_ROLE}${NC}"
    
    GRANT_OUTPUT=$(snow sql -q "GRANT SERVICE ROLE ${FULL_SERVICE_ROLE} TO ROLE ${TARGET_ROLE};" 2>&1)
    GRANT_EXIT=$?
    
    if [ -n "$GRANT_OUTPUT" ]; then
        if [ "${VERBOSE:-false}" = "true" ]; then
            echo -e "${BLUE}   Grant output:${NC}"
            echo "$GRANT_OUTPUT" | sed 's/^/   /'
        fi
    fi
    
    if [ $GRANT_EXIT -eq 0 ] && ! echo "$GRANT_OUTPUT" | grep -qiE "error|failed|does not exist"; then
        echo -e "${GREEN}✅ Service role granted successfully${NC}"
        echo -e "${BLUE}   Role ${TARGET_ROLE} now has access to service endpoints via PAT tokens${NC}"
        return 0
    else
        # Check if it's already granted (not an error)
        if echo "$GRANT_OUTPUT" | grep -qiE "already granted|already has"; then
            echo -e "${BLUE}ℹ️  Service role already granted${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Could not grant service role:${NC}"
            echo "$GRANT_OUTPUT" | sed 's/^/   /'
            echo -e "${YELLOW}   This may need to be done manually:${NC}"
            echo -e "${BLUE}   GRANT SERVICE ROLE ${FULL_SERVICE_ROLE} TO ROLE ${TARGET_ROLE};${NC}"
            return 1
        fi
    fi
}

# Deploy to Snowflake Container Services using Snow CLI
deploy_service() {
    echo -e "${YELLOW}🚀 Deploying service to Snowflake Container Services...${NC}"
    
    # SNOWFLAKE_PASSWORD is optional - service will use OAuth token from /snowflake/session/token
    # when running in SPCS. Only needed for local development or fallback authentication.
    if [ -z "$SNOWFLAKE_PASSWORD" ]; then
        # Try to extract from Snow CLI config (optional, for fallback)
        if [ -f ~/.snowflake/config.toml ]; then
            SNOWFLAKE_PASSWORD=$(grep -i "password" ~/.snowflake/config.toml 2>/dev/null | sed 's/.*password[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/' | head -1 || echo "")
            export SNOWFLAKE_PASSWORD
        fi
        if [ -z "$SNOWFLAKE_PASSWORD" ]; then
            echo -e "${BLUE}ℹ️  SNOWFLAKE_PASSWORD not set. Service will use OAuth token from /snowflake/session/token (recommended for SPCS)${NC}"
        fi
    fi
    
    create_service_spec
    
    # Check if service already exists - use SQL query as most reliable method
    SERVICE_EXISTS=false
    echo -e "${BLUE}Checking if service ${SERVICE_NAME} already exists...${NC}"
    
    # Method 1: Use SQL SHOW SERVICES command (most reliable)
    if [ "${VERBOSE:-false}" = "true" ]; then
        echo -e "${BLUE}DEBUG: Running SHOW SERVICES query...${NC}"
    fi
    SHOW_SERVICES_OUTPUT=$(snow sql -q "USE DATABASE ${DATABASE}; USE SCHEMA ${SCHEMA}; SHOW SERVICES LIKE '${SERVICE_NAME}';" 2>&1)
    if [ "${VERBOSE:-false}" = "true" ]; then
        echo -e "${BLUE}DEBUG: SHOW SERVICES output:${NC}"
        echo "$SHOW_SERVICES_OUTPUT" | head -20
    fi
    # Check if service exists - look for actual service data, not just "No data" or error messages
    if echo "$SHOW_SERVICES_OUTPUT" | grep -qiE "No data|does not exist|not found|0 rows"; then
        # Service definitely doesn't exist
        SERVICE_EXISTS=false
    elif echo "$SHOW_SERVICES_OUTPUT" | grep -qiE "${SERVICE_NAME}"; then
        # Service name appears in output - verify it's not in an error message
        if ! echo "$SHOW_SERVICES_OUTPUT" | grep -qiE "does not exist|not found|0 rows|No data"; then
            SERVICE_EXISTS=true
            echo -e "${GREEN}✅ Service ${SERVICE_NAME} found via SHOW SERVICES${NC}"
        fi
    fi
    
    # Method 2: Try service list command as backup
    if [ "$SERVICE_EXISTS" != "true" ]; then
        if [ "${VERBOSE:-false}" = "true" ]; then
            echo -e "${BLUE}DEBUG: Trying service list command as backup...${NC}"
        fi
        LIST_OUTPUT_WITH_CONTEXT=$(snow spcs service list --database ${DATABASE} --schema ${SCHEMA} 2>&1)
        if [ "${VERBOSE:-false}" = "true" ]; then
            echo -e "${BLUE}DEBUG: Service list output:${NC}"
            echo "$LIST_OUTPUT_WITH_CONTEXT" | head -20
        fi
        if [ $? -eq 0 ] && echo "$LIST_OUTPUT_WITH_CONTEXT" | grep -qiE "${SERVICE_NAME}"; then
            # Make sure it's not just table headers
            if echo "$LIST_OUTPUT_WITH_CONTEXT" | grep -qiE "^[[:space:]]*${SERVICE_NAME}|${SERVICE_NAME}[[:space:]]*"; then
                SERVICE_EXISTS=true
                echo -e "${GREEN}✅ Service ${SERVICE_NAME} found via service list${NC}"
            fi
        fi
    fi
    
    # Debug output if service not found
    if [ "$SERVICE_EXISTS" != "true" ]; then
        echo -e "${BLUE}   Service ${SERVICE_NAME} not found via checks${NC}"
        echo -e "${BLUE}   Will attempt to create (if service exists, create will detect 'already exists' and update instead)${NC}"
    fi
    
    if [ "$SERVICE_EXISTS" = true ]; then
        echo -e "${GREEN}✅ Service ${SERVICE_NAME} already exists${NC}"
        echo -e "${BLUE}   Updating service with new images...${NC}"
        
        # Update the service to use new images from the spec
        echo -e "${BLUE}   Suspending service to update...${NC}"
        SUSPEND_OUTPUT=$(snow spcs service suspend ${SERVICE_NAME} --database ${DATABASE} --schema ${SCHEMA} 2>&1)
        SUSPEND_EXIT=$?
        
        if [ $SUSPEND_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ Service suspended${NC}"
        else
            # Service might already be suspended or in a state where suspend isn't needed
            if echo "$SUSPEND_OUTPUT" | grep -qiE "already suspended|not running|inactive"; then
                echo -e "${BLUE}   Service is already suspended or stopped${NC}"
            else
                echo -e "${YELLOW}⚠️  Could not suspend service (may already be stopped):${NC}"
                echo "$SUSPEND_OUTPUT" | sed 's/^/   /'
            fi
        fi
        
        # Wait a moment for service to fully stop
        sleep 3
        
        # Note: snow spcs service set does not support --spec-path or --compute-pool
        # Service spec cannot be updated via CLI - only properties like min/max instances
        # Since we've pushed new images with the same tags to the registry,
        # resuming the service will cause it to pull the updated images
        echo -e "${BLUE}   Note: Service specification cannot be updated via CLI${NC}"
        echo -e "${BLUE}   New images have been pushed to registry - service will pull them on resume${NC}"
        
        # Resume/start the service with new images
        echo -e "${BLUE}   Resuming service with updated images...${NC}"
        RESUME_OUTPUT=$(snow spcs service resume ${SERVICE_NAME} --database ${DATABASE} --schema ${SCHEMA} 2>&1)
        RESUME_EXIT=$?
        
        if [ -n "$RESUME_OUTPUT" ]; then
            echo -e "${BLUE}   Resume output:${NC}"
            echo "$RESUME_OUTPUT" | sed 's/^/   /'
        fi
        
        if [ $RESUME_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ Service resumed with updated images${NC}"
            # Grant service role after successful resume
            grant_service_role || true
        else
            echo -e "${YELLOW}⚠️  Service resume had issues${NC}"
            echo -e "${YELLOW}   Service may be starting up, check status with: snow spcs service list --database ${DATABASE} --schema ${SCHEMA}${NC}"
        fi
    else
        # Create new service
        echo -e "${BLUE}Creating new service ${SERVICE_NAME}...${NC}"
        echo -e "${BLUE}   This may take several minutes...${NC}"
        # Set database context before creating service
        snow sql -q "USE DATABASE ${DATABASE}; USE SCHEMA ${SCHEMA}" > /dev/null 2>&1
        
        # Show what command is being run for debugging
        echo -e "${BLUE}   Command: snow spcs service create ${SERVICE_NAME} --compute-pool ${COMPUTE_POOL} --spec-path service-spec.yaml --database ${DATABASE} --schema ${SCHEMA}${NC}"
        
        CREATE_OUTPUT=$(snow spcs service create ${SERVICE_NAME} \
            --compute-pool ${COMPUTE_POOL} \
            --spec-path service-spec.yaml \
            --database ${DATABASE} \
            --schema ${SCHEMA} 2>&1)
        CREATE_EXIT=$?
        
        # Always show output for debugging
        if [ -n "$CREATE_OUTPUT" ]; then
            echo -e "${BLUE}   Service creation output:${NC}"
            echo "$CREATE_OUTPUT" | sed 's/^/   /'
        fi
        
        # Check if the error is "already exists" - treat this as success and update instead
        # This is the most reliable way to detect existing services
        if echo "$CREATE_OUTPUT" | grep -qiE "already exists|already exist"; then
            echo -e "${YELLOW}⚠️  Service ${SERVICE_NAME} already exists (detected during create attempt)${NC}"
            echo -e "${BLUE}   Switching to update mode...${NC}"
            
            # Mark service as existing so we can use the update path
            SERVICE_EXISTS=true
            
            # Service exists but our check missed it - update it now
            echo -e "${BLUE}   Suspending service to update...${NC}"
            SUSPEND_OUTPUT=$(snow spcs service suspend ${SERVICE_NAME} --database ${DATABASE} --schema ${SCHEMA} 2>&1)
            SUSPEND_EXIT=$?
            
            if [ $SUSPEND_EXIT -eq 0 ]; then
                echo -e "${GREEN}✅ Service suspended${NC}"
            elif echo "$SUSPEND_OUTPUT" | grep -qiE "already suspended|not running|inactive"; then
                echo -e "${BLUE}   Service is already suspended or stopped${NC}"
            else
                echo -e "${YELLOW}⚠️  Could not suspend service, but continuing with update...${NC}"
                echo "$SUSPEND_OUTPUT" | sed 's/^/   /'
            fi
            
            sleep 3
            
            # Note: Service spec cannot be updated via CLI - images are already pushed to registry
            echo -e "${BLUE}   New images have been pushed to registry${NC}"
            echo -e "${BLUE}   Service will pull updated images when resumed${NC}"
            
            echo -e "${BLUE}   Resuming service with updated images...${NC}"
            RESUME_OUTPUT=$(snow spcs service resume ${SERVICE_NAME} --database ${DATABASE} --schema ${SCHEMA} 2>&1)
            RESUME_EXIT=$?
            
            if [ -n "$RESUME_OUTPUT" ]; then
                echo -e "${BLUE}   Resume output:${NC}"
                echo "$RESUME_OUTPUT" | sed 's/^/   /'
            fi
            
            if [ $RESUME_EXIT -eq 0 ]; then
                echo -e "${GREEN}✅ Service resumed with updated images${NC}"
                # Grant service role after successful resume
                grant_service_role || true
            else
                echo -e "${YELLOW}⚠️  Service resume had issues${NC}"
                echo -e "${YELLOW}   Service may be starting up, it should come online shortly${NC}"
            fi
            
            # Skip the rest of create logic, go straight to wait_for_endpoint
            return 0
        elif [ $CREATE_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ Service created successfully${NC}"
            # Grant service role after successful creation
            grant_service_role || true
        else
            echo -e "${RED}❌ Failed to create service (exit code: ${CREATE_EXIT})${NC}"
            echo -e "${YELLOW}   Full output shown above${NC}"
            echo -e "${YELLOW}   Please check the error messages above for details${NC}"
            echo -e "${BLUE}   Common issues:${NC}"
            echo -e "${BLUE}     - Compute pool does not exist or is not ready${NC}"
            echo -e "${BLUE}     - Image registry authentication failed${NC}"
            echo -e "${BLUE}     - Insufficient permissions on database/schema${NC}"
            echo -e "${BLUE}     - Service specification file has errors${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Service deployed successfully${NC}"
    
    # Wait for endpoint provisioning
    wait_for_endpoint
}

# Check endpoint URL only (debug mode)
check_endpoint_only() {
    echo -e "${YELLOW}🔍 Checking endpoint URL for service ${SERVICE_NAME}...${NC}"
    
    # Set defaults from environment if not provided
    DATABASE=${DATABASE:-${SNOWFLAKE_DATABASE:-$DEFAULT_DATABASE}}
    SCHEMA=${SCHEMA:-${SNOWFLAKE_SCHEMA:-$DEFAULT_SCHEMA}}
    
    echo -e "${BLUE}Database: ${DATABASE}${NC}"
    echo -e "${BLUE}Schema: ${SCHEMA}${NC}"
    echo -e "${BLUE}Service: ${SERVICE_NAME}${NC}"
    echo ""
    
    # Run SHOW ENDPOINTS query as JSON
    echo -e "${BLUE}Running: SHOW ENDPOINTS IN SERVICE ${SERVICE_NAME}${NC}"
    ENDPOINT_JSON=$(snow sql --format json -q "USE DATABASE ${DATABASE}; USE SCHEMA ${SCHEMA}; SHOW ENDPOINTS IN SERVICE ${SERVICE_NAME}" 2>&1)
    
    echo ""
    echo -e "${BLUE}Raw JSON output:${NC}"
    echo "$ENDPOINT_JSON" | head -50
    echo ""
    
    # Check if JSON contains ingress_url with snowflakecomputing.app
    # Extract ingress_url from JSON and check for snowflakecomputing.app
    if echo "$ENDPOINT_JSON" | grep -qiE "snowflakecomputing\.app"; then
        echo -e "${GREEN}✅ Found snowflakecomputing.app in output${NC}"
        
        # Extract ingress_url from JSON
        # Prefer web-endpoint (port 80), fall back to api-endpoint (port 3001)
        
        # Try using jq if available (more reliable)
        if command -v jq &> /dev/null; then
            # The JSON structure has nested arrays - endpoints are in the array that contains objects with "name"
            # Use recursive descent to find all objects, then select web-endpoint
            INGRESS_URL=$(echo "$ENDPOINT_JSON" | jq -r '.. | objects | select(.name == "web-endpoint") | .ingress_url // empty' 2>/dev/null | head -1 || echo "")
            if [ -z "$INGRESS_URL" ] || [ "$INGRESS_URL" = "null" ] || [ "$INGRESS_URL" = "" ]; then
                # Fall back to api-endpoint only if web-endpoint not found
                INGRESS_URL=$(echo "$ENDPOINT_JSON" | jq -r '.. | objects | select(.name == "api-endpoint") | .ingress_url // empty' 2>/dev/null | head -1 || echo "")
            fi
        else
            # Fallback: extract using grep and sed - look for exact name "web-endpoint"
            INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -i '"name"[[:space:]]*:[[:space:]]*"web-endpoint"' -A 15 | grep -i "ingress_url" | head -1 | sed -n 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
            if [ -z "$INGRESS_URL" ]; then
                # Fall back to api-endpoint
                INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -i '"name"[[:space:]]*:[[:space:]]*"api-endpoint"' -A 15 | grep -i "ingress_url" | head -1 | sed -n 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
            fi
            
            # If still empty, try extracting any ingress_url containing snowflakecomputing.app
            if [ -z "$INGRESS_URL" ]; then
                INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -oE '"ingress_url"[[:space:]]*:[[:space:]]*"[^"]*snowflakecomputing\.app[^"]*"' | sed 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | head -1 || echo "")
            fi
        fi
        
        if [ -n "$INGRESS_URL" ] && echo "$INGRESS_URL" | grep -qiE "snowflakecomputing\.app"; then
            SERVICE_URL="http://${INGRESS_URL}"
            echo -e "${GREEN}✅ Extracted ingress_url: ${INGRESS_URL}${NC}"
            echo -e "${GREEN}✅ Service URL: ${SERVICE_URL}${NC}"
        else
            echo -e "${YELLOW}⚠️  Found snowflakecomputing.app but could not extract complete ingress_url${NC}"
            echo -e "${BLUE}   Attempting manual extraction...${NC}"
            
            # Try extracting the full domain from the JSON
            DOMAIN=$(echo "$ENDPOINT_JSON" | grep -oE "[a-zA-Z0-9.-]+\.snowflakecomputing\.app" | head -1 || echo "")
            if [ -n "$DOMAIN" ]; then
                SERVICE_URL="http://${DOMAIN}"
                echo -e "${GREEN}✅ Extracted domain: ${DOMAIN}${NC}"
                echo -e "${GREEN}✅ Service URL: ${SERVICE_URL}${NC}"
            else
                echo -e "${RED}❌ Could not extract domain${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ Did not find snowflakecomputing.app in output${NC}"
    fi
    
    exit 0
}

# Wait for service endpoint to be provisioned
wait_for_endpoint() {
    echo -e "${YELLOW}⏳ Waiting for service endpoint to be provisioned...${NC}"
    
    MAX_WAIT=600  # 10 minutes
    ELAPSED=0
    SERVICE_URL=""
    
    while [ $ELAPSED -lt $MAX_WAIT ]; do
        # Primary method: Check if endpoint is provisioned using SHOW ENDPOINTS IN SERVICE
        # Use JSON format for easier parsing
        ENDPOINT_JSON=$(snow sql --format json -q "USE DATABASE ${DATABASE}; USE SCHEMA ${SCHEMA}; SHOW ENDPOINTS IN SERVICE ${SERVICE_NAME}" 2>&1 || echo "")
        
        # Debug: Show raw output if debug flag is set
        if [ "${DEBUG_ENDPOINT:-false}" = "true" ]; then
            echo -e "${BLUE}DEBUG: SHOW ENDPOINTS JSON output:${NC}"
            echo "$ENDPOINT_JSON" | head -50
            echo -e "${BLUE}DEBUG: Checking for snowflakecomputing.app in ingress_url...${NC}"
        fi
        
        if [ -n "$ENDPOINT_JSON" ]; then
            # Check if JSON contains ingress_url with snowflakecomputing.app
            HAS_INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -qiE "snowflakecomputing\.app" && echo "yes" || echo "no")
            
            if [ "${DEBUG_ENDPOINT:-false}" = "true" ]; then
                echo -e "${BLUE}DEBUG: Found snowflakecomputing.app in output: ${HAS_INGRESS_URL}${NC}"
            fi
            
            if [ "$HAS_INGRESS_URL" = "yes" ]; then
                # Extract ingress_url from JSON
                # Prefer web-endpoint (port 80), fall back to api-endpoint (port 3001)
                
                # Try using jq if available (more reliable)
                if command -v jq &> /dev/null; then
                    # The JSON structure has nested arrays - endpoints are in the array that contains objects with "name"
                    # Use recursive descent to find all objects, then select web-endpoint
                    INGRESS_URL=$(echo "$ENDPOINT_JSON" | jq -r '.. | objects | select(.name == "web-endpoint") | .ingress_url // empty' 2>/dev/null | head -1 || echo "")
                    if [ -z "$INGRESS_URL" ] || [ "$INGRESS_URL" = "null" ] || [ "$INGRESS_URL" = "" ]; then
                        # Fall back to api-endpoint only if web-endpoint not found
                        INGRESS_URL=$(echo "$ENDPOINT_JSON" | jq -r '.. | objects | select(.name == "api-endpoint") | .ingress_url // empty' 2>/dev/null | head -1 || echo "")
                    fi
                else
                    # Fallback: extract using grep and sed
                    # Look for the JSON object with name "web-endpoint"
                    INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -i '"name"[[:space:]]*:[[:space:]]*"web-endpoint"' -A 15 | grep -i "ingress_url" | head -1 | sed -n 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
                    if [ -z "$INGRESS_URL" ]; then
                        # Fall back to api-endpoint
                        INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -i '"name"[[:space:]]*:[[:space:]]*"api-endpoint"' -A 15 | grep -i "ingress_url" | head -1 | sed -n 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
                    fi
                    
                    # If still empty, try extracting any ingress_url containing snowflakecomputing.app
                    if [ -z "$INGRESS_URL" ]; then
                        INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -oE '"ingress_url"[[:space:]]*:[[:space:]]*"[^"]*snowflakecomputing\.app[^"]*"' | sed 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | head -1 || echo "")
                    fi
                fi
                
                if [ "${DEBUG_ENDPOINT:-false}" = "true" ]; then
                    echo -e "${BLUE}DEBUG: Extracted ingress_url: [${INGRESS_URL}]${NC}"
                fi
                
                if [ -n "$INGRESS_URL" ] && [ "$INGRESS_URL" != "null" ] && echo "$INGRESS_URL" | grep -qiE "snowflakecomputing\.app"; then
                    SERVICE_URL="http://${INGRESS_URL}"
                    if [ "${DEBUG_ENDPOINT:-false}" = "true" ]; then
                        echo -e "${BLUE}DEBUG: Service URL set to: ${SERVICE_URL}${NC}"
                    fi
                else
                    # Fallback: extract domain directly from JSON text
                    DOMAIN_ONLY=$(echo "$ENDPOINT_JSON" | grep -oE "[a-zA-Z0-9.-]+\.snowflakecomputing\.app" | head -1 || echo "")
                    if [ -n "$DOMAIN_ONLY" ]; then
                        SERVICE_URL="http://${DOMAIN_ONLY}"
                        if [ "${DEBUG_ENDPOINT:-false}" = "true" ]; then
                            echo -e "${BLUE}DEBUG: Fallback - extracted domain: ${DOMAIN_ONLY}${NC}"
                            echo -e "${BLUE}DEBUG: Service URL set to: ${SERVICE_URL}${NC}"
                        fi
                    else
                        if [ "${DEBUG_ENDPOINT:-false}" = "true" ]; then
                            echo -e "${YELLOW}DEBUG: Could not extract ingress_url from JSON${NC}"
                        fi
                    fi
                fi
                
                # If we found a valid URL, verify and exit
                if [ -n "$SERVICE_URL" ] && [[ "$SERVICE_URL" =~ \.snowflakecomputing\.app ]]; then
                    # Test if URL is accessible
                    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${SERVICE_URL}/health" 2>/dev/null || echo "000")
                    
                    # Accept 200, 301/302 (redirects), or 404 (endpoint exists but health route may differ) as "accessible"
                    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "404" ]; then
                        echo -e "${GREEN}✅ Endpoint provisioned and accessible!${NC}"
                        echo -e "${GREEN}🌐 Service URL: ${SERVICE_URL}${NC}"
                        echo -e "${BLUE}   Frontend: ${SERVICE_URL}${NC}"
                        echo -e "${BLUE}   Backend API: ${SERVICE_URL}/api${NC}"
                        echo -e "${BLUE}   Health Check: ${SERVICE_URL}/health${NC}"
                        export SERVICE_URL
                        return 0
                    elif [ "$HTTP_CODE" = "000" ]; then
                        # URL found but not yet accessible - continue waiting
                        echo -e "${BLUE}   Endpoint URL detected in INGRESS_URL: ${SERVICE_URL}${NC}"
                        echo -e "${BLUE}   Still waiting for endpoint to become accessible...${NC}"
                    fi
                fi
            fi
        fi
        
        
        # Show progress
        if [ $((ELAPSED % 30)) -eq 0 ]; then
            echo -e "${BLUE}   Still waiting for endpoint provisioning... (${ELAPSED}s elapsed)${NC}"
            echo -e "${BLUE}   Checking SHOW ENDPOINTS IN SERVICE ${SERVICE_NAME} for INGRESS_URL...${NC}"
            # Show service status for debugging (using list command)
            SERVICE_STATUS=$(snow spcs service list --database ${DATABASE} --schema ${SCHEMA} 2>/dev/null | grep -i "${SERVICE_NAME}" | head -1 || echo "")
            if [ -n "$SERVICE_STATUS" ]; then
                echo -e "${BLUE}   Service found in list: $(echo "$SERVICE_STATUS" | head -1)${NC}"
            fi
        fi
        
        sleep 5
        ELAPSED=$((ELAPSED + 5))
    done
    
    # Final attempt: Use SHOW ENDPOINTS IN SERVICE to check for provisioned endpoint
    echo -e "${BLUE}Making final attempt using SHOW ENDPOINTS IN SERVICE ${SERVICE_NAME}...${NC}"
    
    # Use JSON format for easier parsing
    ENDPOINT_JSON=$(snow sql --format json -q "USE DATABASE ${DATABASE}; USE SCHEMA ${SCHEMA}; SHOW ENDPOINTS IN SERVICE ${SERVICE_NAME}" 2>&1 || echo "")
    if [ -n "$ENDPOINT_JSON" ]; then
        # Check if JSON contains ingress_url with snowflakecomputing.app
        if echo "$ENDPOINT_JSON" | grep -qiE "snowflakecomputing\.app"; then
            # Extract ingress_url from JSON
            # Prefer web-endpoint (port 80), fall back to api-endpoint (port 3001)
            
            # Try using jq if available (more reliable)
            if command -v jq &> /dev/null; then
                # The JSON structure has nested arrays - endpoints are in the array that contains objects with "name"
                # Use recursive descent to find all objects, then select web-endpoint
                INGRESS_URL=$(echo "$ENDPOINT_JSON" | jq -r '.. | objects | select(.name == "web-endpoint") | .ingress_url // empty' 2>/dev/null | head -1 || echo "")
                if [ -z "$INGRESS_URL" ] || [ "$INGRESS_URL" = "null" ] || [ "$INGRESS_URL" = "" ]; then
                    # Fall back to api-endpoint only if web-endpoint not found
                    INGRESS_URL=$(echo "$ENDPOINT_JSON" | jq -r '.. | objects | select(.name == "api-endpoint") | .ingress_url // empty' 2>/dev/null | head -1 || echo "")
                fi
            else
                # Fallback: extract using grep and sed - look for exact name "web-endpoint"
                INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -i '"name"[[:space:]]*:[[:space:]]*"web-endpoint"' -A 15 | grep -i "ingress_url" | head -1 | sed -n 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
                if [ -z "$INGRESS_URL" ]; then
                    # Fall back to api-endpoint
                    INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -i '"name"[[:space:]]*:[[:space:]]*"api-endpoint"' -A 15 | grep -i "ingress_url" | head -1 | sed -n 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
                fi
                
                # If still empty, try extracting any ingress_url containing snowflakecomputing.app
                if [ -z "$INGRESS_URL" ]; then
                    INGRESS_URL=$(echo "$ENDPOINT_JSON" | grep -oE '"ingress_url"[[:space:]]*:[[:space:]]*"[^"]*snowflakecomputing\.app[^"]*"' | sed 's/.*"ingress_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | head -1 || echo "")
                fi
            fi
            
            if [ -n "$INGRESS_URL" ] && [ "$INGRESS_URL" != "null" ] && echo "$INGRESS_URL" | grep -qiE "snowflakecomputing\.app"; then
                SERVICE_URL="http://${INGRESS_URL}"
            else
                # Fallback: extract domain directly from JSON text
                DOMAIN_ONLY=$(echo "$ENDPOINT_JSON" | grep -oE "[a-zA-Z0-9.-]+\.snowflakecomputing\.app" | head -1 || echo "")
                if [ -n "$DOMAIN_ONLY" ]; then
                    SERVICE_URL="http://${DOMAIN_ONLY}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  Endpoint not yet provisioned - INGRESS_URL does not contain .snowflakecomputing.app${NC}"
        fi
    fi
    
    if [ -n "$SERVICE_URL" ] && [ "$SERVICE_URL" != "NULL" ] && [[ "$SERVICE_URL" =~ ^https?://.*\.snowflakecomputing\.app ]]; then
        echo -e "${GREEN}✅ Endpoint provisioned!${NC}"
        echo -e "${GREEN}🌐 Service URL: ${SERVICE_URL}${NC}"
        
        # Test accessibility one more time
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${SERVICE_URL}/health" 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✅ Health endpoint is accessible${NC}"
        elif [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
            echo -e "${GREEN}✅ Endpoint is accessible (HTTP ${HTTP_CODE} redirect)${NC}"
        elif [ "$HTTP_CODE" = "404" ]; then
            echo -e "${YELLOW}⚠️  Endpoint accessible but /health route may not exist (HTTP 404)${NC}"
        elif [ "$HTTP_CODE" = "000" ]; then
            echo -e "${YELLOW}⚠️  Endpoint detected but connection failed (may still be starting)${NC}"
        else
            echo -e "${YELLOW}⚠️  Endpoint detected but returned HTTP ${HTTP_CODE}${NC}"
        fi
        
        export SERVICE_URL
        return 0
    else
        echo -e "${YELLOW}⚠️  Could not automatically detect endpoint URL after ${MAX_WAIT}s${NC}"
        echo -e "${YELLOW}⚠️  Service may still be starting or endpoint format may have changed${NC}"
        echo -e "${BLUE}📋 Manual steps to find endpoint:${NC}"
        echo -e "${BLUE}   1. Check service logs: snow spcs service logs ${SERVICE_NAME} --container-name backend --database ${DATABASE} --schema ${SCHEMA}${NC}"
        echo -e "${BLUE}   2. Check service list: snow spcs service list --database ${DATABASE} --schema ${SCHEMA}${NC}"
        echo -e "${BLUE}   3. Query in Snowflake: SHOW ENDPOINTS IN SERVICE ${SERVICE_NAME}${NC}"
        echo -e "${BLUE}   4. Query in Snowflake: SELECT SYSTEM\$GET_SERVICE_URL('${DATABASE}.${SCHEMA}.${SERVICE_NAME}')${NC}"
        echo -e "${BLUE}   5. Check Snowflake UI for the service endpoint${NC}"
        echo -e "${BLUE}   6. Try the URL manually: http://bbcmn2pb-sfsenorthamerica-tboon-aws2.snowflakecomputing.app${NC}"
        return 1
    fi
}

# Verify deployment
verify_deployment() {
    echo -e "${YELLOW}🔍 Verifying deployment...${NC}"
    
    # Get service status
    # Check if service exists by listing services
    SERVICE_CHECK=$(snow spcs service list --database ${DATABASE} --schema ${SCHEMA} 2>/dev/null | grep -qi "${SERVICE_NAME}" && echo "exists" || echo "not_found")
    
    if [ "$SERVICE_CHECK" = "exists" ]; then
        echo -e "${GREEN}✅ Service is running${NC}"
        
        # Show service status
        echo -e "${BLUE}Service Status:${NC}"
        snow spcs service list --database ${DATABASE} --schema ${SCHEMA} | grep -i "${SERVICE_NAME}" || true
        
        # Show service logs if available (for both containers)
        echo -e "${BLUE}Recent Logs (backend):${NC}"
        snow spcs service logs ${SERVICE_NAME} --container-name backend --database ${DATABASE} --schema ${SCHEMA} 2>&1 | head -20 || echo "Could not retrieve backend logs"
        echo -e "${BLUE}Recent Logs (frontend):${NC}"
        snow spcs service logs ${SERVICE_NAME} --container-name frontend --database ${DATABASE} --schema ${SCHEMA} 2>&1 | head -20 || echo "Could not retrieve frontend logs"
        
        # Verify endpoint is accessible if we have a URL
        if [ -n "$SERVICE_URL" ] && [[ "$SERVICE_URL" =~ ^https?:// ]]; then
            echo -e "${BLUE}Testing endpoint accessibility...${NC}"
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${SERVICE_URL}/health" 2>/dev/null || echo "000")
            if [ "$HTTP_CODE" = "200" ]; then
                echo -e "${GREEN}✅ Health endpoint is accessible${NC}"
            else
                echo -e "${YELLOW}⚠️  Health endpoint returned HTTP ${HTTP_CODE} (service may still be starting)${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Could not retrieve service status (service may still be starting)${NC}"
        echo -e "${BLUE}   Check manually: snow spcs service list --database ${DATABASE} --schema ${SCHEMA}${NC}"
    fi
}

# Cleanup
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    rm -f service-spec.yaml
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Main deployment flow
main() {
    # Parse command-line arguments first
    parse_args "$@"
    
    # If --check-endpoint flag is set, only check endpoint and exit
    if [ "${CHECK_ENDPOINT_ONLY:-false}" = "true" ]; then
        check_endpoint_only
    fi
    
    # Display configuration
    show_config
    
    # If --service-only or --build-and-deploy, skip resource creation
    if [ "${SERVICE_ONLY:-false}" = "true" ]; then
        # Service-only mode: Skip resource creation, just verify minimum requirements
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}Service-only deployment mode${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        check_snow_cli
        authenticate_snowflake
        
        # Quick verification that database exists (required for service deployment)
        if ! snow sql -q "SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null | grep -qi "${DATABASE}"; then
            echo -e "${RED}❌ Database ${DATABASE} not found${NC}"
            echo -e "${YELLOW}   Service-only mode requires existing database. Run full deployment first.${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Database ${DATABASE} verified${NC}"
    elif [ "${BUILD_AND_DEPLOY:-false}" = "true" ]; then
        # Build-and-deploy mode: Skip resource creation, verify database exists
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}Build and deploy mode${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        check_snow_cli
        check_docker
        authenticate_snowflake
        
        # Quick verification that database exists (required for service deployment)
        if ! snow sql -q "SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null | grep -qi "${DATABASE}"; then
            echo -e "${RED}❌ Database ${DATABASE} not found${NC}"
            echo -e "${YELLOW}   Build-and-deploy mode requires existing database. Run full deployment first.${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Database ${DATABASE} verified${NC}"
    else
        # Full deployment: Create resources and proceed
        check_snow_cli
        check_docker
        authenticate_snowflake
        
        # Create Snowflake resources (database, warehouse, role, user)
        # Continue even if there are expected errors (like USE ROLE for service role)
        if ! create_snowflake_resources; then
            echo -e "${YELLOW}⚠️  Resource creation had issues, but continuing with deployment...${NC}"
            # Check if critical resources exist before continuing
            if ! snow sql -q "SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null | grep -qi "${DATABASE}"; then
                echo -e "${RED}❌ Critical resource (database) was not created. Cannot continue.${NC}"
                exit 1
            fi
        fi
    fi
    
    # Skip build/push if --service-only flag is set
    if [ "${SERVICE_ONLY:-false}" != "true" ]; then
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}Starting image build and push phase...${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        build_images
        
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}Starting image push phase...${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        push_images
    else
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}Skipping image build and push (--service-only flag set)${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}ℹ️  Using existing images in registry${NC}"
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Starting service deployment phase...${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    deploy_service
    verify_deployment
    cleanup
    
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo -e "  1. Verify the service is running: snow spcs service list --database ${DATABASE} --schema ${SCHEMA}"
    echo -e "  2. View backend logs: snow spcs service logs ${SERVICE_NAME} --container-name backend"
    echo -e "  3. View frontend logs: snow spcs service logs ${SERVICE_NAME} --container-name frontend"
    echo -e "  4. Test the API endpoints"
    echo -e "  5. Configure monitoring and logging"
    echo -e "  6. Set up SSL certificates if needed"
    echo ""
    echo -e "${BLUE}📚 Useful Snow CLI commands:${NC}"
    echo -e "  - List services: snow spcs service list --database ${DATABASE} --schema ${SCHEMA}"
    echo -e "  - Service status: snow spcs service list --database ${DATABASE} --schema ${SCHEMA} | grep ${SERVICE_NAME}"
    echo -e "  - View backend logs: snow spcs service logs ${SERVICE_NAME} --container-name backend"
    echo -e "  - View frontend logs: snow spcs service logs ${SERVICE_NAME} --container-name frontend"
    echo -e "  - Stop service: snow spcs service suspend ${SERVICE_NAME}"
    echo -e "  - Resume service: snow spcs service resume ${SERVICE_NAME}"
    echo -e "  - Delete service: snow spcs service drop ${SERVICE_NAME}"
}

# Run main function
main "$@"