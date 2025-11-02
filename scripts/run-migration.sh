#!/bin/bash

# =====================================================
# API Proxy Service - Database Migration Script
# =====================================================
# This script runs database migration to add missing columns
#
# Usage:
#   ./scripts/run-migration.sh
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

print_header "Database Migration - Adding Missing Columns"

# Check if Snow CLI is available
if ! command -v snow &> /dev/null; then
    print_error "Snow CLI is not installed or not in PATH"
    echo ""
    echo "Please install Snow CLI:"
    echo "  brew install snowflake-labs/snowflake/snow-cli"
    echo ""
    echo "Or run the migration SQL manually in Snowflake:"
    echo "  sql/migrate_add_missing_columns.sql"
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

# Run migration
print_header "Running Migration"

MIGRATION_FILE="sql/migrate_add_missing_columns.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    print_error "Migration file not found: ${MIGRATION_FILE}"
    exit 1
fi

print_info "Running ${MIGRATION_FILE}..."

# Execute the migration script
if snow sql -f "$MIGRATION_FILE" 2>&1 | tee /tmp/migration.log; then
    print_success "Migration completed successfully"
    
    # Verify columns were added
    print_info "Verifying columns exist..."
    
    # Check STATUS column
    if snow sql -q "SELECT STATUS FROM API_PROXY.APP.ENDPOINTS LIMIT 1" > /dev/null 2>&1; then
        print_success "STATUS column exists"
    else
        print_error "STATUS column not found - migration may have failed"
        exit 1
    fi
    
    # Check UPDATED_BY column
    if snow sql -q "SELECT UPDATED_BY FROM API_PROXY.APP.ENDPOINTS LIMIT 1" > /dev/null 2>&1; then
        print_success "UPDATED_BY column exists"
    else
        print_error "UPDATED_BY column not found - migration may have failed"
        exit 1
    fi
    
    echo ""
    print_success "Migration verification complete!"
    echo -e "${BLUE}All required columns are now present in the ENDPOINTS table.${NC}"
else
    print_error "Migration failed"
    echo ""
    echo "Check the error messages above and verify:"
    echo "  1. You have the necessary permissions (ALTER TABLE)"
    echo "  2. The database and schema exist (API_PROXY.APP)"
    echo "  3. The ENDPOINTS table exists"
    exit 1
fi

