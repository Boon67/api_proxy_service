# Snowflake API Proxy Service

A comprehensive API proxy service designed to run on Snowflake Container Services, providing secure access to Snowflake functions, stored procedures, and data queries through REST APIs with PAT token authentication.

## Features

- **Secure API Access**: Each API endpoint has a unique PAT token for authentication
- **Snowflake Integration**: Direct integration with Snowflake functions, stored procedures, and data queries
- **Management GUI**: Full-featured web interface for API management
- **Container Ready**: Designed for Snowflake Container Services deployment
- **Scalable Architecture**: Microservices-based design for high availability

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React GUI     │    │  API Gateway    │    │ Snowflake Backend│
│   (Frontend)    │◄──►│   (Express)     │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Management    │    │   Auth Service  │    │   Snowflake     │
│   Dashboard     │    │   (PAT Tokens)  │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

1. **Prerequisites**
   - Snowflake account with Container Services enabled
   - Node.js 18+ and npm
   - Docker

2. **Snowflake Setup**
   ```sql
   -- Run as ACCOUNTADMIN in Snowflake
   \i sql/setup_service_account.sql
   
   -- Optional: Run performance monitoring
   \i sql/performance_monitoring.sql
   ```

3. **Installation**
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

4. **Initial Admin User**
   
   The deployment script automatically creates an initial admin user if no users exist:
   - **Default username**: `admin`
   - **Default password**: `Admin123!`
   
   You can customize these via environment variables:
   ```bash
   export INITIAL_ADMIN_USERNAME="myadmin"
   export INITIAL_ADMIN_PASSWORD="MySecurePass123"
   export INITIAL_ADMIN_EMAIL="admin@example.com"
   export INITIAL_ADMIN_FIRST_NAME="Admin"
   export INITIAL_ADMIN_LAST_NAME="User"
   export INITIAL_ADMIN_CONTACT="+1-555-123-4567"
   ./scripts/deploy.sh
   ```
   
   Or manually create a user after deployment:
   ```bash
   node scripts/create_first_user.js <username> <password> [email] [firstName] [lastName] [contactNumber]
   ```

5. **Start Development Servers**
   ```bash
   # Option 1: Use the startup script (recommended)
   ./scripts/start.sh
   
   # Option 2: Use npm script
   npm run dev
   
   # Option 3: Start manually
   # Terminal 1 - Backend
   npm run dev:backend
   
   # Terminal 2 - Frontend
   npm run dev:frontend
   ```

6. **Configuration**
   - Copy `config/snowflake.example.json` to `config/snowflake.json`
   - Update Snowflake connection details with service account credentials
   - Configure PAT token settings

7. **Production Deployment**
   
   See the comprehensive [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.
   
   **Quick Deploy:**
   ```bash
   # Install Snow CLI first
   brew install snowflake-labs/snowflake/snow-cli
   
   # Deploy to Snowflake Container Services
   ./scripts/deploy.sh
   ```
   
   **For local Docker testing:**
   ```bash
   docker-compose up -d
   ```

8. **Cleanup/Teardown**
   
   To remove all deployed resources (service, compute pool, database, warehouse, user, role):
   ```bash
   # Interactive (asks for confirmation)
   npm run cleanup
   
   # Non-interactive (auto-confirms)
   npm run cleanup:yes
   
   # With custom names
   ./scripts/cleanup.sh --database MY_DB --warehouse MY_WH
   ```

## Project Structure

```
api_proxy_service/
├── backend/                 # Node.js backend service
│   ├── src/
│   │   ├── controllers/     # API controllers
│   │   ├── middleware/      # Authentication & validation
│   │   ├── models/          # Data models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utility functions
│   ├── config/              # Configuration files
│   └── tests/               # Backend tests
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── hooks/           # Custom hooks
│   │   └── utils/           # Utility functions
│   └── public/              # Static assets
├── docs/                    # Documentation
├── scripts/                 # Deployment and utility scripts
│   ├── deploy.sh            # Main deployment script
│   ├── cleanup.sh           # Resource cleanup script
│   ├── setup.sh             # Development environment setup
│   ├── health-check.sh      # Service health monitoring
│   ├── test-deploy-validation.sh  # Deployment validation tests
│   └── test-deploy-e2e.sh   # End-to-end deployment tests
└── config/                  # Shared configuration
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Deployment Guide](docs/DEPLOYMENT.md)** - Complete deployment instructions for Snowflake Container Services
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and design decisions
- **[API Documentation](docs/API.md)** - Complete API reference
- **[Security Guide](docs/SECURITY.md)** - Security best practices and configuration
- **[SQL Scripts Guide](docs/SQL_SCRIPTS.md)** - Database setup and SQL script documentation
- **[Snowflake Setup](docs/SNOWFLAKE_SETUP.md)** - Complete Snowflake account setup including PAT tokens
- **[Deployment Testing](docs/DEPLOYMENT_TESTING.md)** - Testing the deployment process
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Complete deployment instructions including cleanup

## API Endpoints

For complete API documentation, see [API.md](docs/API.md).

### Quick Reference

**Management APIs:**
- `GET /api/endpoints` - List all API endpoints
- `POST /api/endpoints` - Create new API endpoint
- `PUT /api/endpoints/:id` - Update API endpoint
- `DELETE /api/endpoints/:id` - Delete API endpoint
- `GET /api/endpoints/:id/token` - Generate new PAT token

**Proxy APIs:**
- `GET /proxy/:token` - Execute GET query/function
- `POST /proxy/:token` - Execute POST query/function with parameters
- `PUT /proxy/:token` - Execute PUT query/function
- `DELETE /proxy/:token` - Execute DELETE query/function

## Security

See [Security Guide](docs/SECURITY.md) for comprehensive security information.

Key security features:
- PAT tokens generated using cryptographically secure random strings
- All API calls logged and monitored
- Rate limiting implemented per token
- Input validation and sanitization
- CORS configuration for secure cross-origin requests

## Monitoring

- Comprehensive logging with Winston
- Health check endpoints (`/health`, `/health/detailed`)
- Performance metrics collection
- Error tracking and alerting

## License

MIT License - see LICENSE file for details
