#!/bin/bash

# Snowflake API Proxy Service - Development Setup Script
# Sets up the local development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up Snowflake API Proxy Service Development Environment${NC}"
echo ""

# Check if Node.js is installed
check_node() {
    echo -e "${YELLOW}🔍 Checking Node.js installation...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
        echo -e "${BLUE}Visit: https://nodejs.org/${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node --version)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js $(node --version) is installed${NC}"
}

# Check if Docker is installed (optional for local dev)
check_docker() {
    echo -e "${YELLOW}🔍 Checking Docker installation...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}⚠️  Docker is not installed (optional for local development)${NC}"
        echo -e "${BLUE}Install from: https://docs.docker.com/get-docker/${NC}"
        return 1
    fi
    
    if docker info > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1) is installed and running${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker is installed but daemon is not running${NC}"
        return 1
    fi
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    # Install root dependencies
    echo -e "${BLUE}Installing root dependencies...${NC}"
    npm install
    
    # Install backend dependencies
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
    
    # Install frontend dependencies
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
    
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
}

# Create necessary directories
create_directories() {
    echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
    
    mkdir -p backend/logs
    mkdir -p config
    mkdir -p nginx/ssl
    
    echo -e "${GREEN}✅ Directories created successfully${NC}"
}

# Create configuration files from examples
create_config() {
    echo -e "${YELLOW}⚙️  Setting up configuration files...${NC}"
    
    # Copy example config if it doesn't exist
    if [ ! -f config/snowflake.json ] && [ -f config/snowflake.example.json ]; then
        cp config/snowflake.example.json config/snowflake.json
        echo -e "${BLUE}✓ Created config/snowflake.json from example${NC}"
        echo -e "${YELLOW}  ⚠️  Update config/snowflake.json with your Snowflake credentials${NC}"
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cat > .env << 'EOF'
# Snowflake Configuration (for local development)
SNOWFLAKE_ACCOUNT=your-account.snowflakecomputing.com
SNOWFLAKE_USERNAME=API_PROXY_SERVICE_MANAGER
SNOWFLAKE_PASSWORD=ChangeThisPassword123!
SNOWFLAKE_WAREHOUSE=API_PROXY_WH
SNOWFLAKE_DATABASE=API_PROXY
SNOWFLAKE_SCHEMA=APP
SNOWFLAKE_ROLE=API_PROXY_SERVICE_ROLE

# JWT Configuration (MUST be changed for production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=24h

# Application Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=debug
EOF
        echo -e "${BLUE}✓ Created .env file${NC}"
        echo -e "${YELLOW}  ⚠️  Update .env with your configuration values${NC}"
    fi
    
    echo -e "${GREEN}✅ Configuration files ready${NC}"
}

# Main setup flow
main() {
    check_node
    check_docker || true  # Docker is optional for local dev
    create_directories
    install_dependencies
    create_config
    
    echo ""
    echo -e "${GREEN}🎉 Development environment setup completed!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo -e "  1. Update config/snowflake.json with your Snowflake credentials"
    echo -e "  2. Update .env with your configuration"
    echo -e "  3. Set up Snowflake resources (run deploy.sh or use SQL scripts)"
    echo -e "  4. Run 'npm run dev' to start the development server"
    echo ""
    echo -e "${BLUE}📚 Useful commands:${NC}"
    echo -e "  npm run dev              - Start development servers"
    echo -e "  npm run deploy           - Deploy to Snowflake Container Services"
    echo -e "  npm run test:deploy      - Test deployment prerequisites"
    echo -e "  npm run cleanup          - Remove deployed resources"
    echo ""
    echo -e "${YELLOW}⚠️  Security reminders:${NC}"
    echo -e "  - Change JWT_SECRET in .env for production"
    echo -e "  - Update service account password in Snowflake"
    echo -e "  - Review documentation: docs/DEPLOYMENT.md"
}

# Run main function
main "$@"
