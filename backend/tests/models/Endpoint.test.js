const Endpoint = require('../../src/models/Endpoint');

describe('Endpoint Model', () => {
  describe('Constructor', () => {
    it('should create an endpoint with valid data', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        description: 'Test description',
        rateLimit: 100
      };

      const endpoint = new Endpoint(endpointData);

      expect(endpoint.name).toBe('Test Endpoint');
      expect(endpoint.type).toBe('query');
      expect(endpoint.target).toBe('SELECT * FROM users');
      expect(endpoint.method).toBe('GET');
      expect(endpoint.description).toBe('Test description');
      expect(endpoint.rateLimit).toBe(100);
      expect(endpoint.isActive).toBe(true);
      expect(endpoint.id).toBeDefined();
      expect(endpoint.createdAt).toBeDefined();
      expect(endpoint.updatedAt).toBeDefined();
    });

    it('should set default values for optional fields', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const endpoint = new Endpoint(endpointData);

      expect(endpoint.description).toBe('');
      expect(endpoint.parameters).toEqual([]);
      expect(endpoint.rateLimit).toBe(100);
      expect(endpoint.isActive).toBe(true);
      expect(endpoint.metadata).toEqual({});
    });
  });

  describe('Validation', () => {
    it('should validate successfully with valid data', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const endpoint = new Endpoint(endpointData);
      const errors = endpoint.validate();

      expect(errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const endpointData = {
        type: 'query',
        target: 'SELECT * FROM users'
      };

      const endpoint = new Endpoint(endpointData);
      const errors = endpoint.validate();

      expect(errors).toContain('Name is required');
      expect(errors).toContain('Method is required');
    });

    it('should return errors for invalid type', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'invalid_type',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const endpoint = new Endpoint(endpointData);
      const errors = endpoint.validate();

      expect(errors).toContain('Type must be one of: query, stored_procedure, function, table');
    });

    it('should return errors for invalid method', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'INVALID'
      };

      const endpoint = new Endpoint(endpointData);
      const errors = endpoint.validate();

      expect(errors).toContain('Method must be one of: GET, POST, PUT, DELETE');
    });

    it('should return errors for invalid rate limit', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        rateLimit: -1
      };

      const endpoint = new Endpoint(endpointData);
      const errors = endpoint.validate();

      expect(errors).toContain('Rate limit must be a positive number');
    });

    it('should return errors for invalid parameters', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        parameters: 'not_an_array'
      };

      const endpoint = new Endpoint(endpointData);
      const errors = endpoint.validate();

      expect(errors).toContain('Parameters must be an array');
    });
  });

  describe('Update', () => {
    it('should update allowed fields', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const endpoint = new Endpoint(endpointData);
      const originalUpdatedAt = endpoint.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        endpoint.update({
          name: 'Updated Endpoint',
          description: 'Updated description',
          rateLimit: 200
        });

        expect(endpoint.name).toBe('Updated Endpoint');
        expect(endpoint.description).toBe('Updated description');
        expect(endpoint.rateLimit).toBe(200);
        expect(endpoint.updatedAt).not.toBe(originalUpdatedAt);
      }, 10);
    });

    it('should not update non-allowed fields', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const endpoint = new Endpoint(endpointData);
      const originalId = endpoint.id;
      const originalCreatedAt = endpoint.createdAt;

      endpoint.update({
        id: 'new-id',
        createdAt: 'new-date',
        invalidField: 'value'
      });

      expect(endpoint.id).toBe(originalId);
      expect(endpoint.createdAt).toBe(originalCreatedAt);
      expect(endpoint.invalidField).toBeUndefined();
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        description: 'Test description',
        rateLimit: 100,
        parameters: [{ name: 'id', type: 'string', required: true }]
      };

      const endpoint = new Endpoint(endpointData);
      const json = endpoint.toJSON();

      expect(json).toEqual({
        id: endpoint.id,
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        description: 'Test description',
        rateLimit: 100,
        parameters: [{ name: 'id', type: 'string', required: true }],
        isActive: true,
        createdAt: endpoint.createdAt,
        updatedAt: endpoint.updatedAt,
        createdBy: undefined,
        metadata: {}
      });
    });

    it('should create from JSON correctly', () => {
      const jsonData = {
        id: 'test-id',
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET',
        description: 'Test description',
        rateLimit: 100,
        isActive: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'admin'
      };

      const endpoint = Endpoint.fromJSON(jsonData);

      expect(endpoint.id).toBe('test-id');
      expect(endpoint.name).toBe('Test Endpoint');
      expect(endpoint.type).toBe('query');
      expect(endpoint.target).toBe('SELECT * FROM users');
      expect(endpoint.method).toBe('GET');
      expect(endpoint.description).toBe('Test description');
      expect(endpoint.rateLimit).toBe(100);
      expect(endpoint.isActive).toBe(false);
      expect(endpoint.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(endpoint.updatedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(endpoint.createdBy).toBe('admin');
    });
  });
});
