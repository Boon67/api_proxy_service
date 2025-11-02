# API Documentation

## Overview

The Snowflake API Proxy Service provides RESTful APIs for managing Snowflake endpoints and accessing Snowflake data through secure PAT tokens.

## Base URLs

- **Development**: `http://localhost:3001`
- **Production**: `https://your-domain.com`

## Authentication

### Admin Authentication (JWT)
For management operations, use JWT tokens in the Authorization header:

```http
Authorization: Bearer <jwt-token>
```

### API Authentication (PAT)
For API access, use PAT tokens in the URL:

```http
GET /proxy/<pat-token>
```

## API Endpoints

### Health Check

#### GET /health
Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321,
    "external": 1234567
  },
  "version": "1.0.0"
}
```

#### GET /health/detailed
Detailed health check with service status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321,
    "external": 1234567
  },
  "version": "1.0.0",
  "services": {
    "snowflake": {
      "status": "healthy",
      "message": "Connection successful"
    },
    "tokens": {
      "status": "healthy",
      "stats": {
        "total": 10,
        "active": 8,
        "revoked": 2,
        "totalUsage": 1500
      }
    },
    "environment": {
      "status": "healthy",
      "message": "All required environment variables present"
    }
  }
}
```

### Endpoint Management

#### GET /api/endpoints
List all API endpoints.

**Headers:**
```http
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "User Data Query",
      "description": "Query user information",
      "type": "query",
      "target": "SELECT * FROM users WHERE id = ?",
      "method": "GET",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "required": true,
          "description": "User ID to query"
        }
      ],
      "rateLimit": 100,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "createdBy": "admin"
    }
  ],
  "count": 1
}
```

#### GET /api/endpoints/:id
Get specific endpoint details.

**Headers:**
```http
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "User Data Query",
    "description": "Query user information",
    "type": "query",
    "target": "SELECT * FROM users WHERE id = ?",
    "method": "GET",
    "parameters": [
      {
        "name": "userId",
        "type": "string",
        "required": true,
        "description": "User ID to query"
      }
    ],
    "rateLimit": 100,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "createdBy": "admin"
  }
}
```

#### POST /api/endpoints
Create new endpoint.

**Headers:**
```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Sales Report",
  "description": "Generate sales report for date range",
  "type": "stored_procedure",
  "target": "GET_SALES_REPORT",
  "method": "POST",
  "parameters": [
    {
      "name": "startDate",
      "type": "date",
      "required": true,
      "description": "Start date for report"
    },
    {
      "name": "endDate",
      "type": "date",
      "required": true,
      "description": "End date for report"
    }
  ],
  "rateLimit": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Sales Report",
    "description": "Generate sales report for date range",
    "type": "stored_procedure",
    "target": "GET_SALES_REPORT",
    "method": "POST",
    "parameters": [
      {
        "name": "startDate",
        "type": "date",
        "required": true,
        "description": "Start date for report"
      },
      {
        "name": "endDate",
        "type": "date",
        "required": true,
        "description": "End date for report"
      }
    ],
    "rateLimit": 50,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "createdBy": "admin"
  }
}
```

#### PUT /api/endpoints/:id
Update existing endpoint.

**Headers:**
```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Sales Report",
  "description": "Updated description",
  "rateLimit": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Sales Report",
    "description": "Updated description",
    "type": "stored_procedure",
    "target": "GET_SALES_REPORT",
    "method": "POST",
    "parameters": [
      {
        "name": "startDate",
        "type": "date",
        "required": true,
        "description": "Start date for report"
      },
      {
        "name": "endDate",
        "type": "date",
        "required": true,
        "description": "End date for report"
      }
    ],
    "rateLimit": 100,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "createdBy": "admin"
  }
}
```

#### DELETE /api/endpoints/:id
Delete endpoint.

**Headers:**
```http
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Endpoint deleted successfully"
}
```

### Token Management

#### POST /api/endpoints/:id/token
Generate PAT token for endpoint.

**Headers:**
```http
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "pat_token_string",
    "endpointId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /api/endpoints/:id/token
Get token information for endpoint.

**Headers:**
```http
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "pat_token_string",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastUsed": "2024-01-01T12:00:00.000Z",
    "usageCount": 150,
    "isActive": true
  }
}
```

#### GET /api/tokens
List all tokens.

**Headers:**
```http
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "token_uuid",
      "token": "pat_token_string",
      "endpointId": "endpoint_uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastUsed": "2024-01-01T12:00:00.000Z",
      "usageCount": 150,
      "isActive": true,
      "metadata": {
        "endpointName": "User Data Query",
        "createdBy": "admin"
      }
    }
  ],
  "count": 1
}
```

### Statistics

#### GET /api/stats
Get service statistics.

**Headers:**
```http
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "endpoints": {
      "total": 10,
      "active": 8,
      "inactive": 2
    },
    "tokens": {
      "total": 15,
      "active": 12,
      "revoked": 3,
      "totalUsage": 2500
    }
  }
}
```

### Proxy Endpoints

#### GET /proxy/:token
Execute GET endpoint.

**URL Parameters:**
- `token`: PAT token for authentication

**Query Parameters:**
- `limit`: Number of rows to return (for table endpoints)
- `offset`: Number of rows to skip (for table endpoints)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "metadata": {
    "rowCount": 1,
    "endpoint": "User Data Query",
    "type": "query",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /proxy/:token
Execute POST endpoint with parameters.

**URL Parameters:**
- `token`: PAT token for authentication

**Request Body:**
```json
{
  "parameters": [
    "2024-01-01",
    "2024-01-31"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-01",
      "sales": 1000.00,
      "orders": 25
    }
  ],
  "metadata": {
    "rowCount": 1,
    "endpoint": "Sales Report",
    "type": "stored_procedure",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT /proxy/:token
Execute PUT endpoint.

**URL Parameters:**
- `token`: PAT token for authentication

**Request Body:**
```json
{
  "parameters": [
    "user_id",
    "new_value"
  ]
}
```

#### DELETE /proxy/:token
Execute DELETE endpoint.

**URL Parameters:**
- `token`: PAT token for authentication

### Error Responses

#### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoints",
  "method": "POST"
}
```

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoints",
  "method": "GET"
}
```

#### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Endpoint not found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoints/uuid",
  "method": "GET"
}
```

#### 429 Too Many Requests
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/proxy/token",
  "method": "GET"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoints",
  "method": "POST"
}
```

## Rate Limiting

### Default Limits
- **API Management**: 1000 requests per 15 minutes per IP
- **Proxy Endpoints**: 100 requests per minute per token
- **Login Endpoints**: 5 requests per minute per IP

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Pagination

### Query Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `sort`: Sort field
- `order`: Sort order (asc/desc)

### Response Format
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Webhooks (Future Feature)

### Webhook Events
- `endpoint.created`
- `endpoint.updated`
- `endpoint.deleted`
- `token.generated`
- `token.revoked`
- `proxy.request.failed`

### Webhook Payload
```json
{
  "event": "endpoint.created",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "id": "uuid",
    "name": "New Endpoint",
    "type": "query"
  }
}
```

## SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});

// Create endpoint
const endpoint = await api.post('/api/endpoints', {
  name: 'User Query',
  type: 'query',
  target: 'SELECT * FROM users',
  method: 'GET'
});

// Generate token
const token = await api.post(`/api/endpoints/${endpoint.data.data.id}/token`);

// Use proxy endpoint
const data = await axios.get(`http://localhost:3001/proxy/${token.data.data.token}`);
```

### Python
```python
import requests

# Create endpoint
response = requests.post(
    'http://localhost:3001/api/endpoints',
    headers={'Authorization': 'Bearer your-jwt-token'},
    json={
        'name': 'User Query',
        'type': 'query',
        'target': 'SELECT * FROM users',
        'method': 'GET'
    }
)

# Generate token
token_response = requests.post(
    f'http://localhost:3001/api/endpoints/{response.json()["data"]["id"]}/token',
    headers={'Authorization': 'Bearer your-jwt-token'}
)

# Use proxy endpoint
data = requests.get(f'http://localhost:3001/proxy/{token_response.json()["data"]["token"]}')
```

### cURL
```bash
# Create endpoint
curl -X POST http://localhost:3001/api/endpoints \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Query",
    "type": "query",
    "target": "SELECT * FROM users",
    "method": "GET"
  }'

# Generate token
curl -X POST http://localhost:3001/api/endpoints/endpoint-id/token \
  -H "Authorization: Bearer your-jwt-token"

# Use proxy endpoint
curl http://localhost:3001/proxy/your-pat-token
```
