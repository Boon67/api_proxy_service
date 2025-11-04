#!/bin/bash

# =====================================================
# API Proxy Service - Database Setup Script
# =====================================================
# This script runs the SQL scripts to create database tables
#
# Usage:
#   ./scripts/setup-database.sh
#
# =====================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}====================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}====================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

cd "$PROJECT_ROOT"

print_header "Setting Up Database Tables"

# Check if Snow CLI is available
if ! command -v snow &> /dev/null; then
    print_error "Snow CLI is not installed or not in PATH"
    echo ""
    echo "Please install Snow CLI:"
    echo "  brew install snowflake-labs/snowflake/snow-cli"
    echo ""
    echo "Or run the SQL scripts manually in Snowflake:"
    echo "  1. sql/setup_service_account.sql (if not already run)"
    echo "  2. sql/create_tables.sql"
    exit 1
fi

# Check if connected
print_info "Checking Snow CLI connection..."
if ! snow connection test 2>/dev/null; then
    print_error "Snow CLI connection test failed"
    echo ""
    echo "Please configure Snow CLI first:"
    echo "  snow connection add"
    exit 1
fi

print_success "Snow CLI connection verified"

# Run create_tables.sql
print_header "Creating Database Tables"

if [ ! -f "sql/create_tables.sql" ]; then
    print_error "sql/create_tables.sql not found"
    exit 1
fi

print_info "Running sql/create_tables.sql..."

# Execute the SQL script
if snow sql -f sql/create_tables.sql 2>&1 | tee /tmp/snowflake_setup.log; then
    print_success "Tables created successfully"
else
    EXIT_CODE=$?
    print_error "Failed to create tables (exit code: $EXIT_CODE)"
    echo ""
    echo "Check the output above for errors."
    echo ""
    echo "Common issues:"
    echo "  1. Database/SCHEMA doesn't exist - run sql/setup_service_account.sql first"
    echo "  2. Insufficient permissions - ensure you're using ACCOUNTADMIN or SYSADMIN"
    echo "  3. Tables already exist - this is okay, they'll be skipped"
    exit $EXIT_CODE
fi

# Verify tables were created
print_header "Verifying Tables"

print_info "Checking if USERS table exists..."
USERS_CHECK=$(snow sql -q "USE DATABASE API_PROXY; USE SCHEMA APP; SHOW TABLES LIKE 'USERS';" 2>/dev/null || echo "")

if echo "$USERS_CHECK" | grep -qi "USERS"; then
    print_success "USERS table exists"
else
    print_error "USERS table not found"
    echo ""
    echo "The table creation may have failed. Check the logs above."
    exit 1
fi

print_info "Checking if ENDPOINTS table exists..."
ENDPOINTS_CHECK=$(snow sql -q "USE DATABASE API_PROXY; USE SCHEMA APP; SHOW TABLES LIKE 'ENDPOINTS';" 2>/dev/null || echo "")

if echo "$ENDPOINTS_CHECK" | grep -qi "ENDPOINTS"; then
    print_success "ENDPOINTS table exists"
else
    print_warning "ENDPOINTS table not found (this is okay if you haven't created any endpoints yet)"
fi

print_header "Setup Complete"

print_success "Database tables are ready!"
echo ""
echo "You can now:"
echo "  1. Login to the application at http://localhost:3000"
echo "  2. Create a user through the application UI after deployment"
echo ""
echo "To view logs:"
echo "  ./scripts/view-logs.sh tail"

