#!/bin/bash

# Health Check Script for Snowflake API Proxy Service
# This script checks the health of all service components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
# Support both local development and production (SPCS) endpoints
BACKEND_URL=${BACKEND_URL:-"http://localhost:3001"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3000"}
TIMEOUT=${TIMEOUT:-10}

# Allow override via SERVICE_URL for production deployments
if [ -n "$SERVICE_URL" ]; then
    BACKEND_URL="${SERVICE_URL}"
    FRONTEND_URL="${SERVICE_URL}"
fi

echo -e "${BLUE}🏥 Health Check for Snowflake API Proxy Service${NC}"
echo -e "${BLUE}Backend URL: ${BACKEND_URL}${NC}"
echo -e "${BLUE}Frontend URL: ${FRONTEND_URL}${NC}"
echo ""

# Check if curl is available
check_curl() {
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl is not installed. Please install curl first.${NC}"
        exit 1
    fi
}

# Check backend health
check_backend() {
    echo -e "${YELLOW}🔍 Checking backend health...${NC}"
    
    if curl -s --max-time $TIMEOUT "${BACKEND_URL}/health" > /dev/null; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        
        # Get detailed health info
        HEALTH_RESPONSE=$(curl -s --max-time $TIMEOUT "${BACKEND_URL}/health/detailed")
        echo -e "${BLUE}Backend Status: $(echo $HEALTH_RESPONSE | jq -r '.status' 2>/dev/null || echo 'Unknown')${NC}"
        
        # Check Snowflake connection
        SNOWFLAKE_STATUS=$(echo $HEALTH_RESPONSE | jq -r '.services.snowflake.status' 2>/dev/null || echo 'Unknown')
        if [ "$SNOWFLAKE_STATUS" = "healthy" ]; then
            echo -e "${GREEN}✅ Snowflake connection is healthy${NC}"
        else
            echo -e "${RED}❌ Snowflake connection is unhealthy: $(echo $HEALTH_RESPONSE | jq -r '.services.snowflake.message' 2>/dev/null || echo 'Unknown error')${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}❌ Backend is unhealthy${NC}"
        return 1
    fi
}

# Check frontend health
check_frontend() {
    echo -e "${YELLOW}🔍 Checking frontend health...${NC}"
    
    if curl -s --max-time $TIMEOUT "${FRONTEND_URL}/health" > /dev/null; then
        echo -e "${GREEN}✅ Frontend is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Frontend is unhealthy${NC}"
        return 1
    fi
}

# Check API endpoints
check_api_endpoints() {
    echo -e "${YELLOW}🔍 Checking API endpoints...${NC}"
    
    # Check if we can get endpoints list (this requires authentication)
    if curl -s --max-time $TIMEOUT "${BACKEND_URL}/api/endpoints" > /dev/null; then
        echo -e "${GREEN}✅ API endpoints are accessible${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  API endpoints require authentication${NC}"
        return 1
    fi
}

# Check Docker containers
check_docker_containers() {
    echo -e "${YELLOW}🔍 Checking Docker containers...${NC}"
    
    if command -v docker &> /dev/null; then
        # Check if containers are running
        BACKEND_CONTAINER=$(docker ps --filter "name=snowflake-api-proxy-backend" --format "{{.Status}}" 2>/dev/null || echo "")
        FRONTEND_CONTAINER=$(docker ps --filter "name=snowflake-api-proxy-frontend" --format "{{.Status}}" 2>/dev/null || echo "")
        
        if [ -n "$BACKEND_CONTAINER" ]; then
            echo -e "${GREEN}✅ Backend container is running: $BACKEND_CONTAINER${NC}"
        else
            echo -e "${RED}❌ Backend container is not running${NC}"
        fi
        
        if [ -n "$FRONTEND_CONTAINER" ]; then
            echo -e "${GREEN}✅ Frontend container is running: $FRONTEND_CONTAINER${NC}"
        else
            echo -e "${RED}❌ Frontend container is not running${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Docker is not available${NC}"
    fi
}

# Check system resources
check_system_resources() {
    echo -e "${YELLOW}🔍 Checking system resources...${NC}"
    
    # Check memory usage (works on Linux, macOS uses different command)
    if command -v free &> /dev/null; then
        MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
        echo -e "${BLUE}Memory usage: ${MEMORY_USAGE}%${NC}"
    elif [ "$(uname)" = "Darwin" ]; then
        # macOS memory check
        MEMORY_USAGE=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//' | awk '{printf "%.1f", (1-$1/1048576)*100}')
        echo -e "${BLUE}Memory usage: ${MEMORY_USAGE}%${NC}"
    else
        echo -e "${BLUE}Memory usage: (unavailable)${NC}"
    fi
    
    # Check disk usage
    DISK_USAGE=$(df -h / | awk 'NR==2{printf "%s", $5}' | sed 's/%//')
    echo -e "${BLUE}Disk usage: ${DISK_USAGE}%${NC}"
    
    # Check if ports are in use (works on both Linux and macOS)
    if lsof -i :3001 > /dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":3001 "; then
        echo -e "${GREEN}✅ Port 3001 is in use (backend)${NC}"
    else
        echo -e "${YELLOW}⚠️  Port 3001 is not in use (backend may not be running)${NC}"
    fi
    
    if lsof -i :3000 > /dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":3000 "; then
        echo -e "${GREEN}✅ Port 3000 is in use (frontend)${NC}"
    else
        echo -e "${YELLOW}⚠️  Port 3000 is not in use (frontend may not be running)${NC}"
    fi
}

# Generate health report
generate_report() {
    local backend_status=$1
    local frontend_status=$2
    local api_status=$3
    
    echo ""
    echo -e "${BLUE}📊 Health Check Report${NC}"
    echo -e "${BLUE}=====================${NC}"
    echo -e "Backend: $([ $backend_status -eq 0 ] && echo -e "${GREEN}✅ Healthy${NC}" || echo -e "${RED}❌ Unhealthy${NC}")"
    echo -e "Frontend: $([ $frontend_status -eq 0 ] && echo -e "${GREEN}✅ Healthy${NC}" || echo -e "${RED}❌ Unhealthy${NC}")"
    echo -e "API Endpoints: $([ $api_status -eq 0 ] && echo -e "${GREEN}✅ Accessible${NC}" || echo -e "${YELLOW}⚠️  Requires Auth${NC}")"
    
    if [ $backend_status -eq 0 ] && [ $frontend_status -eq 0 ]; then
        echo -e "${GREEN}🎉 Overall Status: Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Overall Status: Unhealthy${NC}"
        return 1
    fi
}

# Main health check flow
main() {
    check_curl
    
    # Run health checks
    check_backend
    backend_status=$?
    
    check_frontend
    frontend_status=$?
    
    check_api_endpoints
    api_status=$?
    
    check_docker_containers
    check_system_resources
    
    # Generate report
    generate_report $backend_status $frontend_status $api_status
}

# Run main function
main "$@"
