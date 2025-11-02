#!/bin/bash

# =====================================================
# API Proxy Service - Log Viewer Script
# =====================================================
# This script provides easy access to backend logs
#
# Usage:
#   ./scripts/view-logs.sh              # View all logs
#   ./scripts/view-logs.sh error         # View only errors
#   ./scripts/view-logs.sh login         # Filter for login attempts
#   ./scripts/view-logs.sh tail          # Follow logs in real-time
#
# =====================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/backend/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if log directory exists
if [ ! -d "$LOG_DIR" ]; then
    echo -e "${RED}❌ Log directory not found: $LOG_DIR${NC}"
    exit 1
fi

# Parse arguments
MODE="${1:-tail}"
FILTER="${2:-}"

case "$MODE" in
    "error"|"errors")
        echo -e "${BLUE}📋 Showing error logs...${NC}"
        echo ""
        if [ -f "$LOG_DIR/backend.log" ]; then
            tail -100 "$LOG_DIR/backend.log" | jq -r 'select(.level == "error") | "\(.timestamp) | \(.message)\(if .error then " | Error: \(.error)" else "" end)"' 2>/dev/null || tail -100 "$LOG_DIR/backend.log" | grep -i '"level":"error"'
        else
            echo -e "${YELLOW}⚠️  backend.log not found${NC}"
        fi
        ;;
    "all")
        echo -e "${BLUE}📋 Showing all logs (last 50 lines)...${NC}"
        echo ""
        if [ -f "$LOG_DIR/backend.log" ]; then
            tail -50 "$LOG_DIR/backend.log" | jq -r 'select(.level != null) | "\(.level) | \(.message)"' 2>/dev/null || tail -50 "$LOG_DIR/backend.log"
        else
            echo -e "${YELLOW}⚠️  backend.log not found${NC}"
        fi
        ;;
    "login")
        echo -e "${BLUE}📋 Showing login-related logs...${NC}"
        echo ""
        if [ -f "$LOG_DIR/backend.log" ]; then
            tail -100 "$LOG_DIR/backend.log" | grep -i "login\|auth" | tail -20
        else
            echo -e "${YELLOW}⚠️  backend.log not found${NC}"
        fi
        ;;
    "tail"|"follow"|"f")
        echo -e "${GREEN}📺 Following logs in real-time (Ctrl+C to exit)...${NC}"
        echo -e "${BLUE}   Filter: ${FILTER:-none}${NC}"
        echo ""
        if [ -n "$FILTER" ]; then
            tail -f "$LOG_DIR/backend.log" 2>/dev/null | grep -i "$FILTER" || tail -f "$LOG_DIR/backend.log"
        else
            tail -f "$LOG_DIR/backend.log" 2>/dev/null || echo -e "${YELLOW}⚠️  backend.log not found${NC}"
        fi
        ;;
    "snowflake"|"sf")
        echo -e "${BLUE}📋 Showing Snowflake connection logs...${NC}"
        echo ""
        if [ -f "$LOG_DIR/backend.log" ]; then
            tail -100 "$LOG_DIR/backend.log" | grep -i "snowflake\|connection\|network" | tail -20
        else
            echo -e "${YELLOW}⚠️  backend.log not found${NC}"
        fi
        ;;
    "help"|"-h"|"--help")
        echo -e "${BLUE}API Proxy Service - Log Viewer${NC}"
        echo ""
        echo "Usage:"
        echo "  ./scripts/view-logs.sh [mode] [filter]"
        echo ""
        echo "Modes:"
        echo "  tail       Follow logs in real-time (default)"
        echo "  error      Show error logs only"
        echo "  all        Show all logs (last 50 lines)"
        echo "  login      Filter for login/auth related logs"
        echo "  snowflake  Show Snowflake connection logs"
        echo ""
        echo "Examples:"
        echo "  ./scripts/view-logs.sh tail"
        echo "  ./scripts/view-logs.sh tail login"
        echo "  ./scripts/view-logs.sh error"
        echo "  ./scripts/view-logs.sh login"
        ;;
    *)
        echo -e "${RED}❌ Unknown mode: $MODE${NC}"
        echo "Run './scripts/view-logs.sh help' for usage"
        exit 1
        ;;
esac

