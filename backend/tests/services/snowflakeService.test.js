const snowflakeService = require('../../src/services/snowflakeService');

// Mock the snowflake-sdk
jest.mock('snowflake-sdk', () => ({
  createConnection: jest.fn(),
}));

const snowflake = require('snowflake-sdk');

describe('SnowflakeService', () => {
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

  describe('createConnection', () => {
    it('should create a connection with valid config', async () => {
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

    it('should reject on connection error', async () => {
      const config = {
        account: 'test-account',
        username: 'test-user',
        password: 'test-password',
        warehouse: 'test-warehouse',
        database: 'test-database',
        schema: 'test-schema',
        role: 'test-role'
      };

      const error = new Error('Connection failed');
      mockConnection.connect.mockImplementation((callback) => {
        callback(error, null);
      });

      await expect(snowflakeService.createConnection(config)).rejects.toThrow('Connection failed');
    });
  });

  describe('executeQuery', () => {
    it('should execute a query successfully', async () => {
      const query = 'SELECT * FROM users';
      const binds = ['param1', 'param2'];
      const expectedRows = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];

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
      expect(result.rowCount).toBe(2);
    });

    it('should handle query execution error', async () => {
      const query = 'INVALID SQL';
      const error = new Error('SQL execution failed');

      mockConnection.execute.mockImplementation((options) => {
        options.complete(error, null, null);
      });

      await expect(snowflakeService.executeQuery(mockConnection, query)).rejects.toThrow('SQL execution failed');
    });
  });

  describe('executeStoredProcedure', () => {
    it('should execute a stored procedure successfully', async () => {
      const procedureName = 'GET_USER_DATA';
      const parameters = ['user123', '2024-01-01'];
      const expectedRows = [{ result: 'success' }];

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
  });

  describe('executeFunction', () => {
    it('should execute a function successfully', async () => {
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
  });

  describe('getTableData', () => {
    it('should get table data with limit and offset', async () => {
      const tableName = 'users';
      const limit = 10;
      const offset = 0;
      const expectedRows = [{ id: 1, name: 'John' }];

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
  });

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
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

    it('should return failure for invalid connection', async () => {
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
  });

  describe('getTableSchema', () => {
    it('should get table schema successfully', async () => {
      const tableName = 'users';
      const expectedSchema = [
        { COLUMN_NAME: 'id', DATA_TYPE: 'NUMBER', IS_NULLABLE: 'NO' },
        { COLUMN_NAME: 'name', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: expect.stringContaining('INFORMATION_SCHEMA.COLUMNS') }, expectedSchema);
      });

      const result = await snowflakeService.getTableSchema(mockConnection, tableName);

      expect(result.rows).toEqual(expectedSchema);
    });
  });

  describe('getAvailableTables', () => {
    it('should get available tables successfully', async () => {
      const expectedTables = [
        { TABLE_NAME: 'users', TABLE_TYPE: 'BASE TABLE', COMMENT: 'User table' },
        { TABLE_NAME: 'orders', TABLE_TYPE: 'BASE TABLE', COMMENT: 'Order table' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: expect.stringContaining('INFORMATION_SCHEMA.TABLES') }, expectedTables);
      });

      const result = await snowflakeService.getAvailableTables(mockConnection);

      expect(result.rows).toEqual(expectedTables);
    });
  });

  describe('getAvailableProcedures', () => {
    it('should get available procedures successfully', async () => {
      const expectedProcedures = [
        { PROCEDURE_NAME: 'GET_USER_DATA', PROCEDURE_LANGUAGE: 'SQL', COMMENT: 'Get user data' },
        { PROCEDURE_NAME: 'UPDATE_USER', PROCEDURE_LANGUAGE: 'SQL', COMMENT: 'Update user' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: expect.stringContaining('INFORMATION_SCHEMA.PROCEDURES') }, expectedProcedures);
      });

      const result = await snowflakeService.getAvailableProcedures(mockConnection);

      expect(result.rows).toEqual(expectedProcedures);
    });
  });

  describe('getAvailableFunctions', () => {
    it('should get available functions successfully', async () => {
      const expectedFunctions = [
        { FUNCTION_NAME: 'CALCULATE_TOTAL', FUNCTION_LANGUAGE: 'SQL', COMMENT: 'Calculate total' },
        { FUNCTION_NAME: 'FORMAT_DATE', FUNCTION_LANGUAGE: 'SQL', COMMENT: 'Format date' }
      ];

      mockConnection.execute.mockImplementation((options) => {
        options.complete(null, { sqlText: expect.stringContaining('INFORMATION_SCHEMA.FUNCTIONS') }, expectedFunctions);
      });

      const result = await snowflakeService.getAvailableFunctions(mockConnection);

      expect(result.rows).toEqual(expectedFunctions);
    });
  });
});
