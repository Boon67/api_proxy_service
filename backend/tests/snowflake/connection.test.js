const snowflakeService = require('../../src/services/snowflakeService');

// Mock the snowflake-sdk
jest.mock('snowflake-sdk', () => ({
  createConnection: jest.fn(),
}));

const snowflake = require('snowflake-sdk');

describe('Snowflake Connection Tests', () => {
  let mockConnection;

  beforeEach(() => {
    mockConnection = {
      connect: jest.fn(),
      execute: jest.fn(),
      destroy: jest.fn(),
    };
    
    snowflake.createConnection.mockReturnValue(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Creation', () => {
    it('should create connection with valid config', async () => {
      const config = {
        account: 'test-account',
        username: 'test-user',
        password: 'test-password',
        warehouse: 'test-warehouse',
        database: 'test-database',
        schema: 'test-schema',
        role: 'test-role'
      };

      mockConnection.connect.mockImplementation((callback) => {
        callback(null, mockConnection);
      });

      const connection = await snowflakeService.createConnection(config);

      expect(snowflake.createConnection).toHaveBeenCalledWith(config);
      expect(mockConnection.connect).toHaveBeenCalled();
      expect(connection).toBe(mockConnection);
    });

    it('should handle connection errors', async () => {
      const config = {
        account: 'invalid-account',
        username: 'invalid-user',
        password: 'invalid-password',
        warehouse: 'invalid-warehouse',
        database: 'invalid-database',
        schema: 'invalid-schema',
        role: 'invalid-role'
      };

      const error = new Error('Authentication failed');
      mockConnection.connect.mockImplementation((callback) => {
        callback(error, null);
      });

      await expect(snowflakeService.createConnection(config)).rejects.toThrow('Authentication failed');
    });

    it('should handle missing required config fields', async () => {
      const incompleteConfig = {
        account: 'test-account',
        username: 'test-user'
        // Missing password, warehouse, etc.
      };

      mockConnection.connect.mockImplementation((callback) => {
        callback(new Error('Missing required configuration'), null);
      });

      await expect(snowflakeService.createConnection(incompleteConfig)).rejects.toThrow('Missing required configuration');
    });
  });

  describe('Query Execution', () => {
    beforeEach(() => {
      mockConnection.connect.mockImplementation((callback) => {
        callback(null, mockConnection);
      });
    });

    it('should execute SELECT query successfully', async () => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const binds = ['user123'];
      const expectedRows = [
        { id: 'user123', name: 'John Doe', email: 'john@example.com' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: query }, expectedRows);
      });

      const result = await snowflakeService.executeQuery(mockConnection, query, binds);

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: query,
        binds: binds,
        complete: expect.any(Function)
      });
      expect(result.rows).toEqual(expectedRows);
      expect(result.rowCount).toBe(1);
    });

    it('should execute INSERT query successfully', async () => {
      const query = 'INSERT INTO users (name, email) VALUES (?, ?)';
      const binds = ['Jane Doe', 'jane@example.com'];
      const expectedRows = [];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: query }, expectedRows);
      });

      const result = await snowflakeService.executeQuery(mockConnection, query, binds);

      expect(result.rows).toEqual(expectedRows);
      expect(result.rowCount).toBe(0);
    });

    it('should handle query execution errors', async () => {
      const query = 'INVALID SQL SYNTAX';
      const error = new Error('SQL compilation error');

      mockConnection.execute.mockImplementation((options) => {
        options.complete(error, null, null);
      });

      await expect(snowflakeService.executeQuery(mockConnection, query)).rejects.toThrow('SQL compilation error');
    });

    it('should handle empty result sets', async () => {
      const query = 'SELECT * FROM empty_table';
      const expectedRows = [];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: query }, expectedRows);
      });

      const result = await snowflakeService.executeQuery(mockConnection, query);

      expect(result.rows).toEqual(expectedRows);
      expect(result.rowCount).toBe(0);
    });

    it('should handle large result sets', async () => {
      const query = 'SELECT * FROM large_table';
      const expectedRows = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `User ${i}` }));

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: query }, expectedRows);
      });

      const result = await snowflakeService.executeQuery(mockConnection, query);

      expect(result.rows).toHaveLength(1000);
      expect(result.rowCount).toBe(1000);
    });
  });

  describe('Stored Procedure Execution', () => {
    beforeEach(() => {
      mockConnection.connect.mockImplementation((callback) => {
        callback(null, mockConnection);
      });
    });

    it('should execute stored procedure with parameters', async () => {
      const procedureName = 'GET_USER_DATA';
      const parameters = ['user123', '2024-01-01'];
      const expectedRows = [{ result: 'success', data: 'user data' }];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: `CALL ${procedureName}(?, ?)` }, expectedRows);
      });

      const result = await snowflakeService.executeStoredProcedure(mockConnection, procedureName, parameters);

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: `CALL ${procedureName}(?, ?)`,
        binds: parameters,
        complete: expect.any(Function)
      });
      expect(result.rows).toEqual(expectedRows);
    });

    it('should execute stored procedure without parameters', async () => {
      const procedureName = 'GET_SYSTEM_STATUS';
      const expectedRows = [{ status: 'healthy' }];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: `CALL ${procedureName}()` }, expectedRows);
      });

      const result = await snowflakeService.executeStoredProcedure(mockConnection, procedureName);

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: `CALL ${procedureName}()`,
        binds: [],
        complete: expect.any(Function)
      });
      expect(result.rows).toEqual(expectedRows);
    });

    it('should handle stored procedure errors', async () => {
      const procedureName = 'INVALID_PROCEDURE';
      const error = new Error('Procedure not found');

      mockConnection.execute.mockImplementation((options) => {
        options.complete(error, null, null);
      });

      await expect(snowflakeService.executeStoredProcedure(mockConnection, procedureName)).rejects.toThrow('Procedure not found');
    });
  });

  describe('Function Execution', () => {
    beforeEach(() => {
      mockConnection.connect.mockImplementation((callback) => {
        callback(null, mockConnection);
      });
    });

    it('should execute function with parameters', async () => {
      const functionName = 'CALCULATE_TOTAL';
      const parameters = [100, 0.1];
      const expectedRows = [{ result: 110 }];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: `SELECT ${functionName}(?, ?)` }, expectedRows);
      });

      const result = await snowflakeService.executeFunction(mockConnection, functionName, parameters);

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: `SELECT ${functionName}(?, ?)`,
        binds: parameters,
        complete: expect.any(Function)
      });
      expect(result.rows).toEqual(expectedRows);
    });

    it('should execute function without parameters', async () => {
      const functionName = 'GET_CURRENT_TIMESTAMP';
      const expectedRows = [{ result: '2024-01-01 12:00:00' }];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: `SELECT ${functionName}()` }, expectedRows);
      });

      const result = await snowflakeService.executeFunction(mockConnection, functionName);

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: `SELECT ${functionName}()`,
        binds: [],
        complete: expect.any(Function)
      });
      expect(result.rows).toEqual(expectedRows);
    });

    it('should handle function errors', async () => {
      const functionName = 'INVALID_FUNCTION';
      const error = new Error('Function not found');

      mockConnection.execute.mockImplementation((options) => {
        options.complete(error, null, null);
      });

      await expect(snowflakeService.executeFunction(mockConnection, functionName)).rejects.toThrow('Function not found');
    });
  });

  describe('Table Data Access', () => {
    beforeEach(() => {
      mockConnection.connect.mockImplementation((callback) => {
        callback(null, mockConnection);
      });
    });

    it('should get table data with limit and offset', async () => {
      const tableName = 'users';
      const limit = 10;
      const offset = 0;
      const expectedRows = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: `SELECT * FROM ${tableName} LIMIT ? OFFSET ?` }, expectedRows);
      });

      const result = await snowflakeService.getTableData(mockConnection, tableName, limit, offset);

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`,
        binds: [limit, offset],
        complete: expect.any(Function)
      });
      expect(result.rows).toEqual(expectedRows);
    });

    it('should get table data with default pagination', async () => {
      const tableName = 'products';
      const expectedRows = [{ id: 1, name: 'Product 1' }];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: `SELECT * FROM ${tableName} LIMIT ? OFFSET ?` }, expectedRows);
      });

      const result = await snowflakeService.getTableData(mockConnection, tableName);

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`,
        binds: [100, 0], // Default values
        complete: expect.any(Function)
      });
      expect(result.rows).toEqual(expectedRows);
    });

    it('should handle table access errors', async () => {
      const tableName = 'non_existent_table';
      const error = new Error('Table not found');

      mockConnection.execute.mockImplementation((options) => {
        options.complete(error, null, null);
      });

      await expect(snowflakeService.getTableData(mockConnection, tableName)).rejects.toThrow('Table not found');
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      const config = {
        account: 'test-account',
        username: 'test-user',
        password: 'test-password',
        warehouse: 'test-warehouse',
        database: 'test-database',
        schema: 'test-schema',
        role: 'test-role'
      };

      mockConnection.connect.mockImplementation((callback) => {
        callback(null, mockConnection);
      });

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: 'SELECT 1 as test' }, [{ test: 1 }]);
      });

      const result = await snowflakeService.testConnection(config);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
      expect(mockConnection.destroy).toHaveBeenCalled();
    });

    it('should handle connection test failure', async () => {
      const config = {
        account: 'invalid-account',
        username: 'invalid-user',
        password: 'invalid-password',
        warehouse: 'invalid-warehouse',
        database: 'invalid-database',
        schema: 'invalid-schema',
        role: 'invalid-role'
      };

      mockConnection.connect.mockImplementation((callback) => {
        callback(new Error('Authentication failed'), null);
      });

      const result = await snowflakeService.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication failed');
    });

    it('should handle query execution failure in test', async () => {
      const config = {
        account: 'test-account',
        username: 'test-user',
        password: 'test-password',
        warehouse: 'test-warehouse',
        database: 'test-database',
        schema: 'test-schema',
        role: 'test-role'
      };

      mockConnection.connect.mockImplementation((callback) => {
        callback(null, mockConnection);
      });

      mockConnection.execute.mockImplementation((options) => {
        options.complete(new Error('Query execution failed'), null, null);
      });

      const result = await snowflakeService.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Query execution failed');
      expect(mockConnection.destroy).toHaveBeenCalled();
    });
  });

  describe('Metadata Queries', () => {
    beforeEach(() => {
      mockConnection.connect.mockImplementation((callback) => {
        callback(null, mockConnection);
      });
    });

    it('should get table schema', async () => {
      const tableName = 'users';
      const expectedSchema = [
        { COLUMN_NAME: 'id', DATA_TYPE: 'NUMBER', IS_NULLABLE: 'NO' },
        { COLUMN_NAME: 'name', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES' },
        { COLUMN_NAME: 'email', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: expect.stringContaining('INFORMATION_SCHEMA.COLUMNS') }, expectedSchema);
      });

      const result = await snowflakeService.getTableSchema(mockConnection, tableName);

      expect(result.rows).toEqual(expectedSchema);
    });

    it('should get available tables', async () => {
      const expectedTables = [
        { TABLE_NAME: 'users', TABLE_TYPE: 'BASE TABLE', COMMENT: 'User table' },
        { TABLE_NAME: 'orders', TABLE_TYPE: 'BASE TABLE', COMMENT: 'Order table' },
        { TABLE_NAME: 'products', TABLE_TYPE: 'BASE TABLE', COMMENT: 'Product table' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: expect.stringContaining('INFORMATION_SCHEMA.TABLES') }, expectedTables);
      });

      const result = await snowflakeService.getAvailableTables(mockConnection);

      expect(result.rows).toEqual(expectedTables);
    });

    it('should get available procedures', async () => {
      const expectedProcedures = [
        { PROCEDURE_NAME: 'GET_USER_DATA', PROCEDURE_LANGUAGE: 'SQL', COMMENT: 'Get user data' },
        { PROCEDURE_NAME: 'UPDATE_USER', PROCEDURE_LANGUAGE: 'SQL', COMMENT: 'Update user' },
        { PROCEDURE_NAME: 'DELETE_USER', PROCEDURE_LANGUAGE: 'SQL', COMMENT: 'Delete user' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: expect.stringContaining('INFORMATION_SCHEMA.PROCEDURES') }, expectedProcedures);
      });

      const result = await snowflakeService.getAvailableProcedures(mockConnection);

      expect(result.rows).toEqual(expectedProcedures);
    });

    it('should get available functions', async () => {
      const expectedFunctions = [
        { FUNCTION_NAME: 'CALCULATE_TOTAL', FUNCTION_LANGUAGE: 'SQL', COMMENT: 'Calculate total' },
        { FUNCTION_NAME: 'FORMAT_DATE', FUNCTION_LANGUAGE: 'SQL', COMMENT: 'Format date' },
        { FUNCTION_NAME: 'GENERATE_UUID', FUNCTION_LANGUAGE: 'SQL', COMMENT: 'Generate UUID' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: expect.stringContaining('INFORMATION_SCHEMA.FUNCTIONS') }, expectedFunctions);
      });

      const result = await snowflakeService.getAvailableFunctions(mockConnection);

      expect(result.rows).toEqual(expectedFunctions);
    });
  });
});
