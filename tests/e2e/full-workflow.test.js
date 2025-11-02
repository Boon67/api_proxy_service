const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../backend/src/routes/api');
const proxyRoutes = require('../../backend/src/routes/proxy');
const authRoutes = require('../../backend/src/routes/auth');
const Endpoint = require('../../backend/src/models/Endpoint');
const tokenService = require('../../backend/src/services/tokenService');

// Mock the services
jest.mock('../../backend/src/services/tokenService');
jest.mock('../../backend/src/services/snowflakeService');

const app = express();
app.use(express.json());

// Mock authentication middleware for API routes
app.use('/api', (req, res, next) => {
  req.user = { username: 'test-user', id: 'user-123' };
  next();
});

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/proxy', proxyRoutes);

describe('End-to-End Workflow Tests', () => {
  beforeEach(() => {
    // Clear endpoints storage
    const endpoints = require('../../backend/src/routes/api').endpoints;
    if (endpoints && endpoints.clear) {
      endpoints.clear();
    }
    
    // Reset token service
    tokenService.tokens.clear();
  });

  describe('Complete API Proxy Workflow', () => {
    it('should handle complete workflow: login -> create endpoint -> generate token -> use proxy', async () => {
      // 1. Login (mock)
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.token).toBeDefined();

      // 2. Create query endpoint
      const queryEndpointData = {
        name: 'Get User by ID',
        type: 'query',
        target: 'SELECT * FROM users WHERE id = ?',
        method: 'GET',
        description: 'Retrieve user information by ID',
        parameters: [
          { name: 'userId', type: 'string', required: true, description: 'User ID' }
        ],
        rateLimit: 100
      };

      const createQueryResponse = await request(app)
        .post('/api/endpoints')
        .send(queryEndpointData)
        .expect(201);

      expect(createQueryResponse.body.success).toBe(true);
      const queryEndpointId = createQueryResponse.body.data.id;

      // 3. Create stored procedure endpoint
      const procedureEndpointData = {
        name: 'Generate Report',
        type: 'stored_procedure',
        target: 'GENERATE_SALES_REPORT',
        method: 'POST',
        description: 'Generate sales report for date range',
        parameters: [
          { name: 'startDate', type: 'date', required: true, description: 'Start date' },
          { name: 'endDate', type: 'date', required: true, description: 'End date' }
        ],
        rateLimit: 50
      };

      const createProcedureResponse = await request(app)
        .post('/api/endpoints')
        .send(procedureEndpointData)
        .expect(201);

      expect(createProcedureResponse.body.success).toBe(true);
      const procedureEndpointId = createProcedureResponse.body.data.id;

      // 4. Create table endpoint
      const tableEndpointData = {
        name: 'Products Table',
        type: 'table',
        target: 'products',
        method: 'GET',
        description: 'Access products table data',
        rateLimit: 200
      };

      const createTableResponse = await request(app)
        .post('/api/endpoints')
        .send(tableEndpointData)
        .expect(201);

      expect(createTableResponse.body.success).toBe(true);
      const tableEndpointId = createTableResponse.body.data.id;

      // 5. Generate tokens for all endpoints
      const mockTokens = {
        query: { token: 'query-token-123', endpointId: queryEndpointId },
        procedure: { token: 'procedure-token-456', endpointId: procedureEndpointId },
        table: { token: 'table-token-789', endpointId: tableEndpointId }
      };

      tokenService.createPATToken
        .mockReturnValueOnce(mockTokens.query)
        .mockReturnValueOnce(mockTokens.procedure)
        .mockReturnValueOnce(mockTokens.table);

      // Generate query token
      const queryTokenResponse = await request(app)
        .post(`/api/endpoints/${queryEndpointId}/token`)
        .expect(200);

      expect(queryTokenResponse.body.data.token).toBe('query-token-123');

      // Generate procedure token
      const procedureTokenResponse = await request(app)
        .post(`/api/endpoints/${procedureEndpointId}/token`)
        .expect(200);

      expect(procedureTokenResponse.body.data.token).toBe('procedure-token-456');

      // Generate table token
      const tableTokenResponse = await request(app)
        .post(`/api/endpoints/${tableEndpointId}/token`)
        .expect(200);

      expect(tableTokenResponse.body.data.token).toBe('table-token-789');

      // 6. Test proxy endpoints
      const snowflakeService = require('../../backend/src/services/snowflakeService');
      
      // Mock Snowflake responses
      const mockUserData = [{ id: 'user123', name: 'John Doe', email: 'john@example.com' }];
      const mockReportData = [{ reportId: 'rpt001', totalSales: 50000, period: '2024-01' }];
      const mockProductData = [
        { id: 1, name: 'Product 1', price: 29.99 },
        { id: 2, name: 'Product 2', price: 39.99 }
      ];

      snowflakeService.createConnection.mockResolvedValue({
        destroy: jest.fn()
      });

      snowflakeService.executeQuery
        .mockResolvedValueOnce({ rows: mockUserData, rowCount: 1 })
        .mockResolvedValueOnce({ rows: mockProductData, rowCount: 2 });

      snowflakeService.executeStoredProcedure
        .mockResolvedValueOnce({ rows: mockReportData, rowCount: 1 });

      // Mock token validation
      tokenService.validatePATToken
        .mockReturnValueOnce({ endpointId: queryEndpointId, usageCount: 1 })
        .mockReturnValueOnce({ endpointId: procedureEndpointId, usageCount: 1 })
        .mockReturnValueOnce({ endpointId: tableEndpointId, usageCount: 1 });

      // Test query proxy
      const queryProxyResponse = await request(app)
        .get('/proxy/query-token-123')
        .query({ userId: 'user123' })
        .expect(200);

      expect(queryProxyResponse.body.success).toBe(true);
      expect(queryProxyResponse.body.data).toEqual(mockUserData);
      expect(queryProxyResponse.body.metadata.endpoint).toBe('Get User by ID');
      expect(queryProxyResponse.body.metadata.type).toBe('query');

      // Test procedure proxy
      const procedureProxyResponse = await request(app)
        .post('/proxy/procedure-token-456')
        .send({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(procedureProxyResponse.body.success).toBe(true);
      expect(procedureProxyResponse.body.data).toEqual(mockReportData);
      expect(procedureProxyResponse.body.metadata.endpoint).toBe('Generate Report');
      expect(procedureProxyResponse.body.metadata.type).toBe('stored_procedure');

      // Test table proxy
      const tableProxyResponse = await request(app)
        .get('/proxy/table-token-789')
        .expect(200);

      expect(tableProxyResponse.body.success).toBe(true);
      expect(tableProxyResponse.body.data).toEqual(mockProductData);
      expect(tableProxyResponse.body.metadata.endpoint).toBe('Products Table');
      expect(tableProxyResponse.body.metadata.type).toBe('table');

      // 7. Verify token usage tracking
      expect(tokenService.validatePATToken).toHaveBeenCalledTimes(3);
    });

    it('should handle endpoint management workflow', async () => {
      // 1. Create initial endpoint
      const endpointData = {
        name: 'Initial Endpoint',
        type: 'query',
        target: 'SELECT * FROM initial',
        method: 'GET',
        description: 'Initial description',
        rateLimit: 50
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // 2. Get all endpoints
      const listResponse = await request(app)
        .get('/api/endpoints')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].name).toBe('Initial Endpoint');

      // 3. Get specific endpoint
      const getResponse = await request(app)
        .get(`/api/endpoints/${endpointId}`)
        .expect(200);

      expect(getResponse.body.data.id).toBe(endpointId);
      expect(getResponse.body.data.name).toBe('Initial Endpoint');

      // 4. Update endpoint
      const updateData = {
        name: 'Updated Endpoint',
        description: 'Updated description',
        rateLimit: 200
      };

      const updateResponse = await request(app)
        .put(`/api/endpoints/${endpointId}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.name).toBe('Updated Endpoint');
      expect(updateResponse.body.data.description).toBe('Updated description');
      expect(updateResponse.body.data.rateLimit).toBe(200);

      // 5. Generate token
      const mockTokenData = {
        token: 'test-token-123',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValue(mockTokenData);

      const tokenResponse = await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      expect(tokenResponse.body.data.token).toBe('test-token-123');

      // 6. Get token info
      const tokenInfoData = {
        token: 'test-token-123',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        usageCount: 5,
        isActive: true
      };
      tokenService.getTokenByEndpointId.mockReturnValue(tokenInfoData);

      const tokenInfoResponse = await request(app)
        .get(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      expect(tokenInfoResponse.body.data.token).toBe('test-token-123');
      expect(tokenInfoResponse.body.data.usageCount).toBe(5);

      // 7. Get all tokens
      const allTokensData = [tokenInfoData];
      tokenService.getAllTokens.mockReturnValue(allTokensData);

      const allTokensResponse = await request(app)
        .get('/api/tokens')
        .expect(200);

      expect(allTokensResponse.body.data).toHaveLength(1);
      expect(allTokensResponse.body.data[0].token).toBe('test-token-123');

      // 8. Get statistics
      const mockStats = {
        endpoints: { total: 1, active: 1, inactive: 0 },
        tokens: { total: 1, active: 1, revoked: 0, totalUsage: 5 }
      };
      tokenService.getTokenStats.mockReturnValue(mockStats.tokens);

      const statsResponse = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(statsResponse.body.data.endpoints.total).toBe(1);
      expect(statsResponse.body.data.tokens.total).toBe(1);

      // 9. Delete endpoint
      tokenService.revokePATToken.mockReturnValue(true);

      const deleteResponse = await request(app)
        .delete(`/api/endpoints/${endpointId}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(tokenService.revokePATToken).toHaveBeenCalledWith('test-token-123');

      // 10. Verify endpoint is deleted
      await request(app)
        .get(`/api/endpoints/${endpointId}`)
        .expect(404);
    });

    it('should handle error scenarios gracefully', async () => {
      // 1. Test invalid token in proxy
      tokenService.validatePATToken.mockReturnValue(null);

      const invalidTokenResponse = await request(app)
        .get('/proxy/invalid-token')
        .expect(401);

      expect(invalidTokenResponse.body.success).toBe(false);
      expect(invalidTokenResponse.body.error).toBe('Unauthorized');

      // 2. Test non-existent endpoint in proxy
      const orphanedTokenData = {
        token: 'orphaned-token',
        endpointId: 'non-existent-endpoint',
        createdAt: new Date().toISOString()
      };
      tokenService.validatePATToken.mockReturnValue(orphanedTokenData);

      const orphanedTokenResponse = await request(app)
        .get('/proxy/orphaned-token')
        .expect(404);

      expect(orphanedTokenResponse.body.success).toBe(false);
      expect(orphanedTokenResponse.body.error).toBe('Not Found');

      // 3. Test Snowflake connection error
      const endpointData = {
        name: 'Failing Endpoint',
        type: 'query',
        target: 'SELECT * FROM failing',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      const tokenData = {
        token: 'failing-token',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValue(tokenData);
      tokenService.validatePATToken.mockReturnValue({
        endpointId: endpointId,
        usageCount: 1
      });

      await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      const snowflakeService = require('../../backend/src/services/snowflakeService');
      snowflakeService.createConnection.mockRejectedValue(new Error('Snowflake connection failed'));

      const snowflakeErrorResponse = await request(app)
        .get('/proxy/failing-token')
        .expect(500);

      expect(snowflakeErrorResponse.body.success).toBe(false);
      expect(snowflakeErrorResponse.body.error).toBe('Execution failed');
      expect(snowflakeErrorResponse.body.message).toBe('Snowflake connection failed');
    });

    it('should handle concurrent requests', async () => {
      // Create endpoint
      const endpointData = {
        name: 'Concurrent Test',
        type: 'query',
        target: 'SELECT * FROM concurrent',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // Generate token
      const tokenData = {
        token: 'concurrent-token',
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      };
      tokenService.createPATToken.mockReturnValue(tokenData);
      tokenService.validatePATToken.mockReturnValue({
        endpointId: endpointId,
        usageCount: 1
      });

      await request(app)
        .post(`/api/endpoints/${endpointId}/token`)
        .expect(200);

      // Mock Snowflake service
      const snowflakeService = require('../../backend/src/services/snowflakeService');
      snowflakeService.createConnection.mockResolvedValue({
        destroy: jest.fn()
      });

      const mockData = [{ id: 1, name: 'Concurrent Result' }];
      snowflakeService.executeQuery.mockResolvedValue({
        rows: mockData,
        rowCount: 1
      });

      // Make concurrent requests
      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app)
          .get('/proxy/concurrent-token')
          .expect(200)
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockData);
      });

      // Token should be validated for each request
      expect(tokenService.validatePATToken).toHaveBeenCalledTimes(5);
    });
  });
});
