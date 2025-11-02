import axios from 'axios';
import { apiService } from '../api';

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('test-token');
  });

  describe('login', () => {
    it('should make login request with correct data', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'jwt-token',
            user: { username: 'testuser', id: '123' }
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await apiService.login('testuser', 'password');

      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: 'password'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle login failure', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Invalid credentials'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await apiService.login('testuser', 'wrongpassword');

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('verifyToken', () => {
    it('should make verify token request', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { user: { username: 'testuser', id: '123' } }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.verifyToken();

      expect(mockedAxios.get).toHaveBeenCalledWith('/auth/verify');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getEndpoints', () => {
    it('should make get endpoints request', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', name: 'Test Endpoint' }
          ],
          count: 1
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getEndpoints();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/endpoints');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getEndpoint', () => {
    it('should make get endpoint request with id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', name: 'Test Endpoint' }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getEndpoint('1');

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/endpoints/1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('createEndpoint', () => {
    it('should make create endpoint request with data', async () => {
      const endpointData = {
        name: 'Test Endpoint',
        type: 'query',
        target: 'SELECT * FROM users',
        method: 'GET'
      };

      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', ...endpointData }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await apiService.createEndpoint(endpointData);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/endpoints', endpointData);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('updateEndpoint', () => {
    it('should make update endpoint request with id and data', async () => {
      const updateData = {
        name: 'Updated Endpoint'
      };

      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', ...updateData }
        }
      };

      mockedAxios.put.mockResolvedValue(mockResponse);

      const result = await apiService.updateEndpoint('1', updateData);

      expect(mockedAxios.put).toHaveBeenCalledWith('/api/endpoints/1', updateData);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('deleteEndpoint', () => {
    it('should make delete endpoint request with id', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Endpoint deleted successfully'
        }
      };

      mockedAxios.delete.mockResolvedValue(mockResponse);

      const result = await apiService.deleteEndpoint('1');

      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/endpoints/1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('generateToken', () => {
    it('should make generate token request with endpoint id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'pat-token',
            endpointId: '1',
            createdAt: '2024-01-01T00:00:00.000Z'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await apiService.generateToken('1');

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/endpoints/1/api_key');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getToken', () => {
    it('should make get token request with endpoint id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'pat-token',
            createdAt: '2024-01-01T00:00:00.000Z',
            usageCount: 5
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getToken('1');

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/endpoints/1/api_key');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getTokens', () => {
    it('should make get tokens request', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', token: 'pat-token-1' },
            { id: '2', token: 'pat-token-2' }
          ],
          count: 2
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getTokens();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/tokens');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getStats', () => {
    it('should make get stats request', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            endpoints: { total: 5, active: 4, inactive: 1 },
            tokens: { total: 10, active: 8, revoked: 2, totalUsage: 1500 }
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getStats();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/stats');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getHealth', () => {
    it('should make get health request', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getHealth();

      expect(mockedAxios.get).toHaveBeenCalledWith('/health');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('testConnection', () => {
    it('should make test connection request with config', async () => {
      const config = {
        account: 'test-account',
        username: 'test-user',
        password: 'test-password'
      };

      const mockResponse = {
        data: {
          success: true,
          message: 'Connection successful'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await apiService.testConnection(config);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/test-connection', config);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getAvailableTables', () => {
    it('should make get available tables request', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { TABLE_NAME: 'users', TABLE_TYPE: 'BASE TABLE' },
            { TABLE_NAME: 'orders', TABLE_TYPE: 'BASE TABLE' }
          ]
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getAvailableTables();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/snowflake/tables');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getAvailableProcedures', () => {
    it('should make get available procedures request', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { PROCEDURE_NAME: 'GET_USER_DATA', PROCEDURE_LANGUAGE: 'SQL' },
            { PROCEDURE_NAME: 'UPDATE_USER', PROCEDURE_LANGUAGE: 'SQL' }
          ]
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getAvailableProcedures();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/snowflake/procedures');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getAvailableFunctions', () => {
    it('should make get available functions request', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { FUNCTION_NAME: 'CALCULATE_TOTAL', FUNCTION_LANGUAGE: 'SQL' },
            { FUNCTION_NAME: 'FORMAT_DATE', FUNCTION_LANGUAGE: 'SQL' }
          ]
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await apiService.getAvailableFunctions();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/snowflake/functions');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('testProxyEndpoint', () => {
    it('should make test proxy endpoint request with GET method', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [{ id: 1, name: 'John' }]
        }
      };

      mockedAxios.mockResolvedValue(mockResponse);

      const result = await apiService.testProxyEndpoint('test-token', 'GET');

      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'get',
        url: '/proxy/test-token'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should make test proxy endpoint request with POST method and data', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [{ result: 'success' }]
        }
      };

      const testData = { parameters: ['param1', 'param2'] };

      mockedAxios.mockResolvedValue(mockResponse);

      const result = await apiService.testProxyEndpoint('test-token', 'POST', testData);

      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'post',
        url: '/proxy/test-token',
        data: testData
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.get.mockRejectedValue(networkError);

      await expect(apiService.getEndpoints()).rejects.toThrow('Network Error');
    });

    it('should handle 401 errors by redirecting to login', async () => {
      const error = {
        response: {
          status: 401
        }
      };

      // Mock window.location
      delete window.location;
      window.location = { href: '' };

      mockedAxios.get.mockRejectedValue(error);

      await apiService.getEndpoints();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
      expect(window.location.href).toBe('/login');
    });
  });
});
