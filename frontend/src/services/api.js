import axios from 'axios';

// Use relative path for production (SPCS), absolute URL for local development
// In SPCS, nginx proxies /api/* to the backend, so relative paths work
// For local dev, use the full localhost URL
const getApiBaseUrl = () => {
  // If REACT_APP_API_URL is explicitly set, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // In production (SPCS), use relative path so nginx handles routing
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  // Local development
  return 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Auth endpoints
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  verifyToken: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  // Endpoint management
  getEndpoints: async () => {
    const response = await api.get('/api/endpoints');
    return response.data;
  },

  getEndpoint: async (id) => {
    const response = await api.get(`/api/endpoints/${id}`);
    return response.data;
  },

  createEndpoint: async (endpointData) => {
    const response = await api.post('/api/endpoints', endpointData);
    return response.data;
  },

  updateEndpoint: async (id, endpointData) => {
    const response = await api.put(`/api/endpoints/${id}`, endpointData);
    return response.data;
  },

  updateEndpointStatus: async (id, status) => {
    const response = await api.patch(`/api/endpoints/${id}/status`, { status });
    return response.data;
  },

  deleteEndpoint: async (id) => {
    const response = await api.delete(`/api/endpoints/${id}`);
    return response.data;
  },

  // Token management
  generateAPIKey: async (endpointId) => {
    const response = await api.post(`/api/endpoints/${endpointId}/token`);
    return response.data;
  },

  getAPIKey: async (endpointId) => {
    const response = await api.get(`/api/endpoints/${endpointId}/token`);
    return response.data;
  },

  getAPIKeys: async () => {
    const response = await api.get('/api/tokens');
    return response.data;
  },

  // Legacy method names for backward compatibility
  generateToken: async (endpointId) => {
    return apiService.generateAPIKey(endpointId);
  },

  getToken: async (endpointId) => {
    return apiService.getAPIKey(endpointId);
  },

  getTokens: async () => {
    return apiService.getAPIKeys();
  },

  // Statistics
  getStats: async () => {
    const response = await api.get('/api/stats');
    return response.data;
  },

  // Activity
  getActivity: async (limit = 20) => {
    const response = await api.get(`/api/activity?limit=${limit}`);
    return response.data;
  },

  // Endpoint usage statistics
  getEndpointUsage: async () => {
    const response = await api.get('/api/endpoints/usage');
    return response.data;
  },

  // Test target operation (without creating endpoint)
  testTarget: async (type, target, parameters = [], options = {}) => {
    const response = await api.post('/api/test-target', {
      type,
      target,
      parameters,
      limit: options.limit || 10,
      offset: options.offset || 0
    });
    return response.data;
  },

  // Test endpoint
  testEndpoint: async (endpointId, parameters = [], options = {}) => {
    const queryParams = new URLSearchParams();
    if (options.allowInactive) queryParams.append('allowInactive', 'true');
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.offset) queryParams.append('offset', options.offset);
    
    const url = `/api/endpoints/${endpointId}/test${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.post(url, { parameters });
    return response.data;
  },

  // System settings
  getSystemSettings: async () => {
    const response = await api.get('/api/settings');
    return response.data;
  },

  updateSystemSettings: async (settings) => {
    const response = await api.put('/api/settings', settings);
    return response.data;
  },

  // Health check
  getHealth: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  // Test Snowflake connection
  testConnection: async (config) => {
    const response = await api.post('/api/test-connection', config);
    return response.data;
  },

  // Test connection (no config needed - uses existing config)
  testConnectionStatus: async () => {
    const response = await api.get('/health/detailed');
    return response.data;
  },

  // Get available tables/procedures/functions
  getAvailableTables: async () => {
    const response = await api.get('/api/snowflake/tables');
    return response.data;
  },

  getAvailableProcedures: async () => {
    const response = await api.get('/api/snowflake/procedures');
    return response.data;
  },

  getAvailableFunctions: async () => {
    const response = await api.get('/api/snowflake/functions');
    return response.data;
  },

  // Test endpoint
  testEndpoint: async (endpointId, parameters = [], options = {}) => {
    const params = new URLSearchParams();
    if (options.allowInactive) params.append('allowInactive', 'true');
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);

    const url = `/api/endpoints/${endpointId}/test${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await api.post(url, { parameters });
    return response.data;
  },

  // Enable/disable endpoint
  updateEndpointStatus: async (endpointId, isActive) => {
    const response = await api.patch(`/api/endpoints/${endpointId}/status`, { isActive });
    return response.data;
  },

  // Proxy endpoints (for testing)
  testProxyEndpoint: async (token, method = 'GET', data = null) => {
    const config = {
      method: method.toLowerCase(),
      url: `/proxy/${token}`,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }

    const response = await api(config);
    return response.data;
  },

  // Tags
  getTags: async () => {
    const response = await api.get('/api/tags');
    return response.data;
  },

  createTag: async (tagData) => {
    const response = await api.post('/api/tags', tagData);
    return response.data;
  },

  updateTag: async (id, tagData) => {
    const response = await api.put(`/api/tags/${id}`, tagData);
    return response.data;
  },

  deleteTag: async (id) => {
    const response = await api.delete(`/api/tags/${id}`);
    return response.data;
  },

  setEndpointTags: async (endpointId, tagIds) => {
    const response = await api.put(`/api/endpoints/${endpointId}/tags`, { tagIds });
    return response.data;
  },

  setTokenTags: async (tokenId, tagIds) => {
    const response = await api.put(`/api/tokens/${tokenId}/tags`, { tagIds });
    return response.data;
  },
};

export default api;
