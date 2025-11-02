#!/bin/bash

# End-to-End Deployment Test Script
# This script tests the complete deployment process including:
# - Pre-deployment validation
# - SQL script execution
# - Resource creation
# - Service deployment
# - Verification

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_DATABASE="API_PROXY_TEST"
TEST_SCHEMA="APP"
TEST_WAREHOUSE="API_PROXY_WH_TEST"
TEST_COMPUTE_POOL="API_PROXY_POOL_TEST"
TEST_SERVICE_NAME="SNOWFLAKE_API_PROXY_TEST"
SKIP_DEPLOYMENT=false
SKIP_CLEANUP=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-deployment)
            SKIP_DEPLOYMENT=true
            shift
            ;;
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --database|-d)
            TEST_DATABASE="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            cat << EOF
${BLUE}End-to-End Deployment Test Script${NC}

Usage: $0 [OPTIONS]

Options:
  --skip-deployment     Skip the actual service deployment (only test setup)
  --skip-cleanup       Skip cleanup after tests (leave resources for inspection)
  -d, --database NAME  Test database name (default: ${TEST_DATABASE})
  -v, --verbose        Show verbose output
  -h, --help           Show this help message

This script tests:
  1. Prerequisites (Snow CLI, Docker, etc.)
  2. SQL script execution with variable substitution
  3. Resource creation (database, warehouse, role, user)
  4. Service deployment (optional)
  5. Resource verification
  6. Cleanup (optional)
EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Step $1: $2${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_pass() {
    ((TESTS_PASSED++))
    log_success "$1"
}

test_fail() {
    ((TESTS_FAILED++))
    log_error "$1"
    if [ "$SKIP_CLEANUP" != true ]; then
        log_warning "Test failed, but continuing with cleanup..."
    fi
}

# Step 1: Prerequisites Check
test_prerequisites() {
    log_step "1" "Testing Prerequisites"
    
    # Check Snow CLI
    log_info "Checking Snow CLI..."
    if command -v snow &> /dev/null; then
        SNOW_VERSION=$(snow --version 2>&1 || echo "unknown")
        test_pass "Snow CLI is installed (${SNOW_VERSION})"
    else
        test_fail "Snow CLI is not installed"
        return 1
    fi
    
    # Test Snow CLI connection
    log_info "Testing Snow CLI connection..."
    if snow connection test 2>/dev/null; then
        test_pass "Snow CLI connection works"
    else
        test_fail "Snow CLI connection test failed"
        return 1
    fi
    
    # Test SQL execution
    log_info "Testing SQL query execution..."
    if snow sql -q "SELECT 1 as test" > /dev/null 2>&1; then
        test_pass "SQL queries work"
    else
        test_fail "SQL queries fail"
        return 1
    fi
    
    # Check Docker
    log_info "Checking Docker..."
    if command -v docker &> /dev/null; then
        if docker ps > /dev/null 2>&1; then
            DOCKER_VERSION=$(docker --version 2>&1)
            test_pass "Docker is running (${DOCKER_VERSION})"
        else
            test_fail "Docker daemon is not running"
            return 1
        fi
    else
        test_fail "Docker is not installed"
        return 1
    fi
    
    # Check current role
    log_info "Checking current Snowflake role..."
    CURRENT_ROLE=$(snow sql -q "SELECT CURRENT_ROLE()" 2>/dev/null | tail -1 | xargs || echo "unknown")
    log_info "Current role: ${CURRENT_ROLE}"
    
    return 0
}

# Step 2: Test SQL Script Execution
test_sql_scripts() {
    log_step "2" "Testing SQL Script Execution"
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SQL_DIR="${SCRIPT_DIR}/../sql"
    
    # Check if SQL scripts exist
    log_info "Checking SQL scripts..."
    if [ ! -f "${SQL_DIR}/setup_service_account.sql" ]; then
        test_fail "SQL script not found: ${SQL_DIR}/setup_service_account.sql"
        return 1
    fi
    test_pass "SQL scripts found"
    
    # Test SQL script variable substitution (dry run)
    log_info "Testing SQL script variable substitution..."
    
    # Create a test temporary SQL file with substitutions
    TEMP_SQL=$(mktemp)
    sed -e "s/API_PROXY/${TEST_DATABASE}/g" \
        -e "s/API_PROXY_WH/${TEST_WAREHOUSE}/g" \
        -e "s/API_PROXY\.APP/${TEST_DATABASE}.${TEST_SCHEMA}/g" \
        "${SQL_DIR}/setup_service_account.sql" > "$TEMP_SQL"
    
    # Check if substitutions worked
    if grep -q "${TEST_DATABASE}" "$TEMP_SQL"; then
        test_pass "SQL script variable substitution works"
    else
        test_fail "SQL script variable substitution failed"
        rm -f "$TEMP_SQL"
        return 1
    fi
    
    rm -f "$TEMP_SQL"
    
    return 0
}

# Step 3: Test Resource Creation (using deploy script)
test_resource_creation() {
    log_step "3" "Testing Resource Creation"
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy.sh"
    
    if [ ! -f "$DEPLOY_SCRIPT" ]; then
        test_fail "Deploy script not found: $DEPLOY_SCRIPT"
        return 1
    fi
    
    log_info "Running deploy script to create resources..."
    log_info "Database: ${TEST_DATABASE}, Schema: ${TEST_SCHEMA}, Warehouse: ${TEST_WAREHOUSE}"
    
    # Run deploy script with test parameters (but skip image building and service deployment)
    # We'll manually trigger just the resource creation part
    
    # Export test variables
    export SNOWFLAKE_DATABASE="${TEST_DATABASE}"
    export SNOWFLAKE_SCHEMA="${TEST_SCHEMA}"
    export SNOWFLAKE_WAREHOUSE="${TEST_WAREHOUSE}"
    export SNOWFLAKE_COMPUTE_POOL="${TEST_COMPUTE_POOL}"
    
    # Actually, let's just test the SQL execution directly
    log_info "Executing SQL setup script..."
    
    # Create a test SQL file with substitutions
    # Note: We need to be careful with replacements to avoid partial matches
    TEMP_SQL=$(mktemp)
    
    # Replace in order: specific patterns first, then general ones
    # 1. Replace API_PROXY.APP first (before replacing standalone API_PROXY)
    # 2. Replace API_PROXY_WH warehouse name
    # 3. Replace service user and role names (must be exact word matches)
    # 4. Replace standalone API_PROXY (database name) last
    
    # Use perl for better word boundary handling, or sed with careful patterns
    sed -e "s/API_PROXY\.APP/${TEST_DATABASE}.${TEST_SCHEMA}/g" \
        -e "s/API_PROXY_WH/${TEST_WAREHOUSE}/g" \
        -e "s/API_PROXY_SERVICE_USER/API_PROXY_SERVICE_USER_TEST/g" \
        -e "s/API_PROXY_SERVICE_ROLE/API_PROXY_SERVICE_ROLE_TEST/g" \
        -e "s/\bAPI_PROXY\b/${TEST_DATABASE}/g" \
        "${SCRIPT_DIR}/../sql/setup_service_account.sql" > "$TEMP_SQL"
    
    # Execute SQL script
    log_info "Executing SQL setup script..."
    if [ "$VERBOSE" = true ]; then
        SQL_OUTPUT=$(snow sql -f "$TEMP_SQL" 2>&1)
    else
        SQL_OUTPUT=$(snow sql -f "$TEMP_SQL" 2>&1)
    fi
    SQL_EXIT=$?
    
    # Show warnings if verbose
    if [ "$VERBOSE" = true ] && echo "$SQL_OUTPUT" | grep -qiE "warning|error"; then
        echo "$SQL_OUTPUT" | grep -iE "warning|error" | head -10
    fi
    
    rm -f "$TEMP_SQL"
    
    # Wait a moment for resources to be available
    sleep 2
    
    # Check if resources were created (this is the real test - resources may exist despite warnings)
    log_info "Verifying resources were created..."
    
    # Check database
    DB_CHECK=$(snow sql -q "SHOW DATABASES LIKE '${TEST_DATABASE}'" 2>/dev/null)
    if echo "$DB_CHECK" | grep -qi "${TEST_DATABASE}" && ! echo "$DB_CHECK" | grep -qiE "not found|does not exist|0 rows"; then
        DB_EXISTS="yes"
    else
        DB_EXISTS="no"
    fi
    
    # Check warehouse
    WH_CHECK=$(snow sql -q "SHOW WAREHOUSES LIKE '${TEST_WAREHOUSE}'" 2>/dev/null)
    if echo "$WH_CHECK" | grep -qi "${TEST_WAREHOUSE}" && ! echo "$WH_CHECK" | grep -qiE "not found|does not exist|0 rows"; then
        WH_EXISTS="yes"
    else
        WH_EXISTS="no"
    fi
    
    # Evaluate results
    if [ "$DB_EXISTS" = "yes" ] && [ "$WH_EXISTS" = "yes" ]; then
        # Resources were created successfully (despite any warnings)
        test_pass "SQL script executed and resources created"
    else
        # Resources weren't created - check for actual errors
        if echo "$SQL_OUTPUT" | grep -qiE "SQL compilation error|SQL execution error|syntax error"; then
            test_fail "SQL script execution failed with errors"
            if [ "$VERBOSE" = false ]; then
                log_warning "Run with --verbose to see error details"
            fi
        else
            test_fail "SQL script executed but resources were not created"
        fi
        return 1
    fi
    
    # Verify resources were created (duplicate check, but more detailed)
    log_info "Verifying individual resources..."
    
    # Check database (use SELECT for more reliable checking)
    DB_COUNT=$(snow sql -q "SELECT COUNT(*) FROM INFORMATION_SCHEMA.DATABASES WHERE DATABASE_NAME = '${TEST_DATABASE}'" 2>/dev/null | tail -1 | xargs || echo "0")
    if [ "$DB_COUNT" != "0" ] && [ "$DB_COUNT" != "" ]; then
        test_pass "Database ${TEST_DATABASE} was created"
    else
        # Fallback to SHOW command
        DB_SHOW=$(snow sql -q "SHOW DATABASES LIKE '${TEST_DATABASE}'" 2>/dev/null)
        if echo "$DB_SHOW" | grep -qi "${TEST_DATABASE}" && ! echo "$DB_SHOW" | grep -qiE "0 rows|not found"; then
            test_pass "Database ${TEST_DATABASE} was created"
        else
            test_fail "Database ${TEST_DATABASE} was not created"
        fi
    fi
    
    # Check warehouse
    WH_SHOW=$(snow sql -q "SHOW WAREHOUSES LIKE '${TEST_WAREHOUSE}'" 2>/dev/null)
    if echo "$WH_SHOW" | grep -qi "${TEST_WAREHOUSE}" && ! echo "$WH_SHOW" | grep -qiE "0 rows|not found"; then
        test_pass "Warehouse ${TEST_WAREHOUSE} was created"
    else
        test_fail "Warehouse ${TEST_WAREHOUSE} was not created"
    fi
    
    # Check role
    ROLE_SHOW=$(snow sql -q "SHOW ROLES LIKE 'API_PROXY_SERVICE_ROLE_TEST'" 2>/dev/null)
    if echo "$ROLE_SHOW" | grep -qi "API_PROXY_SERVICE_ROLE_TEST" && ! echo "$ROLE_SHOW" | grep -qiE "0 rows|not found"; then
        test_pass "Role API_PROXY_SERVICE_ROLE_TEST was created"
    else
        test_fail "Role API_PROXY_SERVICE_ROLE_TEST was not created"
    fi
    
    # Check user
    USER_SHOW=$(snow sql -q "USE ROLE USERADMIN; SHOW USERS LIKE 'API_PROXY_SERVICE_USER_TEST'" 2>/dev/null)
    if echo "$USER_SHOW" | grep -qi "API_PROXY_SERVICE_USER_TEST" && ! echo "$USER_SHOW" | grep -qiE "0 rows|not found"; then
        test_pass "User API_PROXY_SERVICE_USER_TEST was created"
    else
        test_fail "User API_PROXY_SERVICE_USER_TEST was not created"
    fi
    
    return 0
}

# Step 4: Test Service Deployment (optional)
test_service_deployment() {
    if [ "$SKIP_DEPLOYMENT" = true ]; then
        log_step "4" "Skipping Service Deployment (--skip-deployment flag)"
        return 0
    fi
    
    log_step "4" "Testing Service Deployment"
    log_warning "Service deployment test is skipped in this version"
    log_info "To test full deployment, run: ./scripts/deploy.sh --database ${TEST_DATABASE} --warehouse ${TEST_WAREHOUSE}"
    
    return 0
}

# Step 5: Cleanup
cleanup_resources() {
    if [ "$SKIP_CLEANUP" = true ]; then
        log_step "5" "Skipping Cleanup (--skip-cleanup flag)"
        log_warning "Test resources left for inspection:"
        log_info "  Database: ${TEST_DATABASE}"
        log_info "  Warehouse: ${TEST_WAREHOUSE}"
        log_info "  Role: API_PROXY_SERVICE_ROLE_TEST"
        log_info "  User: API_PROXY_SERVICE_USER_TEST"
        log_info "  Run cleanup manually: ./scripts/cleanup.sh --database ${TEST_DATABASE} --warehouse ${TEST_WAREHOUSE}"
        return 0
    fi
    
    log_step "5" "Cleaning Up Test Resources"
    
    log_info "Dropping test resources..."
    
    # Drop database (cascades to schema and all objects)
    if snow sql -q "DROP DATABASE IF EXISTS ${TEST_DATABASE} CASCADE" > /dev/null 2>&1; then
        test_pass "Database ${TEST_DATABASE} dropped"
    else
        test_fail "Failed to drop database ${TEST_DATABASE}"
    fi
    
    # Drop warehouse
    if snow sql -q "DROP WAREHOUSE IF EXISTS ${TEST_WAREHOUSE}" > /dev/null 2>&1; then
        test_pass "Warehouse ${TEST_WAREHOUSE} dropped"
    else
        test_fail "Failed to drop warehouse ${TEST_WAREHOUSE}"
    fi
    
    # Drop user
    if snow sql -q "USE ROLE USERADMIN; DROP USER IF EXISTS API_PROXY_SERVICE_USER_TEST" > /dev/null 2>&1; then
        test_pass "User API_PROXY_SERVICE_USER_TEST dropped"
    else
        test_fail "Failed to drop user API_PROXY_SERVICE_USER_TEST"
    fi
    
    # Drop role
    if snow sql -q "USE ROLE USERADMIN; DROP ROLE IF EXISTS API_PROXY_SERVICE_ROLE_TEST" > /dev/null 2>&1; then
        test_pass "Role API_PROXY_SERVICE_ROLE_TEST dropped"
    else
        test_fail "Failed to drop role API_PROXY_SERVICE_ROLE_TEST"
    fi
    
    return 0
}

# Main test execution
main() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   End-to-End Deployment Test                               ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Run tests
    test_prerequisites || exit 1
    test_sql_scripts || exit 1
    test_resource_creation || exit 1
    test_service_deployment || exit 1
    cleanup_resources || exit 1
    
    # Summary
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Test Summary${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
    else
        echo -e "${GREEN}Tests Failed: 0${NC}"
    fi
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}✅ All tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed${NC}"
        exit 1
    fi
}

# Run main function
main "$@"

