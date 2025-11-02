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

  deleteEndpoint: async (id) => {
    const response = await api.delete(`/api/endpoints/${id}`);
    return response.data;
  },

  // Token management
  generateToken: async (endpointId) => {
    const response = await api.post(`/api/endpoints/${endpointId}/token`);
    return response.data;
  },

  getToken: async (endpointId) => {
    const response = await api.get(`/api/endpoints/${endpointId}/token`);
    return response.data;
  },

  getTokens: async () => {
    const response = await api.get('/api/tokens');
    return response.data;
  },

  // Statistics
  getStats: async () => {
    const response = await api.get('/api/stats');
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
};

export default api;
