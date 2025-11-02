const snowflake = require('snowflake-sdk');
const fs = require('fs');
const logger = require('../utils/logger');

class SnowflakeService {
  constructor() {
    this.connections = new Map();
    this.defaultConnection = null;
  }

  // Check if running in SPCS (Snowflake Container Services)
  isSPCS() {
    return !!process.env.SNOWFLAKE_HOST || fs.existsSync('/snowflake/session/token');
  }

  // Read OAuth token from Snowflake-provided file (when running in SPCS)
  getOAuthToken() {
    try {
      const tokenPath = '/snowflake/session/token';
      if (fs.existsSync(tokenPath)) {
        const token = fs.readFileSync(tokenPath, 'utf8').trim();
        logger.info('Using Snowflake OAuth token from /snowflake/session/token');
        return token;
      }
    } catch (error) {
      logger.warn('Could not read OAuth token from /snowflake/session/token:', error.message);
    }
    return null;
  }

  // Load Snowflake configuration, automatically detecting SPCS vs local environment
  loadConfig() {
    const path = require('path');
    const isSPCS = this.isSPCS();
    let config = {};

    if (isSPCS) {
      // Running in SPCS: Use OAuth token, load connection settings from env vars only
      logger.debug('Detected SPCS environment - using environment variables only');
      return {
        account: process.env.SNOWFLAKE_ACCOUNT,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE,
        database: process.env.SNOWFLAKE_DATABASE || 'API_PROXY',
        schema: process.env.SNOWFLAKE_SCHEMA || 'APP',
        role: process.env.SNOWFLAKE_ROLE || 'API_PROXY_SERVICE_ROLE'
      };
    } else {
      // Running locally: Load config from snowflake.json file
      logger.debug('Detected local environment - loading from snowflake.json');
      try {
        // Try multiple possible paths for the config file
        const possiblePaths = [
          path.join(__dirname, '../../config/snowflake.json'),  // From backend/src/services/
          path.join(__dirname, '../../../config/snowflake.json'), // If running from backend/
          path.join(process.cwd(), 'config/snowflake.json'),      // From project root
          path.join(process.cwd(), '../config/snowflake.json')   // From backend/ directory
        ];
        
        let configFound = false;
        for (const configPath of possiblePaths) {
          const resolvedPath = path.resolve(configPath);
          if (fs.existsSync(resolvedPath)) {
            logger.info(`Loading Snowflake config from: ${resolvedPath}`);
            config = require(resolvedPath);
            configFound = true;
            break;
          }
        }
        
        if (!configFound) {
          logger.error('Snowflake config file not found in any of the expected locations:');
          possiblePaths.forEach(p => {
            const resolved = path.resolve(p);
            logger.error(`  - ${resolved} (exists: ${fs.existsSync(resolved)})`);
          });
          logger.warn('Using environment variables only - connection may fail!');
        } else {
          logger.debug(`Config loaded: account=${config.account ? '***' : 'missing'}, username=${config.username ? config.username : 'missing'}, hasPassword=${!!config.password}, hasToken=${!!config.token}`);
        }
      } catch (e) {
        logger.error('Error loading Snowflake config file:', e.message, e.stack);
      }

      return {
        account: process.env.SNOWFLAKE_ACCOUNT || config.account,
        username: process.env.SNOWFLAKE_USERNAME || config.username,
        password: process.env.SNOWFLAKE_PASSWORD || config.password,
        token: process.env.SNOWFLAKE_TOKEN || config.token, // PAT token for local dev
        warehouse: process.env.SNOWFLAKE_WAREHOUSE || config.warehouse,
        database: process.env.SNOWFLAKE_DATABASE || config.database || 'API_PROXY',
        schema: process.env.SNOWFLAKE_SCHEMA || config.schema || 'APP',
        role: process.env.SNOWFLAKE_ROLE || config.role || 'API_PROXY_SERVICE_ROLE'
      };
    }
  }

  async createConnection(config) {
    try {
      // Prefer OAuth token authentication when available (SPCS)
      const oauthToken = this.getOAuthToken();
      const snowflakeHost = process.env.SNOWFLAKE_HOST;
      const snowflakeAccount = process.env.SNOWFLAKE_ACCOUNT || config.account;

      let connectionConfig;

      // Detect if running in SPCS (Snowflake Container Services)
      const isSPCS = this.isSPCS();

      if (isSPCS && oauthToken) {
        // Use OAuth token authentication (recommended for SPCS)
        logger.info('Creating Snowflake connection using OAuth token (SPCS environment detected)');
        if (!snowflakeHost) {
          logger.warn('SNOWFLAKE_HOST not set, connection may fail');
        }
        connectionConfig = {
          host: snowflakeHost,
          account: snowflakeAccount,
          token: oauthToken,
          authenticator: 'oauth',
          warehouse: config.warehouse,
          database: config.database,
          schema: config.schema,
          role: config.role
        };
      } else if (config.username && config.token) {
        // Use PAT (Programmatic Access Token) authentication (preferred for local dev)
        // PAT tokens use OAuth authenticator, not SNOWFLAKE_JWT
        if (isSPCS) {
          logger.warn('Running in SPCS but OAuth token not available, falling back to PAT token');
        } else {
          logger.info('Creating Snowflake connection using PAT token (local environment)');
        }
        // For PAT tokens, Snowflake SDK requires specific format
        // PAT tokens are JWTs that use OAuth authenticator
        // Extract account identifier (remove .snowflakecomputing.com if present)
        let accountId = config.account;
        if (accountId && accountId.includes('.snowflakecomputing.com')) {
          accountId = accountId.replace('.snowflakecomputing.com', '');
        }
        
        // Verify token format (should be a JWT starting with 'snpat_' or 'eyJ')
        if (!config.token || (!config.token.startsWith('snpat_') && !config.token.startsWith('eyJ'))) {
          logger.warn('PAT token format may be incorrect. Expected format: snpat_... or JWT token');
        }
        
        connectionConfig = {
          account: accountId,
          username: config.username,
          token: config.token,
          authenticator: 'oauth',
          warehouse: config.warehouse,
          database: config.database,
          schema: config.schema,
          role: config.role,
          // Additional options that might help with PAT token authentication
          insecureConnect: false,
          ocspFailOpen: true
        };
      } else if (config.username && config.password) {
        // Fallback to username/password authentication (legacy support)
        if (isSPCS) {
          logger.warn('Running in SPCS but OAuth token not available, falling back to username/password');
        } else {
          logger.warn('Using username/password authentication (consider switching to PAT token)');
        }
        // Extract account identifier (remove .snowflakecomputing.com if present)
        let accountId = config.account;
        if (accountId && accountId.includes('.snowflakecomputing.com')) {
          accountId = accountId.replace('.snowflakecomputing.com', '');
        }
        logger.debug(`Extracted account ID: ${accountId} from ${config.account}`);
        connectionConfig = {
          account: accountId,
          username: config.username,
          password: config.password,
          warehouse: config.warehouse,
          database: config.database,
          schema: config.schema,
          role: config.role
        };
      } else {
        const errorMsg = isSPCS
          ? 'Missing OAuth token for SPCS. Expected /snowflake/session/token file or SNOWFLAKE_HOST environment variable.'
          : 'Missing authentication credentials. Need either PAT token (recommended) or username/password (local).';
        throw new Error(errorMsg);
      }

      const connection = snowflake.createConnection(connectionConfig);

      return new Promise((resolve, reject) => {
        connection.connect((err, conn) => {
          if (err) {
            logger.error('Snowflake connection error:', err);
            reject(err);
          } else {
            logger.info('Snowflake connection established');
            resolve(conn);
          }
        });
      });
    } catch (error) {
      logger.error('Error creating Snowflake connection:', error);
      throw error;
    }
  }

  async executeQuery(connection, query, binds = []) {
    return new Promise((resolve, reject) => {
      connection.execute({
        sqlText: query,
        binds: binds,
        complete: (err, stmt, rows) => {
          if (err) {
            logger.error('Query execution error:', err);
            reject(err);
          } else {
            logger.info(`Query executed successfully. Rows returned: ${rows ? rows.length : 0}`);
            resolve({
              rows: rows || [],
              statement: stmt,
              rowCount: rows ? rows.length : 0
            });
          }
        }
      });
    });
  }

  async executeStoredProcedure(connection, procedureName, parameters = []) {
    const query = `CALL ${procedureName}(${parameters.map(() => '?').join(', ')})`;
    return this.executeQuery(connection, query, parameters);
  }

  async executeFunction(connection, functionName, parameters = []) {
    const query = `SELECT ${functionName}(${parameters.map(() => '?').join(', ')})`;
    return this.executeQuery(connection, query, parameters);
  }

  async getTableData(connection, tableName, limit = 1000, offset = 0) {
    const query = `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`;
    return this.executeQuery(connection, query, [limit, offset]);
  }

  async testConnection(config) {
    try {
      const connection = await this.createConnection(config);
      await this.executeQuery(connection, 'SELECT 1 as test');
      connection.destroy();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      logger.error('Connection test failed:', error);
      return { success: false, message: error.message };
    }
  }

  async getTableSchema(connection, tableName) {
    const query = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = ? 
      ORDER BY ORDINAL_POSITION
    `;
    return this.executeQuery(connection, query, [tableName.toUpperCase()]);
  }

  async getAvailableTables(connection) {
    const query = `
      SELECT 
        TABLE_NAME,
        TABLE_TYPE,
        COMMENT
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = CURRENT_SCHEMA()
      ORDER BY TABLE_NAME
    `;
    return this.executeQuery(connection, query);
  }

  async getAvailableProcedures(connection) {
    const query = `
      SELECT 
        PROCEDURE_NAME,
        PROCEDURE_LANGUAGE,
        COMMENT
      FROM INFORMATION_SCHEMA.PROCEDURES 
      WHERE PROCEDURE_SCHEMA = CURRENT_SCHEMA()
      ORDER BY PROCEDURE_NAME
    `;
    return this.executeQuery(connection, query);
  }

  async getAvailableFunctions(connection) {
    const query = `
      SELECT 
        FUNCTION_NAME,
        FUNCTION_LANGUAGE,
        COMMENT
      FROM INFORMATION_SCHEMA.FUNCTIONS 
      WHERE FUNCTION_SCHEMA = CURRENT_SCHEMA()
      ORDER BY FUNCTION_NAME
    `;
    return this.executeQuery(connection, query);
  }
}

module.exports = new SnowflakeService();
