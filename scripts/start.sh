#!/bin/bash

# =====================================================
# API Proxy Service - Local Development Startup Script
# =====================================================
# This script starts both the frontend and backend services
# for local development.
#
# Usage:
#   ./scripts/start.sh
#   or
#   bash scripts/start.sh
#
# =====================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# =====================================================
# Functions
# =====================================================

print_header() {
    echo ""
    echo -e "${BLUE}====================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}====================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Cleanup function
cleanup() {
    echo ""
    print_header "Stopping Services"
    
    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        print_info "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        print_info "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining node processes started by this script
    pkill -f "nodemon.*backend/src/app.js" 2>/dev/null || true
    pkill -f "react-scripts.*start" 2>/dev/null || true
    
    print_success "All services stopped"
    echo ""
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

# =====================================================
# Prerequisites Check
# =====================================================

print_header "Checking Prerequisites"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi
print_success "npm $(npm -v) detected"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warning "Root node_modules not found. Installing dependencies..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    print_warning "Backend node_modules not found. Installing dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    print_warning "Frontend node_modules not found. Installing dependencies..."
    cd frontend && npm install && cd ..
fi

print_success "All dependencies installed"

# Check if config file exists
if [ ! -f "config/snowflake.json" ]; then
    print_warning "config/snowflake.json not found"
    print_info "Copying from example file..."
    if [ -f "config/snowflake.example.json" ]; then
        cp config/snowflake.example.json config/snowflake.json
        print_warning "Please update config/snowflake.json with your Snowflake credentials"
    else
        print_error "config/snowflake.example.json not found. Please create config/snowflake.json manually."
        exit 1
    fi
fi

# Check if .env file exists (optional)
if [ ! -f ".env" ]; then
    print_info ".env file not found (optional - will use defaults)"
else
    print_success ".env file found"
fi

# =====================================================
# Environment Setup
# =====================================================

print_header "Setting Up Environment"

# Set default ports if not already set
export PORT=${PORT:-3001}
export REACT_APP_API_URL=${REACT_APP_API_URL:-http://localhost:3001}

# Ensure log directories exist
mkdir -p backend/logs
mkdir -p frontend/logs

print_success "Environment configured"
print_info "Backend will run on: http://localhost:${PORT}"
print_info "Frontend will run on: http://localhost:3000"

# =====================================================
# Start Services
# =====================================================

print_header "Starting Services"

# Start backend
print_info "Starting backend server..."
cd "$PROJECT_ROOT/backend"
npm run dev > ../backend/logs/startup.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_error "Backend failed to start. Check backend/logs/startup.log for details."
    tail -20 backend/logs/startup.log
    exit 1
fi

print_success "Backend started (PID: $BACKEND_PID)"

# Start frontend
print_info "Starting frontend server..."
cd "$PROJECT_ROOT/frontend"
BROWSER=none npm start > ../frontend/logs/startup.log 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 5

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    print_error "Frontend failed to start. Check frontend/logs/startup.log for details."
    tail -20 frontend/logs/startup.log
    exit 1
fi

print_success "Frontend started (PID: $FRONTEND_PID)"

# =====================================================
# Status Display
# =====================================================

print_header "Services Running"

echo ""
echo -e "${GREEN}✅ Backend:${NC}  http://localhost:${PORT}"
echo -e "${GREEN}✅ Frontend:${NC} http://localhost:3000"
echo -e "${GREEN}✅ Health:${NC}    http://localhost:${PORT}/health"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  Backend:  tail -f backend/logs/backend.log"
echo -e "  Frontend: tail -f frontend/logs/startup.log"
echo -e "  Or use:   ./scripts/view-logs.sh tail"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for user interrupt
wait

