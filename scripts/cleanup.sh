#!/bin/bash

# =====================================================
# Snowflake API Proxy Service - Cleanup Script
# =====================================================
# This script removes all resources created by deploy.sh:
# - Service
# - Compute pool
# - Database, schema, warehouse
# - Service user and role
# - Tables and views
#
# Usage:
#   ./scripts/cleanup.sh                    # Interactive (asks for confirmation)
#   ./scripts/cleanup.sh --yes              # Non-interactive (auto-confirms)
#   ./scripts/cleanup.sh --database MY_DB   # Custom database name
# =====================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default Configuration (matches deploy.sh)
SERVICE_NAME="SNOWFLAKE_API_PROXY"
DEFAULT_COMPUTE_POOL="API_PROXY_POOL"
DEFAULT_DATABASE="API_PROXY"
DEFAULT_SCHEMA="APP"
DEFAULT_WAREHOUSE="API_PROXY_WH"
SERVICE_ROLE_NAME="API_PROXY_SERVICE_ROLE"
SERVICE_USER_NAME="API_PROXY_SERVICE_MANAGER"

# Initialize variables with defaults
COMPUTE_POOL="$DEFAULT_COMPUTE_POOL"
DATABASE="$DEFAULT_DATABASE"
SCHEMA="$DEFAULT_SCHEMA"
WAREHOUSE="$DEFAULT_WAREHOUSE"
AUTO_CONFIRM=false
DATABASE_ONLY=false
SKIP_SERVICE=false
SKIP_COMPUTE_POOL=false
SKIP_WAREHOUSE=false
SKIP_USER=false
SKIP_ROLE=false

# Parse command-line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
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
            --compute-pool|-c)
                COMPUTE_POOL="$2"
                shift 2
                ;;
            --service|-n)
                SERVICE_NAME="$2"
                shift 2
                ;;
            --yes|-y)
                AUTO_CONFIRM=true
                shift
                ;;
            --database-only|--db-only)
                DATABASE_ONLY=true
                shift
                ;;
            --skip-service|--no-service)
                SKIP_SERVICE=true
                shift
                ;;
            --skip-compute-pool|--no-compute-pool)
                SKIP_COMPUTE_POOL=true
                shift
                ;;
            --skip-warehouse|--no-warehouse)
                SKIP_WAREHOUSE=true
                shift
                ;;
            --skip-user|--no-user)
                SKIP_USER=true
                shift
                ;;
            --skip-role|--no-role)
                SKIP_ROLE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
${BLUE}Snowflake API Proxy Service - Cleanup Script${NC}

Usage: $0 [OPTIONS]

Options:
  -d, --database NAME         Database name (default: ${DEFAULT_DATABASE})
  -s, --schema NAME           Schema name (default: ${DEFAULT_SCHEMA})
  -w, --warehouse NAME        Warehouse name (default: ${DEFAULT_WAREHOUSE})
  -c, --compute-pool NAME     Compute pool name (default: ${DEFAULT_COMPUTE_POOL})
  -n, --service NAME          Service name (default: ${SERVICE_NAME})
  -y, --yes                   Auto-confirm (non-interactive mode)
      --database-only          Only clean up database (skip service, compute pool, user, role)
      --skip-service           Skip service cleanup
      --skip-compute-pool      Skip compute pool cleanup
      --skip-warehouse         Skip warehouse cleanup
      --skip-user              Skip user cleanup
      --skip-role              Skip role cleanup
  -h, --help                  Show this help message

Environment Variables:
  SNOWFLAKE_DATABASE          Database name
  SNOWFLAKE_SCHEMA            Schema name
  SNOWFLAKE_WAREHOUSE         Warehouse name
  SNOWFLAKE_COMPUTE_POOL      Compute pool name

Note: This script uses your default Snow CLI role. Ensure your default role has sufficient permissions to drop all resources.

This script removes:
  - Service: ${SERVICE_NAME}
  - Compute Pool: ${COMPUTE_POOL}
  - Database: ${DATABASE}
  - Schema: ${DATABASE}.${SCHEMA}
  - Warehouse: ${WAREHOUSE}
  - User: ${SERVICE_USER_NAME}
  - Role: ${SERVICE_ROLE_NAME}
  - All tables and views in the schema

${YELLOW}WARNING: This operation is irreversible!${NC}
EOF
}

# This script uses the default role from Snow CLI configuration
# No explicit role switching is performed - ensure your default role has sufficient permissions

# Confirm before proceeding
confirm_cleanup() {
    if [ "$AUTO_CONFIRM" = true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  WARNING: This will permanently delete the following resources:${NC}"
    
    if [ "$DATABASE_ONLY" = true ]; then
        echo -e "${RED}   Database: ${DATABASE} (and ALL schemas, tables, views, procedures, etc.)${NC}"
        echo -e "${BLUE}   (Skipping: Service, Compute Pool, Warehouse, User, Role)${NC}"
    else
        [ "$SKIP_SERVICE" != "true" ] && echo -e "${RED}   Service: ${SERVICE_NAME}${NC}"
        [ "$SKIP_COMPUTE_POOL" != "true" ] && echo -e "${RED}   Compute Pool: ${COMPUTE_POOL}${NC}"
        echo -e "${RED}   Database: ${DATABASE} (and ALL schemas, tables, views, procedures, etc.)${NC}"
        echo -e "${RED}   Schema: ${DATABASE}.${SCHEMA}${NC}"
        [ "$SKIP_WAREHOUSE" != "true" ] && echo -e "${RED}   Warehouse: ${WAREHOUSE}${NC}"
        [ "$SKIP_USER" != "true" ] && echo -e "${RED}   Service User: ${SERVICE_USER_NAME}${NC}"
        [ "$SKIP_ROLE" != "true" ] && echo -e "${RED}   Service Role: ${SERVICE_ROLE_NAME}${NC}"
        echo -e "${RED}   All tables, views, stored procedures, and other objects${NC}"
    fi
    
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " response
    
    case "$response" in
        yes|YES|y|Y)
            return 0
            ;;
        *)
            echo -e "${BLUE}Cleanup cancelled.${NC}"
            exit 0
            ;;
    esac
}

# Check Snowflake connection
check_connection() {
    echo -e "${BLUE}Checking Snowflake connection...${NC}"
    if ! snow connection test 2>/dev/null; then
        echo -e "${RED}❌ Failed to authenticate with Snowflake${NC}"
        echo -e "${YELLOW}Please check your credentials and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Successfully authenticated with Snowflake${NC}"
}

# Drop service
drop_service() {
    echo -e "${BLUE}Checking for service: ${SERVICE_NAME}...${NC}"
    
    # Check if service exists
    SERVICE_EXISTS=false
    if snow spcs service list 2>/dev/null | grep -qi "${SERVICE_NAME}"; then
        SERVICE_EXISTS=true
    fi
    
    if [ "$SERVICE_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping service: ${SERVICE_NAME}...${NC}"
        if snow spcs service drop ${SERVICE_NAME} 2>&1; then
            echo -e "${GREEN}✅ Service ${SERVICE_NAME} dropped${NC}"
        else
            echo -e "${YELLOW}⚠️  Failed to drop service (may not exist or already deleted)${NC}"
        fi
    else
        echo -e "${BLUE}Service ${SERVICE_NAME} does not exist${NC}"
    fi
}

# Drop compute pool
drop_compute_pool() {
    echo -e "${BLUE}Checking for compute pool: ${COMPUTE_POOL}...${NC}"
    
    # Check if compute pool exists
    POOL_EXISTS=false
    if snow spcs compute-pool list 2>/dev/null | grep -qi "${COMPUTE_POOL}"; then
        POOL_EXISTS=true
    fi
    
    if [ "$POOL_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping compute pool: ${COMPUTE_POOL}...${NC}"
        if snow spcs compute-pool drop ${COMPUTE_POOL} 2>&1; then
            echo -e "${GREEN}✅ Compute pool ${COMPUTE_POOL} dropped${NC}"
        else
            echo -e "${YELLOW}⚠️  Failed to drop compute pool (may be in use or already deleted)${NC}"
        fi
    else
        echo -e "${BLUE}Compute pool ${COMPUTE_POOL} does not exist${NC}"
    fi
}

# Drop database and all contained objects
drop_database() {
    echo -e "${BLUE}Checking for database: ${DATABASE}...${NC}"
    
    # Check if database exists (using default role)
    # Try to USE the database - if it succeeds, the database exists
    DB_EXISTS=false
    USE_OUTPUT=$(snow sql -q "USE DATABASE ${DATABASE}" 2>&1)
    USE_EXIT=$?
    
    if [ $USE_EXIT -eq 0 ]; then
        # Database exists and we can use it
        DB_EXISTS=true
    else
        # Check if the error is because database doesn't exist
        if echo "$USE_OUTPUT" | grep -qiE "does not exist|not found|Unknown database"; then
            DB_EXISTS=false
        else
            # Some other error occurred, but database might still exist
            # Try SHOW DATABASES as fallback
            DB_CHECK=$(snow sql -q "SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null || echo "")
            # Check if output contains "0 rows" which means database doesn't exist
            if echo "$DB_CHECK" | grep -qiE "0 rows|not found"; then
                DB_EXISTS=false
            elif echo "$DB_CHECK" | grep -qi "${DATABASE}"; then
                # Database name found - verify it's not in a "does not exist" message
                if ! echo "$DB_CHECK" | grep -qiE "does not exist|not found"; then
                    DB_EXISTS=true
                fi
            fi
        fi
    fi
    
    if [ "$DB_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping database: ${DATABASE} (this will cascade to all schemas, tables, views, procedures, etc.)...${NC}"
        
        # Drop database with CASCADE to remove all contained objects
        DROP_OUTPUT=$(snow sql -q "DROP DATABASE IF EXISTS ${DATABASE}" 2>&1)
        DROP_EXIT=$?
        
        if [ $DROP_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ Database ${DATABASE} dropped successfully${NC}"
        else
            # Check if it's because database doesn't exist
            if echo "$DROP_OUTPUT" | grep -qiE "does not exist|not found"; then
                echo -e "${BLUE}Database ${DATABASE} does not exist${NC}"
            else
                echo -e "${RED}❌ Failed to drop database:${NC}"
                echo "$DROP_OUTPUT" | head -5
                echo -e "${YELLOW}⚠️  Ensure your default role has permissions to drop the database.${NC}"
            fi
        fi
        
        # Verify database is gone
        sleep 1
        VERIFY_CHECK=$(snow sql -q "SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null || echo "")
        if echo "$VERIFY_CHECK" | grep -qiE "0 rows|not found"; then
            echo -e "${GREEN}✅ Database ${DATABASE} verified as dropped${NC}"
        elif echo "$VERIFY_CHECK" | grep -qi "${DATABASE}"; then
            echo -e "${YELLOW}⚠️  Database ${DATABASE} still exists.${NC}"
        fi
    else
        echo -e "${BLUE}Database ${DATABASE} does not exist${NC}"
    fi
}

# Drop warehouse
drop_warehouse() {
    echo -e "${BLUE}Checking for warehouse: ${WAREHOUSE}...${NC}"
    
    # Check if warehouse exists (using default role)
    WH_EXISTS=false
    if snow sql -q "SHOW WAREHOUSES LIKE '${WAREHOUSE}'" 2>/dev/null | grep -qi "${WAREHOUSE}"; then
        WH_EXISTS=true
    fi
    
    if [ "$WH_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping warehouse: ${WAREHOUSE}...${NC}"
        if snow sql -q "DROP WAREHOUSE IF EXISTS ${WAREHOUSE}" 2>&1; then
            echo -e "${GREEN}✅ Warehouse ${WAREHOUSE} dropped${NC}"
        else
            echo -e "${YELLOW}⚠️  Failed to drop warehouse (may not exist or be in use)${NC}"
        fi
    else
        echo -e "${BLUE}Warehouse ${WAREHOUSE} does not exist${NC}"
    fi
}

# Drop user
drop_user() {
    echo -e "${BLUE}Checking for user: ${SERVICE_USER_NAME}...${NC}"
    
    # Check if user exists (using default role)
    USER_EXISTS=false
    USER_CHECK=$(snow sql -q "SHOW USERS LIKE '${SERVICE_USER_NAME}'" 2>/dev/null || echo "")
    if echo "$USER_CHECK" | grep -qi "${SERVICE_USER_NAME}"; then
        USER_EXISTS=true
    fi
    
    if [ "$USER_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping user: ${SERVICE_USER_NAME}...${NC}"
        echo -e "${BLUE}   Note: Dropping user will automatically remove all role assignments${NC}"
        
        # Drop user (this automatically removes all role grants from the user)
        DROP_OUTPUT=$(snow sql -q "DROP USER IF EXISTS ${SERVICE_USER_NAME}" 2>&1)
        DROP_EXIT=$?
        
        if [ $DROP_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ User ${SERVICE_USER_NAME} dropped successfully${NC}"
        else
            # Check if it's because user doesn't exist
            if echo "$DROP_OUTPUT" | grep -qiE "does not exist|not found"; then
                echo -e "${BLUE}User ${SERVICE_USER_NAME} does not exist${NC}"
            else
                echo -e "${RED}❌ Failed to drop user:${NC}"
                echo "$DROP_OUTPUT" | head -5
                echo -e "${YELLOW}⚠️  Ensure your default role has permissions to drop users.${NC}"
            fi
        fi
        
        # Verify user is gone
        sleep 1
        VERIFY_CHECK=$(snow sql -q "SHOW USERS LIKE '${SERVICE_USER_NAME}'" 2>/dev/null || echo "")
        if echo "$VERIFY_CHECK" | grep -qi "${SERVICE_USER_NAME}"; then
            echo -e "${YELLOW}⚠️  User ${SERVICE_USER_NAME} still exists.${NC}"
        fi
    else
        echo -e "${BLUE}User ${SERVICE_USER_NAME} does not exist${NC}"
    fi
}

# Drop role
drop_role() {
    echo -e "${BLUE}Checking for role: ${SERVICE_ROLE_NAME}...${NC}"
    
    # Check if role exists (using default role)
    ROLE_EXISTS=false
    ROLE_CHECK=$(snow sql -q "SHOW ROLES LIKE '${SERVICE_ROLE_NAME}'" 2>/dev/null || echo "")
    if echo "$ROLE_CHECK" | grep -qi "${SERVICE_ROLE_NAME}"; then
        ROLE_EXISTS=true
    fi
    
    if [ "$ROLE_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping role: ${SERVICE_ROLE_NAME}...${NC}"
        echo -e "${BLUE}   Note: User ${SERVICE_USER_NAME} already dropped, so role assignments are removed${NC}"
        
        # Drop the role directly (user is already dropped, so no role assignments remain)
        # If database was dropped, object privileges are already gone
        DROP_OUTPUT=$(snow sql -q "DROP ROLE IF EXISTS ${SERVICE_ROLE_NAME}" 2>&1)
        DROP_EXIT=$?
        
        if [ $DROP_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ Role ${SERVICE_ROLE_NAME} dropped successfully${NC}"
        else
            # Check if it's because role doesn't exist
            if echo "$DROP_OUTPUT" | grep -qiE "does not exist|not found"; then
                echo -e "${BLUE}Role ${SERVICE_ROLE_NAME} does not exist${NC}"
            else
                echo -e "${RED}❌ Failed to drop role:${NC}"
                echo "$DROP_OUTPUT" | head -5
                echo -e "${YELLOW}⚠️  Ensure your default role has permissions to drop roles.${NC}"
            fi
        fi
        
        # Verify role is gone
        sleep 1
        VERIFY_CHECK=$(snow sql -q "SHOW ROLES LIKE '${SERVICE_ROLE_NAME}'" 2>/dev/null || echo "")
        if echo "$VERIFY_CHECK" | grep -qi "${SERVICE_ROLE_NAME}"; then
            echo -e "${YELLOW}⚠️  Role ${SERVICE_ROLE_NAME} still exists.${NC}"
        fi
    else
        echo -e "${BLUE}Role ${SERVICE_ROLE_NAME} does not exist${NC}"
    fi
}

# Main cleanup function
main() {
    # Override with environment variables if set
    DATABASE=${SNOWFLAKE_DATABASE:-$DATABASE}
    SCHEMA=${SNOWFLAKE_SCHEMA:-$SCHEMA}
    WAREHOUSE=${SNOWFLAKE_WAREHOUSE:-$WAREHOUSE}
    COMPUTE_POOL=${SNOWFLAKE_COMPUTE_POOL:-$COMPUTE_POOL}
    
    # Parse command-line arguments
    parse_args "$@"
    
    echo -e "${YELLOW}=====================================================${NC}"
    echo -e "${YELLOW}Snowflake API Proxy Service - Cleanup${NC}"
    echo -e "${YELLOW}=====================================================${NC}"
    echo ""
    
    # Confirm before proceeding
    confirm_cleanup
    
    # Check connection
    check_connection
    
    # Get current role to inform user
    CURRENT_ROLE=$(snow sql -q "SELECT CURRENT_ROLE()" 2>/dev/null | grep -v "current_role()" | grep -v "^-" | head -1 | xargs || echo "unknown")
    echo -e "${BLUE}Using default role: ${CURRENT_ROLE}${NC}"
    echo -e "${BLUE}Ensure this role has permissions to drop all resources.${NC}"
    echo ""
    
    # Drop resources in reverse order of creation
    echo -e "${YELLOW}Starting cleanup...${NC}"
    echo ""
    
    if [ "$DATABASE_ONLY" = true ]; then
        # Only drop database
        echo -e "${BLUE}Database-only mode: Only cleaning up database${NC}"
        drop_database
        echo ""
    else
        # Drop all resources (respecting skip flags)
        # 1. Drop service (must be done before compute pool if using it)
        if [ "$SKIP_SERVICE" != "true" ]; then
            drop_service
            echo ""
        fi
        
        # 2. Drop compute pool
        if [ "$SKIP_COMPUTE_POOL" != "true" ]; then
            drop_compute_pool
            echo ""
        fi
        
        # 3. Drop database (cascades to schema, tables, views, procedures, etc.)
        # This is critical - dropping the database removes ALL data
        drop_database
        echo ""
        
        # 4. Drop warehouse
        if [ "$SKIP_WAREHOUSE" != "true" ]; then
            drop_warehouse
            echo ""
        fi
        
        # 5. Drop service user (created by setup_service_account.sql)
        # This must be done to fully clean up the deployment
        if [ "$SKIP_USER" != "true" ]; then
            drop_user
            echo ""
        fi
        
        # 6. Drop service role (created by setup_service_account.sql)
        if [ "$SKIP_ROLE" != "true" ]; then
            drop_role
            echo ""
        fi
    fi
    
    # Final verification (using default role)
    echo -e "${BLUE}Verifying cleanup...${NC}"
    
    # Always check database (it's always cleaned up)
    DB_STILL_EXISTS=$(snow sql -q "SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null | grep -qi "${DATABASE}" && echo "yes" || echo "no")
    if [ "$DB_STILL_EXISTS" = "yes" ]; then
        echo -e "${YELLOW}⚠️  Database ${DATABASE} still exists. Manual cleanup may be required.${NC}"
    fi
    
    # Only check user/role if they weren't skipped
    if [ "$DATABASE_ONLY" != "true" ] && [ "$SKIP_USER" != "true" ]; then
        USER_STILL_EXISTS=$(snow sql -q "SHOW USERS LIKE '${SERVICE_USER_NAME}'" 2>/dev/null | grep -qi "${SERVICE_USER_NAME}" && echo "yes" || echo "no")
        if [ "$USER_STILL_EXISTS" = "yes" ]; then
            echo -e "${YELLOW}⚠️  User ${SERVICE_USER_NAME} still exists. Manual cleanup may be required.${NC}"
        fi
    fi
    
    if [ "$DATABASE_ONLY" != "true" ] && [ "$SKIP_ROLE" != "true" ]; then
        ROLE_STILL_EXISTS=$(snow sql -q "SHOW ROLES LIKE '${SERVICE_ROLE_NAME}'" 2>/dev/null | grep -qi "${SERVICE_ROLE_NAME}" && echo "yes" || echo "no")
        if [ "$ROLE_STILL_EXISTS" = "yes" ]; then
            echo -e "${YELLOW}⚠️  Role ${SERVICE_ROLE_NAME} still exists. Manual cleanup may be required.${NC}"
            echo -e "${BLUE}   You may need to switch to a role with sufficient permissions and run:${NC}"
            echo -e "${BLUE}   DROP ROLE ${SERVICE_ROLE_NAME};${NC}"
        fi
    fi
    
    # Summary message
    if [ "$DATABASE_ONLY" = true ]; then
        if [ "$DB_STILL_EXISTS" = "no" ]; then
            echo -e "${GREEN}✅ Database successfully removed${NC}"
        fi
    else
        VERIFIED_COUNT=0
        [ "$DB_STILL_EXISTS" = "no" ] && VERIFIED_COUNT=$((VERIFIED_COUNT + 1))
        if [ "$SKIP_USER" != "true" ]; then
            [ "$USER_STILL_EXISTS" = "no" ] && VERIFIED_COUNT=$((VERIFIED_COUNT + 1))
        fi
        if [ "$SKIP_ROLE" != "true" ]; then
            [ "$ROLE_STILL_EXISTS" = "no" ] && VERIFIED_COUNT=$((VERIFIED_COUNT + 1))
        fi
        if [ $VERIFIED_COUNT -gt 0 ]; then
            echo -e "${GREEN}✅ Cleanup verified for ${VERIFIED_COUNT} resource(s)${NC}"
        fi
    fi
    echo ""
    
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "${GREEN}Cleanup completed!${NC}"
    echo -e "${GREEN}=====================================================${NC}"
    echo ""
    echo -e "${BLUE}Note: Some resources may have already been deleted or may have dependencies.${NC}"
    echo -e "${BLUE}If any resources still exist, you may need to drop them manually.${NC}"
}

# Run main function
main "$@"

