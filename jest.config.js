module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/backend/tests/**/*.test.js',
    '**/frontend/src/**/__tests__/**/*.test.js',
    '**/frontend/src/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'backend/src/**/*.js',
    'frontend/src/**/*.{js,jsx}',
    '!backend/src/**/*.test.js',
    '!frontend/src/**/*.test.{js,jsx}',
    '!backend/src/**/__tests__/**',
    '!frontend/src/**/__tests__/**',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './backend/src/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './frontend/src/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // Module name mapping for frontend tests
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '^@components/(.*)$': '<rootDir>/frontend/src/components/$1',
    '^@services/(.*)$': '<rootDir>/frontend/src/services/$1',
    '^@contexts/(.*)$': '<rootDir>/frontend/src/contexts/$1',
    '^@utils/(.*)$': '<rootDir>/frontend/src/utils/$1'
  },
  
  // Transform configuration for frontend
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'json'],
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Performance testing
  maxWorkers: '50%',
  
  // Global variables
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // Test results processor
  testResultsProcessor: 'jest-sonar-reporter',
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
