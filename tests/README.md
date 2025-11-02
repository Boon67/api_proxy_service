# Test Suite Documentation

This directory contains comprehensive tests for the Snowflake API Proxy Service.

## Test Structure

```
tests/
├── setup.js                    # Global test setup and configuration
├── unit/                       # Unit tests for individual components
│   ├── backend/               # Backend unit tests
│   └── frontend/              # Frontend unit tests
├── integration/               # Integration tests
├── e2e/                       # End-to-end tests
├── performance/               # Performance and load tests
├── security/                  # Security tests
├── api/                       # API endpoint tests
├── snowflake/                 # Snowflake-specific tests
└── README.md                  # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance

# Security tests
npm run test:security

# API tests
npm run test:api

# Snowflake tests
npm run test:snowflake
```

### Test Modes
```bash
# Watch mode (re-runs tests on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Backend tests only
npm run test:backend

# Frontend tests only
npm run test:frontend
```

## Test Categories

### 1. Unit Tests
- **Backend Models**: Test individual model classes and their methods
- **Services**: Test service layer functionality
- **Utilities**: Test helper functions and utilities
- **Frontend Components**: Test React components in isolation
- **Hooks**: Test custom React hooks
- **Contexts**: Test React context providers

### 2. Integration Tests
- **API Routes**: Test complete API endpoint workflows
- **Service Integration**: Test interaction between services
- **Database Integration**: Test data persistence and retrieval
- **Authentication Flow**: Test complete auth workflows

### 3. End-to-End Tests
- **Complete Workflows**: Test full user journeys
- **Cross-Service Communication**: Test frontend-backend integration
- **Error Scenarios**: Test error handling across the stack
- **Concurrent Operations**: Test system behavior under load

### 4. Performance Tests
- **Load Testing**: Test system under high load
- **Memory Usage**: Test for memory leaks
- **Response Times**: Test API response performance
- **Concurrent Requests**: Test handling of simultaneous requests

### 5. Security Tests
- **Authentication**: Test auth mechanisms
- **Authorization**: Test access control
- **Input Validation**: Test input sanitization
- **Token Security**: Test PAT and JWT security
- **SQL Injection**: Test SQL injection prevention
- **XSS Prevention**: Test cross-site scripting prevention

### 6. API Tests
- **Endpoint Creation**: Test API endpoint management
- **Token Management**: Test PAT token operations
- **Proxy Functionality**: Test proxy endpoint behavior
- **Error Handling**: Test API error responses

### 7. Snowflake Tests
- **Connection Management**: Test Snowflake connections
- **Query Execution**: Test SQL query execution
- **Stored Procedures**: Test stored procedure calls
- **Functions**: Test function execution
- **Table Access**: Test table data retrieval

## Test Configuration

### Jest Configuration
The test suite uses Jest with the following configuration:
- **Test Environment**: Node.js for backend, jsdom for frontend
- **Coverage Thresholds**: 80% minimum coverage
- **Timeout**: 30 seconds for long-running tests
- **Mocking**: Automatic mocking of external dependencies

### Test Setup
Global test setup includes:
- Environment variable configuration
- Mock implementations for external services
- Test utilities and helpers
- Performance measurement tools
- Security testing utilities

## Writing Tests

### Test Structure
```javascript
describe('Component Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Method/Feature Name', () => {
    it('should do something specific', () => {
      // Test implementation
    });
  });
});
```

### Best Practices
1. **Descriptive Test Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Structure tests with clear sections
3. **Single Responsibility**: Each test should test one thing
4. **Mock External Dependencies**: Mock external services and APIs
5. **Test Edge Cases**: Include tests for error conditions
6. **Clean Up**: Always clean up after tests

### Test Utilities
The test suite includes several utility functions:
- `testUtils.createMockEndpoint()`: Create mock endpoint data
- `testUtils.createMockToken()`: Create mock token data
- `testUtils.createMockUser()`: Create mock user data
- `performanceTest.measureTime()`: Measure execution time
- `securityTest.generateMaliciousInput()`: Generate test security inputs

## Coverage Reports

Coverage reports are generated in multiple formats:
- **HTML**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info`
- **JSON**: `coverage/coverage-final.json`
- **Text**: Console output

### Coverage Thresholds
- **Global**: 80% minimum coverage
- **Backend**: 85% minimum coverage
- **Frontend**: 75% minimum coverage

## Continuous Integration

The test suite is designed to run in CI/CD pipelines:
- **Linting**: ESLint checks before tests
- **Type Checking**: TypeScript type checking
- **Unit Tests**: Fast unit test execution
- **Integration Tests**: Service integration tests
- **E2E Tests**: Full workflow tests
- **Coverage**: Coverage report generation

## Debugging Tests

### Running Individual Tests
```bash
# Run specific test file
npm test -- tests/unit/backend/models/Endpoint.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create endpoint"

# Run tests in specific directory
npm test -- tests/unit/
```

### Debug Mode
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Verbose Output
```bash
# Run tests with verbose output
npm test -- --verbose
```

## Test Data

### Mock Data
Test data is generated using utility functions to ensure consistency and maintainability.

### Test Database
Tests use in-memory storage or mocked database connections to avoid external dependencies.

### Test Files
Test files are organized by feature and component for easy navigation and maintenance.

## Troubleshooting

### Common Issues
1. **Timeout Errors**: Increase test timeout for slow operations
2. **Mock Issues**: Ensure mocks are properly configured
3. **Environment Issues**: Check environment variable configuration
4. **Coverage Issues**: Ensure all code paths are tested

### Getting Help
- Check test output for specific error messages
- Review test configuration in `jest.config.js`
- Check global setup in `tests/setup.js`
- Review individual test files for implementation details

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Update this documentation if needed
5. Ensure tests pass in CI/CD pipeline
