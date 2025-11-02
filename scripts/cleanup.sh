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
SERVICE_USER_NAME="API_PROXY_SERVICE_USER"

# Initialize variables with defaults
COMPUTE_POOL="$DEFAULT_COMPUTE_POOL"
DATABASE="$DEFAULT_DATABASE"
SCHEMA="$DEFAULT_SCHEMA"
WAREHOUSE="$DEFAULT_WAREHOUSE"
AUTO_CONFIRM=false
ROLE_MODE=${SNOWFLAKE_ROLE_MODE:-"AUTO"}

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
            --role-mode|-r)
                ROLE_MODE="$2"
                shift 2
                ;;
            --yes|-y)
                AUTO_CONFIRM=true
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
  -r, --role-mode MODE        Role mode: ACCOUNTADMIN, SYSADMIN, USERADMIN, or AUTO (default: AUTO)
  -y, --yes                   Auto-confirm (non-interactive mode)
  -h, --help                  Show this help message

Environment Variables:
  SNOWFLAKE_DATABASE          Database name
  SNOWFLAKE_SCHEMA            Schema name
  SNOWFLAKE_WAREHOUSE         Warehouse name
  SNOWFLAKE_COMPUTE_POOL      Compute pool name
  SNOWFLAKE_ROLE_MODE         Role mode

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

# Determine which role to use for a given operation
get_role_for_operation() {
    local operation=$1  # "OBJECT", "USER_ROLE", or "GRANT"
    
    case "$ROLE_MODE" in
        ACCOUNTADMIN)
            echo "ACCOUNTADMIN"
            ;;
        SYSADMIN)
            if [ "$operation" = "USER_ROLE" ]; then
                echo "USERADMIN"
            else
                echo "SYSADMIN"
            fi
            ;;
        USERADMIN)
            if [ "$operation" = "OBJECT" ]; then
                echo "SYSADMIN"
            else
                echo "USERADMIN"
            fi
            ;;
        AUTO|*)
            if [ "$operation" = "USER_ROLE" ]; then
                echo "USERADMIN"
            elif [ "$operation" = "GRANT" ]; then
                echo "SYSADMIN"
            else
                echo "SYSADMIN"
            fi
            ;;
    esac
}

# Confirm before proceeding
confirm_cleanup() {
    if [ "$AUTO_CONFIRM" = true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  WARNING: This will permanently delete the following resources:${NC}"
    echo -e "${RED}   Service: ${SERVICE_NAME}${NC}"
    echo -e "${RED}   Compute Pool: ${COMPUTE_POOL}${NC}"
    echo -e "${RED}   Database: ${DATABASE} (and ALL schemas, tables, views, procedures, etc.)${NC}"
    echo -e "${RED}   Schema: ${DATABASE}.${SCHEMA}${NC}"
    echo -e "${RED}   Warehouse: ${WAREHOUSE}${NC}"
    echo -e "${RED}   Service User: ${SERVICE_USER_NAME}${NC}"
    echo -e "${RED}   Service Role: ${SERVICE_ROLE_NAME}${NC}"
    echo -e "${RED}   All tables, views, stored procedures, and other objects${NC}"
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
    
    # Determine role for dropping database (needs SYSADMIN or ACCOUNTADMIN)
    OBJECT_ROLE=$(get_role_for_operation "OBJECT")
    
    # Check if database exists
    DB_EXISTS=false
    DB_CHECK=$(snow sql -q "USE ROLE ${OBJECT_ROLE}; SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null || echo "")
    if echo "$DB_CHECK" | grep -qi "${DATABASE}"; then
        DB_EXISTS=true
    fi
    
    if [ "$DB_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping database: ${DATABASE} (this will cascade to all schemas, tables, views, procedures, etc.)...${NC}"
        
        # Drop database with CASCADE to remove all contained objects
        DROP_OUTPUT=$(snow sql -q "USE ROLE ${OBJECT_ROLE}; DROP DATABASE IF EXISTS ${DATABASE}" 2>&1)
        DROP_EXIT=$?
        
        if [ $DROP_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ Database ${DATABASE} dropped successfully${NC}"
        else
            # Check if it's because database doesn't exist
            if echo "$DROP_OUTPUT" | grep -qiE "does not exist|not found"; then
                echo -e "${BLUE}Database ${DATABASE} does not exist${NC}"
            else
                echo -e "${YELLOW}⚠️  Warning during database drop:${NC}"
                echo "$DROP_OUTPUT" | head -5
                echo -e "${BLUE}Trying again with ACCOUNTADMIN role...${NC}"
                # Try with ACCOUNTADMIN as fallback
                if snow sql -q "USE ROLE ACCOUNTADMIN; DROP DATABASE IF EXISTS ${DATABASE} CASCADE" 2>&1 | grep -qiE "successfully|dropped|does not exist"; then
                    echo -e "${GREEN}✅ Database ${DATABASE} dropped with ACCOUNTADMIN${NC}"
                else
                    echo -e "${RED}❌ Failed to drop database. Manual cleanup may be required.${NC}"
                fi
            fi
        fi
        
        # Verify database is gone
        sleep 1
        VERIFY_CHECK=$(snow sql -q "USE ROLE ${OBJECT_ROLE}; SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null || echo "")
        if echo "$VERIFY_CHECK" | grep -qi "${DATABASE}"; then
            echo -e "${YELLOW}⚠️  Database ${DATABASE} still exists. Retrying drop...${NC}"
            snow sql -q "USE ROLE ACCOUNTADMIN; DROP DATABASE IF EXISTS ${DATABASE} CASCADE" 2>&1 || true
        fi
    else
        echo -e "${BLUE}Database ${DATABASE} does not exist${NC}"
    fi
}

# Drop warehouse
drop_warehouse() {
    echo -e "${BLUE}Checking for warehouse: ${WAREHOUSE}...${NC}"
    
    # Determine role for dropping warehouse
    OBJECT_ROLE=$(get_role_for_operation "OBJECT")
    
    # Check if warehouse exists
    WH_EXISTS=false
    if snow sql -q "SHOW WAREHOUSES LIKE '${WAREHOUSE}'" 2>/dev/null | grep -qi "${WAREHOUSE}"; then
        WH_EXISTS=true
    fi
    
    if [ "$WH_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping warehouse: ${WAREHOUSE}...${NC}"
        if snow sql -q "USE ROLE ${OBJECT_ROLE}; DROP WAREHOUSE IF EXISTS ${WAREHOUSE}" 2>&1; then
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
    
    # Determine role for dropping user (needs USERADMIN or ACCOUNTADMIN)
    USER_ROLE=$(get_role_for_operation "USER_ROLE")
    
    # Check if user exists
    USER_EXISTS=false
    USER_CHECK=$(snow sql -q "USE ROLE ${USER_ROLE}; SHOW USERS LIKE '${SERVICE_USER_NAME}'" 2>/dev/null || echo "")
    if echo "$USER_CHECK" | grep -qi "${SERVICE_USER_NAME}"; then
        USER_EXISTS=true
    fi
    
    if [ "$USER_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping user: ${SERVICE_USER_NAME}...${NC}"
        
        # First, revoke all roles from the user to avoid dependency issues
        echo -e "${BLUE}   Revoking roles from user...${NC}"
        snow sql -q "USE ROLE ${USER_ROLE}; REVOKE ROLE ${SERVICE_ROLE_NAME} FROM USER ${SERVICE_USER_NAME}" 2>/dev/null || true
        
        # Drop user
        DROP_OUTPUT=$(snow sql -q "USE ROLE ${USER_ROLE}; DROP USER IF EXISTS ${SERVICE_USER_NAME}" 2>&1)
        DROP_EXIT=$?
        
        if [ $DROP_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ User ${SERVICE_USER_NAME} dropped successfully${NC}"
        else
            # Check if it's because user doesn't exist
            if echo "$DROP_OUTPUT" | grep -qiE "does not exist|not found"; then
                echo -e "${BLUE}User ${SERVICE_USER_NAME} does not exist${NC}"
            else
                echo -e "${YELLOW}⚠️  Warning during user drop:${NC}"
                echo "$DROP_OUTPUT" | head -5
                echo -e "${BLUE}Trying again with ACCOUNTADMIN role...${NC}"
                # Try with ACCOUNTADMIN as fallback
                if snow sql -q "USE ROLE ACCOUNTADMIN; DROP USER IF EXISTS ${SERVICE_USER_NAME}" 2>&1 | grep -qiE "successfully|dropped|does not exist"; then
                    echo -e "${GREEN}✅ User ${SERVICE_USER_NAME} dropped with ACCOUNTADMIN${NC}"
                else
                    echo -e "${RED}❌ Failed to drop user. Manual cleanup may be required.${NC}"
                fi
            fi
        fi
        
        # Verify user is gone
        sleep 1
        VERIFY_CHECK=$(snow sql -q "USE ROLE ${USER_ROLE}; SHOW USERS LIKE '${SERVICE_USER_NAME}'" 2>/dev/null || echo "")
        if echo "$VERIFY_CHECK" | grep -qi "${SERVICE_USER_NAME}"; then
            echo -e "${YELLOW}⚠️  User ${SERVICE_USER_NAME} still exists. Retrying drop...${NC}"
            snow sql -q "USE ROLE ACCOUNTADMIN; DROP USER IF EXISTS ${SERVICE_USER_NAME}" 2>&1 || true
        fi
    else
        echo -e "${BLUE}User ${SERVICE_USER_NAME} does not exist${NC}"
    fi
}

# Drop role
drop_role() {
    echo -e "${BLUE}Checking for role: ${SERVICE_ROLE_NAME}...${NC}"
    
    # Determine role for dropping role (needs USERADMIN or ACCOUNTADMIN)
    USER_ROLE=$(get_role_for_operation "USER_ROLE")
    
    # Check if role exists
    ROLE_EXISTS=false
    ROLE_CHECK=$(snow sql -q "USE ROLE ${USER_ROLE}; SHOW ROLES LIKE '${SERVICE_ROLE_NAME}'" 2>/dev/null || echo "")
    if echo "$ROLE_CHECK" | grep -qi "${SERVICE_ROLE_NAME}"; then
        ROLE_EXISTS=true
    fi
    
    if [ "$ROLE_EXISTS" = true ]; then
        echo -e "${YELLOW}Dropping role: ${SERVICE_ROLE_NAME}...${NC}"
        
        # First, revoke the role from any users
        echo -e "${BLUE}   Revoking role from users...${NC}"
        snow sql -q "USE ROLE ${USER_ROLE}; REVOKE ROLE ${SERVICE_ROLE_NAME} FROM USER ${SERVICE_USER_NAME}" 2>/dev/null || true
        
        # Revoke all privileges granted to this role
        # Note: We need to revoke grants on objects before we can drop the role
        echo -e "${BLUE}   Revoking grants from role...${NC}"
        
        # Revoke usage on warehouse
        snow sql -q "USE ROLE ACCOUNTADMIN; REVOKE USAGE ON WAREHOUSE ${WAREHOUSE} FROM ROLE ${SERVICE_ROLE_NAME}" 2>/dev/null || true
        
        # Revoke usage on database
        snow sql -q "USE ROLE ACCOUNTADMIN; REVOKE USAGE ON DATABASE ${DATABASE} FROM ROLE ${SERVICE_ROLE_NAME}" 2>/dev/null || true
        
        # Revoke usage on schema (if database still exists)
        snow sql -q "USE ROLE ACCOUNTADMIN; REVOKE USAGE ON SCHEMA ${DATABASE}.${SCHEMA} FROM ROLE ${SERVICE_ROLE_NAME}" 2>/dev/null || true
        
        # Revoke all privileges on all objects in schema (if database still exists)
        snow sql -q "USE ROLE ACCOUNTADMIN; REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${DATABASE}.${SCHEMA} FROM ROLE ${SERVICE_ROLE_NAME}" 2>/dev/null || true
        snow sql -q "USE ROLE ACCOUNTADMIN; REVOKE ALL PRIVILEGES ON ALL VIEWS IN SCHEMA ${DATABASE}.${SCHEMA} FROM ROLE ${SERVICE_ROLE_NAME}" 2>/dev/null || true
        snow sql -q "USE ROLE ACCOUNTADMIN; REVOKE ALL PRIVILEGES ON ALL PROCEDURES IN SCHEMA ${DATABASE}.${SCHEMA} FROM ROLE ${SERVICE_ROLE_NAME}" 2>/dev/null || true
        
        # Drop the role
        DROP_OUTPUT=$(snow sql -q "USE ROLE ${USER_ROLE}; DROP ROLE IF EXISTS ${SERVICE_ROLE_NAME}" 2>&1)
        DROP_EXIT=$?
        
        if [ $DROP_EXIT -eq 0 ]; then
            echo -e "${GREEN}✅ Role ${SERVICE_ROLE_NAME} dropped successfully${NC}"
        else
            # Check if it's because role doesn't exist
            if echo "$DROP_OUTPUT" | grep -qiE "does not exist|not found"; then
                echo -e "${BLUE}Role ${SERVICE_ROLE_NAME} does not exist${NC}"
            else
                echo -e "${YELLOW}⚠️  Warning during role drop:${NC}"
                echo "$DROP_OUTPUT" | head -5
                echo -e "${BLUE}Trying again with ACCOUNTADMIN role...${NC}"
                # Try with ACCOUNTADMIN as fallback
                if snow sql -q "USE ROLE ACCOUNTADMIN; DROP ROLE IF EXISTS ${SERVICE_ROLE_NAME}" 2>&1 | grep -qiE "successfully|dropped|does not exist"; then
                    echo -e "${GREEN}✅ Role ${SERVICE_ROLE_NAME} dropped with ACCOUNTADMIN${NC}"
                else
                    echo -e "${RED}❌ Failed to drop role. Manual cleanup may be required.${NC}"
                    echo -e "${BLUE}   You may need to manually revoke all grants and drop the role:${NC}"
                    echo -e "${BLUE}   USE ROLE ACCOUNTADMIN; DROP ROLE ${SERVICE_ROLE_NAME};${NC}"
                fi
            fi
        fi
        
        # Verify role is gone
        sleep 1
        VERIFY_CHECK=$(snow sql -q "USE ROLE ${USER_ROLE}; SHOW ROLES LIKE '${SERVICE_ROLE_NAME}'" 2>/dev/null || echo "")
        if echo "$VERIFY_CHECK" | grep -qi "${SERVICE_ROLE_NAME}"; then
            echo -e "${YELLOW}⚠️  Role ${SERVICE_ROLE_NAME} still exists. Retrying drop...${NC}"
            # Final attempt with ACCOUNTADMIN
            snow sql -q "USE ROLE ACCOUNTADMIN; DROP ROLE IF EXISTS ${SERVICE_ROLE_NAME}" 2>&1 || true
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
    ROLE_MODE=${SNOWFLAKE_ROLE_MODE:-$ROLE_MODE}
    
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
    
    # Determine roles
    OBJECT_ROLE=$(get_role_for_operation "OBJECT")
    USER_ROLE=$(get_role_for_operation "USER_ROLE")
    echo -e "${BLUE}Using roles: ${OBJECT_ROLE} for objects, ${USER_ROLE} for users/roles${NC}"
    echo ""
    
    # Drop resources in reverse order of creation
    echo -e "${YELLOW}Starting cleanup...${NC}"
    echo ""
    
    # 1. Drop service (must be done before compute pool if using it)
    drop_service
    echo ""
    
    # 2. Drop compute pool
    drop_compute_pool
    echo ""
    
    # 3. Drop database (cascades to schema, tables, views, procedures, etc.)
    # This is critical - dropping the database removes ALL data
    drop_database
    echo ""
    
    # 4. Drop warehouse
    drop_warehouse
    echo ""
    
    # 5. Drop service user (created by setup_service_account.sql)
    # This must be done to fully clean up the deployment
    drop_user
    echo ""
    
    # 6. Drop service role (created by setup_service_account.sql)
    drop_role
    echo ""
    
    # Final verification
    echo -e "${BLUE}Verifying cleanup...${NC}"
    DB_STILL_EXISTS=$(snow sql -q "USE ROLE SYSADMIN; SHOW DATABASES LIKE '${DATABASE}'" 2>/dev/null | grep -qi "${DATABASE}" && echo "yes" || echo "no")
    USER_STILL_EXISTS=$(snow sql -q "USE ROLE USERADMIN; SHOW USERS LIKE '${SERVICE_USER_NAME}'" 2>/dev/null | grep -qi "${SERVICE_USER_NAME}" && echo "yes" || echo "no")
    ROLE_STILL_EXISTS=$(snow sql -q "USE ROLE USERADMIN; SHOW ROLES LIKE '${SERVICE_ROLE_NAME}'" 2>/dev/null | grep -qi "${SERVICE_ROLE_NAME}" && echo "yes" || echo "no")
    
    if [ "$DB_STILL_EXISTS" = "yes" ]; then
        echo -e "${YELLOW}⚠️  Database ${DATABASE} still exists. Manual cleanup may be required.${NC}"
    fi
    
    if [ "$USER_STILL_EXISTS" = "yes" ]; then
        echo -e "${YELLOW}⚠️  User ${SERVICE_USER_NAME} still exists. Manual cleanup may be required.${NC}"
    fi
    
    if [ "$ROLE_STILL_EXISTS" = "yes" ]; then
        echo -e "${YELLOW}⚠️  Role ${SERVICE_ROLE_NAME} still exists. Manual cleanup may be required.${NC}"
        echo -e "${BLUE}   Try running: USE ROLE ACCOUNTADMIN; DROP ROLE ${SERVICE_ROLE_NAME};${NC}"
    fi
    
    if [ "$DB_STILL_EXISTS" = "no" ] && [ "$USER_STILL_EXISTS" = "no" ] && [ "$ROLE_STILL_EXISTS" = "no" ]; then
        echo -e "${GREEN}✅ Database, user, and role successfully removed${NC}"
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

