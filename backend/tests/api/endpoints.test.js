const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/routes/api');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = { username: 'test-user', id: 'user-123' };
  next();
});

describe('API Endpoints', () => {
  beforeEach(() => {
    // Clear endpoints storage
    const endpoints = require('../../src/routes/api').endpoints;
    if (endpoints && endpoints.clear) {
      endpoints.clear();
    }
  });

  describe('POST /api/endpoints', () => {
    it('should create query endpoint', async () => {
      const endpointData = {
        name: 'User Query',
        type: 'query',
        target: 'SELECT * FROM users WHERE id = ?',
        method: 'GET',
        description: 'Get user by ID',
        parameters: [
          { name: 'userId', type: 'string', required: true, description: 'User ID' }
        ],
        rateLimit: 100
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('User Query');
      expect(response.body.data.type).toBe('query');
      expect(response.body.data.target).toBe('SELECT * FROM users WHERE id = ?');
      expect(response.body.data.method).toBe('GET');
      expect(response.body.data.parameters).toHaveLength(1);
      expect(response.body.data.parameters[0].name).toBe('userId');
      expect(response.body.data.rateLimit).toBe(100);
      expect(response.body.data.isActive).toBe(true);
    });

    it('should create stored procedure endpoint', async () => {
      const endpointData = {
        name: 'Get Sales Report',
        type: 'stored_procedure',
        target: 'GET_SALES_REPORT',
        method: 'POST',
        description: 'Generate sales report',
        parameters: [
          { name: 'startDate', type: 'date', required: true, description: 'Start date' },
          { name: 'endDate', type: 'date', required: true, description: 'End date' }
        ],
        rateLimit: 50
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('stored_procedure');
      expect(response.body.data.target).toBe('GET_SALES_REPORT');
      expect(response.body.data.method).toBe('POST');
      expect(response.body.data.parameters).toHaveLength(2);
    });

    it('should create function endpoint', async () => {
      const endpointData = {
        name: 'Calculate Total',
        type: 'function',
        target: 'CALCULATE_TOTAL',
        method: 'POST',
        description: 'Calculate total amount',
        parameters: [
          { name: 'amount', type: 'number', required: true, description: 'Amount' },
          { name: 'taxRate', type: 'number', required: false, description: 'Tax rate' }
        ]
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('function');
      expect(response.body.data.target).toBe('CALCULATE_TOTAL');
    });

    it('should create table endpoint', async () => {
      const endpointData = {
        name: 'Users Table',
        type: 'table',
        target: 'users',
        method: 'GET',
        description: 'Access users table',
        rateLimit: 200
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('table');
      expect(response.body.data.target).toBe('users');
      expect(response.body.data.method).toBe('GET');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        type: 'query',
        target: 'SELECT * FROM users'
        // Missing name and method
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'name',
          message: 'Name is required'
        })
      );
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'method',
          message: 'Method is required'
        })
      );
    });

    it('should validate endpoint type', async () => {
      const invalidData = {
        name: 'Test',
        type: 'invalid_type',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate HTTP method', async () => {
      const invalidData = {
        name: 'Test',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'INVALID'
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate rate limit', async () => {
      const invalidData = {
        name: 'Test',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        rateLimit: -1
      };

      const response = await request(app)
        .post('/api/endpoints')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/endpoints', () => {
    it('should return empty list initially', async () => {
      const response = await request(app)
        .get('/api/endpoints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should return created endpoints', async () => {
      // Create test endpoints
      const endpoints = [
        {
          name: 'Endpoint 1',
          type: 'query',
          target: 'SELECT 1',
          method: 'GET'
        },
        {
          name: 'Endpoint 2',
          type: 'stored_procedure',
          target: 'PROC_1',
          method: 'POST'
        }
      ];

      for (const endpointData of endpoints) {
        await request(app)
          .post('/api/endpoints')
          .send(endpointData)
          .expect(201);
      }

      const response = await request(app)
        .get('/api/endpoints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(response.body.data[0].name).toBe('Endpoint 1');
      expect(response.body.data[1].name).toBe('Endpoint 2');
    });
  });

  describe('GET /api/endpoints/:id', () => {
    it('should return specific endpoint', async () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM test',
        method: 'GET',
        description: 'Test description'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/endpoints/${endpointId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(endpointId);
      expect(response.body.data.name).toBe('Test Endpoint');
      expect(response.body.data.description).toBe('Test description');
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
    it('should update endpoint', async () => {
      const endpointData = {
        name: 'Original Name',
        type: 'query',
        target: 'SELECT * FROM original',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
        rateLimit: 200
      };

      const response = await request(app)
        .put(`/api/endpoints/${endpointId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.rateLimit).toBe(200);
      expect(response.body.data.target).toBe('SELECT * FROM original'); // Should not change
    });

    it('should return 404 for non-existent endpoint', async () => {
      const updateData = { name: 'Updated Name' };

      const response = await request(app)
        .put('/api/endpoints/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Endpoint not found');
    });
  });

  describe('DELETE /api/endpoints/:id', () => {
    it('should delete endpoint', async () => {
      const endpointData = {
        name: 'To Delete',
        type: 'query',
        target: 'SELECT * FROM temp',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/endpoints/${endpointId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Endpoint deleted successfully');

      // Verify endpoint is deleted
      await request(app)
        .get(`/api/endpoints/${endpointId}`)
        .expect(404);
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
    it('should generate token for endpoint', async () => {
      const endpointData = {
        name: 'Token Test',
        type: 'query',
        target: 'SELECT * FROM test',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // Mock token service
      const tokenService = require('../../src/services/tokenService');
      const mockTokenData = {
        token: 'test-token-123',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValue(mockTokenData);

      const response = await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('test-token-123');
      expect(response.body.data.endpointId).toBe(endpointId);
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
    it('should return token info', async () => {
      const endpointData = {
        name: 'Token Info Test',
        type: 'query',
        target: 'SELECT * FROM test',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // Mock token service
      const tokenService = require('../../src/services/tokenService');
      const mockTokenData = {
        token: 'test-token-456',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        usageCount: 10,
        isActive: true
      };
      tokenService.getTokenByEndpointId.mockReturnValue(mockTokenData);

      const response = await request(app)
        .get(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('test-token-456');
      expect(response.body.data.usageCount).toBe(10);
    });

    it('should return 404 when no token exists', async () => {
      const endpointData = {
        name: 'No Token Test',
        type: 'query',
        target: 'SELECT * FROM test',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // Mock token service to return null
      const tokenService = require('../../src/services/tokenService');
      tokenService.getTokenByEndpointId.mockReturnValue(null);

      const response = await request(app)
        .get(`/api/endpoints/${endpointId}/token`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No token found for this endpoint');
    });
  });

  describe('GET /api/tokens', () => {
    it('should return all tokens', async () => {
      const tokenService = require('../../src/services/tokenService');
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
          isActive: false
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
      // Create test endpoints
      const endpoints = [
        { name: 'Active 1', type: 'query', target: 'SELECT 1', method: 'GET' },
        { name: 'Active 2', type: 'query', target: 'SELECT 2', method: 'GET' },
        { name: 'Inactive', type: 'query', target: 'SELECT 3', method: 'GET' }
      ];

      const createdEndpoints = [];
      for (const endpointData of endpoints) {
        const response = await request(app)
          .post('/api/endpoints')
          .send(endpointData)
          .expect(201);
        createdEndpoints.push(response.body.data);
      }

      // Deactivate one endpoint
      await request(app)
        .put(`/api/endpoints/${createdEndpoints[2].id}`)
        .send({ isActive: false })
        .expect(200);

      // Mock token statistics
      const tokenService = require('../../src/services/tokenService');
      const mockTokenStats = {
        total: 5,
        active: 4,
        revoked: 1,
        totalUsage: 1500
      };
      tokenService.getTokenStats.mockReturnValue(mockTokenStats);

      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints.total).toBe(3);
      expect(response.body.data.endpoints.active).toBe(2);
      expect(response.body.data.endpoints.inactive).toBe(1);
      expect(response.body.data.tokens).toEqual(mockTokenStats);
    });
  });
});
