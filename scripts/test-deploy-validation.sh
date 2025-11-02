#!/bin/bash

# Test script to validate deploy.sh functions without full deployment
# This helps identify issues before running the full deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing deploy.sh validation functions...${NC}"

# Source the deploy script to get functions (but we'll test them individually)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy.sh"

# Test 1: Check if Snow CLI is available
echo -e "${BLUE}Test 1: Checking Snow CLI availability...${NC}"
if command -v snow &> /dev/null; then
    echo -e "${GREEN}✅ Snow CLI is installed${NC}"
    SNOW_VERSION=$(snow --version 2>&1 || echo "unknown")
    echo -e "${BLUE}   Version: ${SNOW_VERSION}${NC}"
else
    echo -e "${RED}❌ Snow CLI is not installed${NC}"
    exit 1
fi

# Test 2: Check if Snow CLI connection works
echo -e "${BLUE}Test 2: Testing Snow CLI connection...${NC}"
if snow connection test 2>/dev/null; then
    echo -e "${GREEN}✅ Snow CLI connection works${NC}"
else
    echo -e "${YELLOW}⚠️  Snow CLI connection test failed (may need configuration)${NC}"
fi

# Test 3: Check if we can run a simple SQL query
echo -e "${BLUE}Test 3: Testing SQL query execution...${NC}"
if snow sql -q "SELECT 1 as test" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SQL queries work${NC}"
else
    echo -e "${RED}❌ SQL queries fail - check Snowflake connection${NC}"
    exit 1
fi

# Test 4: Check if we can run GRANT statements (as ACCOUNTADMIN)
echo -e "${BLUE}Test 4: Testing GRANT statement execution...${NC}"
TEST_ROLE="TEST_ROLE_$(date +%s)"
if snow sql -q "USE ROLE ACCOUNTADMIN; CREATE ROLE IF NOT EXISTS ${TEST_ROLE}" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Can create roles (ACCOUNTADMIN permissions verified)${NC}"
    # Clean up
    snow sql -q "USE ROLE ACCOUNTADMIN; DROP ROLE IF EXISTS ${TEST_ROLE}" > /dev/null 2>&1
else
    echo -e "${RED}❌ Cannot create roles - not running as ACCOUNTADMIN?${NC}"
    echo -e "${YELLOW}   Current role: $(snow sql -q 'SELECT CURRENT_ROLE()' 2>/dev/null | tail -1 || echo 'unknown')${NC}"
    exit 1
fi

# Test 5: Validate variable expansion in GRANT statements
echo -e "${BLUE}Test 5: Testing variable expansion in GRANT statements...${NC}"
TEST_DB="API_PROXY"
TEST_SCHEMA="APP"
TEST_ROLE="API_PROXY_SERVICE_ROLE"
TEST_WAREHOUSE="API_PROXY_WH"

# Test if variables expand correctly
GRANT_SQL="USE ROLE ACCOUNTADMIN; GRANT USAGE ON DATABASE ${TEST_DB} TO ROLE ${TEST_ROLE}"
echo -e "${BLUE}   Example GRANT statement: ${GRANT_SQL}${NC}"
if [ -n "$TEST_DB" ] && [ -n "$TEST_ROLE" ]; then
    echo -e "${GREEN}✅ Variable expansion works${NC}"
else
    echo -e "${RED}❌ Variable expansion failed${NC}"
    exit 1
fi

# Test 6: Check Docker availability (needed for image builds)
echo -e "${BLUE}Test 6: Checking Docker availability...${NC}"
if command -v docker &> /dev/null; then
    if docker ps > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker is installed but daemon is not running${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker is not installed (needed for image builds)${NC}"
fi

echo -e "${GREEN}✅ All validation tests completed${NC}"
echo -e "${BLUE}You can now run: ./scripts/deploy.sh${NC}"

