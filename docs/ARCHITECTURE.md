# Architecture Overview

## System Architecture

The Snowflake API Proxy Service is designed as a microservices-based architecture that runs on Snowflake Container Services. It provides secure access to Snowflake functions, stored procedures, and data queries through REST APIs with PAT token authentication.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Snowflake Container Services                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   React GUI     │    │  API Gateway    │    │ Snowflake    │ │
│  │   (Frontend)    │◄──►│   (Express)     │◄──►│ Backend      │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                       │     │
│           │                       │                       │     │
│           ▼                       ▼                       ▼     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Management    │    │   Auth Service  │    │   Snowflake  │ │
│  │   Dashboard     │    │   (PAT Tokens)  │    │   Database   │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Frontend (React Application)
- **Technology**: React 18, Tailwind CSS, React Query
- **Purpose**: Management dashboard for API endpoints and tokens
- **Features**:
  - Endpoint management (CRUD operations)
  - Token generation and management
  - Real-time monitoring and statistics
  - User authentication
  - Responsive design

### 2. Backend (Node.js API)
- **Technology**: Node.js, Express.js, Snowflake SDK
- **Purpose**: Core API service and Snowflake integration
- **Features**:
  - RESTful API endpoints
  - PAT token authentication
  - Snowflake connection management
  - Request/response logging
  - Health monitoring

### 3. Authentication System
- **JWT Tokens**: For admin authentication
- **PAT Tokens**: For API access (Personal Access Tokens)
- **Token Management**: Secure generation, validation, and revocation

### 4. Snowflake Integration
- **Connection Pooling**: Efficient database connections
- **Query Execution**: Support for SQL queries, stored procedures, and functions
- **Error Handling**: Comprehensive error management
- **Security**: Secure credential management

## Data Flow

### 1. API Request Flow
```
Client Request → Nginx → API Gateway → Authentication → Snowflake Service → Snowflake DB
                ↓
            Response ← API Gateway ← Snowflake Service ← Snowflake DB
```

### 2. Management Flow
```
Admin → React GUI → API Gateway → Backend Service → Database/Storage
       ↓
   Management Actions (Create/Update/Delete Endpoints, Generate Tokens)
```

## Security Architecture

### 1. Authentication Layers
- **Admin Authentication**: JWT-based authentication for management interface
- **API Authentication**: PAT token-based authentication for API access
- **Snowflake Authentication**: Secure credential management

### 2. Security Features
- **Rate Limiting**: Per-token and per-IP rate limiting
- **Input Validation**: Comprehensive request validation
- **CORS Configuration**: Secure cross-origin requests
- **Security Headers**: Helmet.js for security headers
- **Token Encryption**: Secure token storage and transmission

### 3. Network Security
- **Container Isolation**: Each service runs in isolated containers
- **Internal Communication**: Services communicate through internal networks
- **External Access**: Only necessary ports exposed

## Scalability Considerations

### 1. Horizontal Scaling
- **Stateless Design**: Services can be scaled horizontally
- **Load Balancing**: Nginx provides load balancing capabilities
- **Container Orchestration**: Snowflake Container Services handles orchestration

### 2. Performance Optimization
- **Connection Pooling**: Efficient database connections
- **Caching**: Response caching where appropriate
- **Compression**: Gzip compression for responses
- **CDN Ready**: Static assets can be served from CDN

### 3. Monitoring and Observability
- **Health Checks**: Comprehensive health monitoring
- **Logging**: Structured logging with Winston
- **Metrics**: Performance and usage metrics
- **Alerting**: Error and performance alerting

## Deployment Architecture

### 1. Container Services
- **Backend Container**: Node.js application
- **Frontend Container**: Nginx serving React app
- **Nginx Container**: Reverse proxy and load balancer

### 2. Configuration Management
- **Environment Variables**: Secure configuration
- **Config Files**: JSON-based configuration
- **Secrets Management**: Secure credential storage

### 3. Storage
- **In-Memory Storage**: For development (endpoints, tokens)
- **Database Integration**: Ready for external database
- **File Storage**: Log files and configuration

## Development vs Production

### Development
- **Local Development**: Docker Compose for local development
- **Hot Reloading**: Frontend and backend hot reloading
- **Debug Mode**: Enhanced logging and debugging
- **Mock Data**: Sample data for testing

### Production
- **Container Services**: Deployed on Snowflake Container Services
- **Optimized Builds**: Minified and optimized assets
- **Security Hardening**: Production security configurations
- **Monitoring**: Full monitoring and alerting setup

## Technology Stack

### Frontend
- React 18
- Tailwind CSS
- React Query
- React Router
- Lucide React (Icons)
- Recharts (Charts)

### Backend
- Node.js 18
- Express.js
- Snowflake SDK
- Winston (Logging)
- JWT (Authentication)
- Bcrypt (Password Hashing)

### Infrastructure
- Docker
- Nginx
- Snowflake Container Services
- Snowflake Database

### Development Tools
- ESLint
- Prettier
- Jest (Testing)
- Concurrently (Development)
- Nodemon (Development)

## Future Enhancements

### 1. Additional Features
- **API Versioning**: Support for multiple API versions
- **Webhook Support**: Event-driven notifications
- **Batch Operations**: Bulk endpoint management
- **Advanced Analytics**: Detailed usage analytics

### 2. Integration Options
- **External Databases**: PostgreSQL, MongoDB support
- **Message Queues**: Redis, RabbitMQ integration
- **Monitoring**: Prometheus, Grafana integration
- **CI/CD**: GitHub Actions, GitLab CI integration

### 3. Security Enhancements
- **OAuth 2.0**: OAuth integration
- **RBAC**: Role-based access control
- **Audit Logging**: Comprehensive audit trails
- **Encryption**: End-to-end encryption
