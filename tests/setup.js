// Global test setup
const { TextEncoder, TextDecoder } = require('util');

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock console methods to reduce noise in tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock process.env for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SNOWFLAKE_ACCOUNT = 'test-account';
process.env.SNOWFLAKE_USERNAME = 'test-user';
process.env.SNOWFLAKE_PASSWORD = 'test-password';
process.env.SNOWFLAKE_WAREHOUSE = 'test-warehouse';
process.env.SNOWFLAKE_DATABASE = 'test-database';
process.env.SNOWFLAKE_SCHEMA = 'test-schema';
process.env.SNOWFLAKE_ROLE = 'test-role';

// Mock localStorage for frontend tests
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
});

// Mock fetch for frontend tests
global.fetch = jest.fn();

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock crypto for token generation
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  }
});

// Mock Date.now for consistent timestamps in tests
const mockDate = new Date('2024-01-01T00:00:00.000Z');
global.Date.now = jest.fn(() => mockDate.getTime());

// Mock setTimeout and setInterval for faster tests
jest.useFakeTimers();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global test utilities
global.testUtils = {
  // Create mock endpoint data
  createMockEndpoint: (overrides = {}) => ({
    name: 'Test Endpoint',
    type: 'query',
    target: 'SELECT * FROM test',
    method: 'GET',
    description: 'Test description',
    rateLimit: 100,
    parameters: [],
    isActive: true,
    ...overrides
  }),

  // Create mock token data
  createMockToken: (overrides = {}) => ({
    token: 'test-token-123',
    endpointId: 'test-endpoint-id',
    createdAt: new Date().toISOString(),
    lastUsed: null,
    usageCount: 0,
    isActive: true,
    ...overrides
  }),

  // Create mock user data
  createMockUser: (overrides = {}) => ({
    id: 'test-user-123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  // Create mock Snowflake response
  createMockSnowflakeResponse: (rows = [], rowCount = 0) => ({
    rows,
    rowCount,
    sqlText: 'SELECT * FROM test',
    statementId: 'test-statement-id'
  }),

  // Wait for async operations
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock successful API response
  mockApiSuccess: (data = {}) => ({
    success: true,
    data,
    message: 'Success'
  }),

  // Mock error API response
  mockApiError: (error = 'Test error', message = 'Test error message') => ({
    success: false,
    error,
    message
  })
};

// Performance testing utilities
global.performanceTest = {
  measureTime: (fn) => {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    return { result, duration };
  },

  measureMemory: () => {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024, // MB
      heapUsed: usage.heapUsed / 1024 / 1024, // MB
      external: usage.external / 1024 / 1024 // MB
    };
  }
};

// Security testing utilities
global.securityTest = {
  // Generate malicious input for testing
  generateMaliciousInput: () => ({
    sqlInjection: "'; DROP TABLE users; --",
    xss: '<script>alert("xss")</script>',
    pathTraversal: '../../../etc/passwd',
    commandInjection: '; rm -rf /',
    ldapInjection: '*)(uid=*))(|(uid=*',
    nosqlInjection: '{"$where": "this.password.match(/.*/)"}'
  }),

  // Test input sanitization
  testSanitization: (input, expectedOutput) => {
    // This would be implemented based on your sanitization logic
    return input === expectedOutput;
  }
};

console.log('Test setup completed');
