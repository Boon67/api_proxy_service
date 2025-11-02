const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../backend/src/routes/api');
const proxyRoutes = require('../../backend/src/routes/proxy');
const Endpoint = require('../../backend/src/models/Endpoint');
const tokenService = require('../../backend/src/services/tokenService');

// Mock the services
jest.mock('../../backend/src/services/tokenService');
jest.mock('../../backend/src/services/snowflakeService');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use('/api', (req, res, next) => {
  req.user = { username: 'test-user', id: 'user-123' };
  next();
});

app.use('/api', apiRoutes);
app.use('/proxy', proxyRoutes);

describe('Performance Tests', () => {
  beforeEach(() => {
    // Clear endpoints storage
    const endpoints = require('../../backend/src/routes/api').endpoints;
    if (endpoints && endpoints.clear) {
      endpoints.clear();
    }
    
    // Reset token service
    tokenService.tokens.clear();
  });

  describe('Load Testing', () => {
    it('should handle high volume of endpoint creation', async () => {
      const startTime = Date.now();
      const endpointCount = 100;

      // Create many endpoints
      const createPromises = Array.from({ length: endpointCount }, (_, i) => {
        const endpointData = {
          name: `Performance Test Endpoint ${i}`,
          type: 'query',
          target: `SELECT * FROM test_table_${i}`,
          method: 'GET',
          description: `Performance test endpoint ${i}`,
          rateLimit: 100
        };

        return request(app)
          .post('/api/endpoints')
          .send(endpointData);
      });

      const responses = await Promise.all(createPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All endpoints should be created successfully
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Performance assertion: should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      console.log(`Created ${endpointCount} endpoints in ${duration}ms (${duration/endpointCount}ms per endpoint)`);
    });

    it('should handle high volume of token generation', async () => {
      // Create test endpoint
      const endpointData = {
        name: 'Token Performance Test',
        type: 'query',
        target: 'SELECT * FROM test',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // Mock token creation
      let tokenCounter = 0;
      tokenService.createPATToken.mockImplementation(() => ({
        token: `perf-token-${++tokenCounter}`,
        endpointId: endpointId,
        createdAt: new Date().toISOString()
      }));

      const startTime = Date.now();
      const tokenCount = 50;

      // Generate many tokens
      const tokenPromises = Array.from({ length: tokenCount }, () =>
        request(app)
          .post(`/api/endpoints/${endpointId}/token`)
      );

      const responses = await Promise.all(tokenPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All tokens should be generated successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance assertion
      expect(duration).toBeLessThan(3000); // 3 seconds

      console.log(`Generated ${tokenCount} tokens in ${duration}ms (${duration/tokenCount}ms per token)`);
    });

    it('should handle high volume of proxy requests', async () => {
      // Create endpoint
      const endpointData = {
        name: 'Proxy Performance Test',
        type: 'query',
        target: 'SELECT * FROM performance_test',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // Generate token
      const tokenData = {
        token: 'proxy-perf-token',
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

      const mockData = [{ id: 1, name: 'Performance Test Result' }];
      snowflakeService.executeQuery.mockResolvedValue({
        rows: mockData,
        rowCount: 1
      });

      const startTime = Date.now();
      const requestCount = 200;

      // Make many proxy requests
      const proxyPromises = Array.from({ length: requestCount }, () =>
        request(app)
          .get('/proxy/proxy-perf-token')
      );

      const responses = await Promise.all(proxyPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockData);
      });

      // Performance assertion
      expect(duration).toBeLessThan(10000); // 10 seconds

      console.log(`Processed ${requestCount} proxy requests in ${duration}ms (${duration/requestCount}ms per request)`);
    });

    it('should handle mixed workload efficiently', async () => {
      const startTime = Date.now();

      // Create multiple endpoints
      const endpointCount = 20;
      const endpoints = [];

      for (let i = 0; i < endpointCount; i++) {
        const endpointData = {
          name: `Mixed Workload Endpoint ${i}`,
          type: 'query',
          target: `SELECT * FROM mixed_test_${i}`,
          method: 'GET',
          rateLimit: 100
        };

        const response = await request(app)
          .post('/api/endpoints')
          .send(endpointData)
          .expect(201);

        endpoints.push(response.body.data);
      }

      // Generate tokens for all endpoints
      let tokenCounter = 0;
      tokenService.createPATToken.mockImplementation(() => ({
        token: `mixed-token-${++tokenCounter}`,
        endpointId: endpoints[tokenCounter - 1].id,
        createdAt: new Date().toISOString()
      }));

      const tokens = [];
      for (const endpoint of endpoints) {
        const tokenResponse = await request(app)
          .post(`/api/endpoints/${endpoint.id}/token`)
          .expect(200);
        tokens.push(tokenResponse.body.data.token);
      }

      // Mock Snowflake service
      const snowflakeService = require('../../backend/src/services/snowflakeService');
      snowflakeService.createConnection.mockResolvedValue({
        destroy: jest.fn()
      });

      const mockData = [{ id: 1, name: 'Mixed Workload Result' }];
      snowflakeService.executeQuery.mockResolvedValue({
        rows: mockData,
        rowCount: 1
      });

      // Mock token validation
      tokenService.validatePATToken.mockImplementation((token) => {
        const tokenIndex = tokens.indexOf(token);
        return {
          endpointId: endpoints[tokenIndex].id,
          usageCount: 1
        };
      });

      // Make proxy requests to all endpoints
      const proxyPromises = tokens.map(token =>
        request(app)
          .get(`/proxy/${token}`)
      );

      const proxyResponses = await Promise.all(proxyPromises);

      // All proxy requests should succeed
      proxyResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockData);
      });

      // Get statistics
      const statsResponse = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(statsResponse.body.data.endpoints.total).toBe(endpointCount);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertion
      expect(duration).toBeLessThan(15000); // 15 seconds

      console.log(`Mixed workload completed in ${duration}ms:`);
      console.log(`- Created ${endpointCount} endpoints`);
      console.log(`- Generated ${tokens.length} tokens`);
      console.log(`- Processed ${proxyResponses.length} proxy requests`);
      console.log(`- Average time per operation: ${duration/(endpointCount + tokens.length + proxyResponses.length)}ms`);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory with repeated operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        // Create endpoint
        const endpointData = {
          name: `Memory Test Endpoint ${i}`,
          type: 'query',
          target: `SELECT * FROM memory_test_${i}`,
          method: 'GET'
        };

        const createResponse = await request(app)
          .post('/api/endpoints')
          .send(endpointData)
          .expect(201);

        const endpointId = createResponse.body.data.id;

        // Generate token
        const tokenData = {
          token: `memory-token-${i}`,
          endpointId: endpointId,
          createdAt: new Date().toISOString()
        };
        tokenService.createPATToken.mockReturnValue(tokenData);

        await request(app)
          .post(`/api/endpoints/${endpointId}/token`)
          .expect(200);

        // Delete endpoint (cleanup)
        tokenService.revokePATToken.mockReturnValue(true);

        await request(app)
          .delete(`/api/endpoints/${endpointId}`)
          .expect(200);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory usage after 100 create/delete cycles:`);
      console.log(`- Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Concurrent Access Tests', () => {
    it('should handle concurrent endpoint creation', async () => {
      const concurrentCount = 20;
      const startTime = Date.now();

      const createPromises = Array.from({ length: concurrentCount }, (_, i) => {
        const endpointData = {
          name: `Concurrent Endpoint ${i}`,
          type: 'query',
          target: `SELECT * FROM concurrent_${i}`,
          method: 'GET'
        };

        return request(app)
          .post('/api/endpoints')
          .send(endpointData);
      });

      const responses = await Promise.all(createPromises);
      const endTime = Date.now();

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(3000); // 3 seconds

      console.log(`Created ${concurrentCount} endpoints concurrently in ${duration}ms`);
    });

    it('should handle concurrent proxy requests', async () => {
      // Create endpoint
      const endpointData = {
        name: 'Concurrent Proxy Test',
        type: 'query',
        target: 'SELECT * FROM concurrent_proxy',
        method: 'GET'
      };

      const createResponse = await request(app)
        .post('/api/endpoints')
        .send(endpointData)
        .expect(201);

      const endpointId = createResponse.body.data.id;

      // Generate token
      const tokenData = {
        token: 'concurrent-proxy-token',
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

      const concurrentCount = 50;
      const startTime = Date.now();

      const proxyPromises = Array.from({ length: concurrentCount }, () =>
        request(app)
          .get('/proxy/concurrent-proxy-token')
      );

      const responses = await Promise.all(proxyPromises);
      const endTime = Date.now();

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockData);
      });

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds

      console.log(`Processed ${concurrentCount} concurrent proxy requests in ${duration}ms`);
    });
  });
});
