const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/routes/api');
const proxyRoutes = require('../../src/routes/proxy');
const Endpoint = require('../../src/models/Endpoint');
const tokenService = require('../../src/services/tokenService');

// Mock the services
jest.mock('../../src/services/tokenService');
jest.mock('../../src/services/snowflakeService');

const app = express();
app.use(express.json());

// Mock authentication middleware for API routes
app.use('/api', (req, res, next) => {
  req.user = { username: 'test-user', id: 'user-123' };
  next();
});

app.use('/api', apiRoutes);
app.use('/proxy', proxyRoutes);

describe('API Integration Tests', () => {
  beforeEach(() => {
    // Clear endpoints storage
    const endpoints = require('../../src/routes/api').endpoints;
    if (endpoints && endpoints.clear) {
      endpoints.clear();
    }
    
    // Reset token service
    tokenService.tokens.clear();
  });

  describe('Complete Endpoint Workflow', () => {
    it('should create endpoint, generate token, and use proxy', async () => {
      // 1. Create endpoint
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

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      const endpointId = createResponse.body.data.id;

      // 2. Generate token for endpoint
      const mockTokenData = {
        token: 'test-pat-token-123',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValue(mockTokenData);

      const tokenResponse = await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      expect(tokenResponse.body.success).toBe(true);
      expect(tokenResponse.body.data.token).toBe('test-pat-token-123');

      // 3. Use proxy endpoint
      const mockSnowflakeResponse = {
        rows: [{ id: 1, name: 'John Doe', email: 'john@example.com' }],
        rowCount: 1
      };

      const snowflakeService = require('../../src/services/snowflakeService');
      snowflakeService.createConnection.mockResolvedValue({
        destroy: jest.fn()
      });
      snowflakeService.executeQuery.mockResolvedValue(mockSnowflakeResponse);

      // Mock token validation
      tokenService.validatePATToken.mockReturnValue({
        endpointId: endpointId,
        usageCount: 1,
        lastUsed: new Date().toISOString()
      });

      const proxyResponse = await request(app)
        .get('/proxy/test-pat-token-123')
        .expect(200);

      expect(proxyResponse.body.success).toBe(true);
      expect(proxyResponse.body.data).toEqual(mockSnowflakeResponse.rows);
      expect(proxyResponse.body.metadata.endpoint).toBe('User Query');
      expect(proxyResponse.body.metadata.type).toBe('query');
    });

    it('should handle endpoint update workflow', async () => {
      // 1. Create initial endpoint
      const initialData = {
        name: 'Initial Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        rateLimit: 50
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(initialData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // 2. Update endpoint
      const updateData = {
        name: 'Updated Endpoint',
        description: 'Updated description',
        rateLimit: 200
      };

      const updateResponse = await request(app)
        .put(`/api/endpoints/${endpointId}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.name).toBe('Updated Endpoint');
      expect(updateResponse.body.data.description).toBe('Updated description');
      expect(updateResponse.body.data.rateLimit).toBe(200);

      // 3. Verify update persisted
      const getResponse = await request(app)
        .get(`/api/endpoints/${endpointId}`)
        .expect(200);

      expect(getResponse.body.data.name).toBe('Updated Endpoint');
      expect(getResponse.body.data.description).toBe('Updated description');
      expect(getResponse.body.data.rateLimit).toBe(200);
    });

    it('should handle token management workflow', async () => {
      // 1. Create endpoint
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM test',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // 2. Generate first token
      const firstTokenData = {
        token: 'first-token-123',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValueOnce(firstTokenData);

      const firstTokenResponse = await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      expect(firstTokenResponse.body.data.token).toBe('first-token-123');

      // 3. Generate second token (should revoke first)
      const secondTokenData = {
        token: 'second-token-456',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValueOnce(secondTokenData);
      tokenService.revokePATToken.mockReturnValue(true);

      const secondTokenResponse = await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      expect(secondTokenResponse.body.data.token).toBe('second-token-456');
      expect(tokenService.revokePATToken).toHaveBeenCalledWith('first-token-123');

      // 4. Get token info
      const tokenInfoData = {
        token: 'second-token-456',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        usageCount: 5,
        isActive: true
      };
      tokenService.getTokenByEndpointId.mockReturnValue(tokenInfoData);

      const tokenInfoResponse = await request(app)
        .get(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      expect(tokenInfoResponse.body.data.token).toBe('second-token-456');
      expect(tokenInfoResponse.body.data.usageCount).toBe(5);
    });

    it('should handle endpoint deletion with token cleanup', async () => {
      // 1. Create endpoint
      const endpointData = {
        name: 'To Be Deleted',
        type: 'query',
        target: 'SELECT * FROM temp',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // 2. Generate token
      const tokenData = {
        token: 'temp-token-123',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValue(tokenData);
      tokenService.getTokenByEndpointId.mockReturnValue(tokenData);
      tokenService.revokePATToken.mockReturnValue(true);

      await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      // 3. Delete endpoint
      const deleteResponse = await request(app)
        .delete(`/api/endpoints/${endpointId}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(tokenService.revokePATToken).toHaveBeenCalledWith('temp-token-123');

      // 4. Verify endpoint is gone
      await request(app)
        .get(`/api/endpoints/${endpointId}`)
        .expect(404);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle Snowflake connection errors in proxy', async () => {
      // Create endpoint
      const endpointData = {
        name: 'Failing Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // Generate token
      const tokenData = {
        token: 'failing-token-123',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValue(tokenData);
      tokenService.validatePATToken.mockReturnValue({
        endpointId: endpointId,
        usageCount: 1,
        lastUsed: new Date().toISOString()
      });

      await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      // Mock Snowflake connection failure
      const snowflakeService = require('../../src/services/snowflakeService');
      snowflakeService.createConnection.mockRejectedValue(new Error('Snowflake connection failed'));

      const proxyResponse = await request(app)
        .get('/proxy/failing-token-123')
        .expect(500);

      expect(proxyResponse.body.success).toBe(false);
      expect(proxyResponse.body.error).toBe('Execution failed');
      expect(proxyResponse.body.message).toBe('Snowflake connection failed');
    });

    it('should handle invalid token in proxy', async () => {
      tokenService.validatePATToken.mockReturnValue(null);

      const proxyResponse = await request(app)
        .get('/proxy/invalid-token')
        .expect(401);

      expect(proxyResponse.body.success).toBe(false);
      expect(proxyResponse.body.error).toBe('Unauthorized');
      expect(proxyResponse.body.message).toBe('Invalid or expired PAT token');
    });

    it('should handle non-existent endpoint in proxy', async () => {
      const tokenData = {
        token: 'orphaned-token-123',
        endpointId: 'non-existent-endpoint',
        createdAt: new Date().toISOString()
      };
      tokenService.validatePATToken.mockReturnValue(tokenData);

      const proxyResponse = await request(app)
        .get('/proxy/orphaned-token-123')
        .expect(404);

      expect(proxyResponse.body.success).toBe(false);
      expect(proxyResponse.body.error).toBe('Not Found');
      expect(proxyResponse.body.message).toBe('Endpoint not found');
    });
  });

  describe('Statistics Integration', () => {
    it('should provide accurate statistics', async () => {
      // Create multiple endpoints
      const endpoints = [
        { name: 'Endpoint 1', type: 'query', target: 'SELECT 1', method: 'GET' },
        { name: 'Endpoint 2', type: 'query', target: 'SELECT 2', method: 'GET' },
        { name: 'Endpoint 3', type: 'query', target: 'SELECT 3', method: 'GET' }
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
      const mockTokenStats = {
        total: 5,
        active: 4,
        revoked: 1,
        totalUsage: 1500
      };
      tokenService.getTokenStats.mockReturnValue(mockTokenStats);

      // Get statistics
      const statsResponse = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data.endpoints.total).toBe(3);
      expect(statsResponse.body.data.endpoints.active).toBe(2);
      expect(statsResponse.body.data.endpoints.inactive).toBe(1);
      expect(statsResponse.body.data.tokens).toEqual(mockTokenStats);
    });
  });
});
