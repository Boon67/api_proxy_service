const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/routes/api');
const Endpoint = require('../../src/models/Endpoint');
const tokenService = require('../../src/services/tokenService');

// Mock the services
jest.mock('../../src/services/tokenService');
jest.mock('../../src/services/snowflakeService');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = { username: 'test-user', id: 'user-123' };
  next();
});

describe('API Routes', () => {
  beforeEach(() => {
    // Clear endpoints storage
    const endpoints = require('../../src/routes/api').endpoints;
    if (endpoints && endpoints.clear) {
      endpoints.clear();
    }
    
    // Reset token service
    tokenService.tokens.clear();
  });

  describe('GET /api/endpoints', () => {
    it('should return empty list when no endpoints exist', async () => {
      const response = await request(app)
        .get('/api/endpoints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should return list of endpoints', async () => {
      // Create test endpoints
      const endpoint1 = new Endpoint({
        name: 'Test Endpoint 1',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      });

      const endpoint2 = new Endpoint({
        name: 'Test Endpoint 2',
        type: 'stored_procedure',
        target: 'GET_USER_DATA',
        method: 'POST'
      });

      // Add to storage (this would normally be done by the route handler)
      const endpoints = require('../../src/routes/api').endpoints;
      if (endpoints) {
        endpoints.set(endpoint1.id, endpoint1);
        endpoints.set(endpoint2.id, endpoint2);
      }

      const response = await request(app)
        .get('/api/endpoints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });
  });

  describe('POST /api/endpoints', () => {
    it('should create a new endpoint with valid data', async () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        description: 'Test description',
        rateLimit: 100
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Endpoint');
      expect(response.body.data.type).toBe('query');
      expect(response.body.data.target).toBe('SELECT * FROM users');
      expect(response.body.data.method).toBe('GET');
      expect(response.body.data.description).toBe('Test description');
      expect(response.body.data.rateLimit).toBe(100);
      expect(response.body.data.isActive).toBe(true);
      expect(response.body.data.createdBy).toBe('test-user');
    });

    it('should return validation error for missing required fields', async () => {
      const endpointData = {
        type: 'query',
        target: 'SELECT * FROM users'
        // Missing name and method
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'name',
          message: 'Name is required'
        })
      );
    });

    it('should return validation error for invalid type', async () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'invalid_type',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return validation error for invalid method', async () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'INVALID'
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/endpoints/:id', () => {
    it('should return endpoint by id', async () => {
      const endpoint = new Endpoint({
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      });

      // Add to storage
      const endpoints = require('../../src/routes/api').endpoints;
      if (endpoints) {
        endpoints.set(endpoint.id, endpoint);
      }

      const response = await request(app)
        .get(`/api/endpoints/${endpoint.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(endpoint.id);
      expect(response.body.data.name).toBe('Test Endpoint');
    });

    it('should return 404 for non-existent endpoint', async () => {
      const response = await request(app)
        .get('/api/endpoints/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Endpoint not found');
    });
  });

  describe('PUT /api/endpoints/:id', () => {
    it('should update existing endpoint', async () => {
      const endpoint = new Endpoint({
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      });

      // Add to storage
      const endpoints = require('../../src/routes/api').endpoints;
      if (endpoints) {
        endpoints.set(endpoint.id, endpoint);
      }

      const updateData = {
        name: 'Updated Endpoint',
        description: 'Updated description',
        rateLimit: 200
      };

      const response = await request(app)
        .put(`/api/endpoints/${endpoint.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Endpoint');
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.rateLimit).toBe(200);
    });

    it('should return 404 for non-existent endpoint', async () => {
      const updateData = {
        name: 'Updated Endpoint'
      };

      const response = await request(app)
        .put('/api/endpoints/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Endpoint not found');
    });
  });

  describe('DELETE /api/endpoints/:id', () => {
    it('should delete existing endpoint', async () => {
      const endpoint = new Endpoint({
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      });

      // Add to storage
      const endpoints = require('../../src/routes/api').endpoints;
      if (endpoints) {
        endpoints.set(endpoint.id, endpoint);
      }

      const response = await request(app)
        .delete(`/api/endpoints/${endpoint.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Endpoint deleted successfully');
    });

    it('should return 404 for non-existent endpoint', async () => {
      const response = await request(app)
        .delete('/api/endpoints/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Endpoint not found');
    });
  });

  describe('POST /api/endpoints/:id/token', () => {
    it('should generate PAT token for endpoint', async () => {
      const endpoint = new Endpoint({
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      });

      // Add to storage
      const endpoints = require('../../src/routes/api').endpoints;
      if (endpoints) {
        endpoints.set(endpoint.id, endpoint);
      }

      // Mock token creation
      const mockTokenData = {
        token: 'test-token-123',
        endpointId: endpoint.id,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValue(mockTokenData);

      const response = await request(app)
        .post(`/api/endpoints/${endpoint.id}/token`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('test-token-123');
      expect(response.body.data.endpointId).toBe(endpoint.id);
      expect(tokenService.createPATToken).toHaveBeenCalledWith(endpoint.id, expect.any(Object));
    });

    it('should return 404 for non-existent endpoint', async () => {
      const response = await request(app)
        .post('/api/endpoints/non-existent-id/token')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Endpoint not found');
    });
  });

  describe('GET /api/endpoints/:id/token', () => {
    it('should return token info for endpoint', async () => {
      const endpoint = new Endpoint({
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      });

      // Add to storage
      const endpoints = require('../../src/routes/api').endpoints;
      if (endpoints) {
        endpoints.set(endpoint.id, endpoint);
      }

      // Mock token data
      const mockTokenData = {
        token: 'test-token-123',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        usageCount: 5,
        isActive: true
      };
      tokenService.getTokenByEndpointId.mockReturnValue(mockTokenData);

      const response = await request(app)
        .get(`/api/endpoints/${endpoint.id}/token`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('test-token-123');
      expect(response.body.data.usageCount).toBe(5);
      expect(tokenService.getTokenByEndpointId).toHaveBeenCalledWith(endpoint.id);
    });

    it('should return 404 when no token exists', async () => {
      const endpoint = new Endpoint({
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      });

      // Add to storage
      const endpoints = require('../../src/routes/api').endpoints;
      if (endpoints) {
        endpoints.set(endpoint.id, endpoint);
      }

      tokenService.getTokenByEndpointId.mockReturnValue(null);

      const response = await request(app)
        .get(`/api/endpoints/${endpoint.id}/token`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No token found for this endpoint');
    });
  });

  describe('GET /api/tokens', () => {
    it('should return all tokens', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          token: 'test-token-1',
          endpointId: 'endpoint-1',
          createdAt: new Date().toISOString(),
          isActive: true
        },
        {
          id: 'token-2',
          token: 'test-token-2',
          endpointId: 'endpoint-2',
          createdAt: new Date().toISOString(),
          isActive: true
        }
      ];

      tokenService.getAllTokens.mockReturnValue(mockTokens);

      const response = await request(app)
        .get('/api/tokens')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTokens);
      expect(response.body.count).toBe(2);
    });
  });

  describe('GET /api/stats', () => {
    it('should return service statistics', async () => {
      const mockTokenStats = {
        total: 10,
        active: 8,
        revoked: 2,
        totalUsage: 1500
      };

      tokenService.getTokenStats.mockReturnValue(mockTokenStats);

      // Mock endpoints storage
      const endpoints = require('../../src/routes/api').endpoints;
      if (endpoints) {
        const endpoint1 = new Endpoint({ name: 'Test 1', type: 'query', target: 'SELECT 1', method: 'GET' });
        const endpoint2 = new Endpoint({ name: 'Test 2', type: 'query', target: 'SELECT 2', method: 'GET' });
        endpoint2.isActive = false;
        endpoints.set(endpoint1.id, endpoint1);
        endpoints.set(endpoint2.id, endpoint2);
      }

      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints.total).toBe(2);
      expect(response.body.data.endpoints.active).toBe(1);
      expect(response.body.data.endpoints.inactive).toBe(1);
      expect(response.body.data.tokens).toEqual(mockTokenStats);
    });
  });
});
