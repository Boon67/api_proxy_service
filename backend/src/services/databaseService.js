const snowflakeService = require('./snowflakeService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
  constructor() {
    this.connection = null;
    this.dbConfig = null;
  }

  async getConnection() {
    if (!this.connection) {
      // Use snowflakeService.loadConfig() to automatically detect SPCS vs local
      // and load appropriate configuration (OAuth token in SPCS, snowflake.json locally)
      this.dbConfig = snowflakeService.loadConfig();
      this.connection = await snowflakeService.createConnection(this.dbConfig);
    }
    return this.connection;
  }

  async executeQuery(sql, binds = []) {
    try {
      const connection = await this.getConnection();
      return await snowflakeService.executeQuery(connection, sql, binds);
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  // =====================================================
  // USER OPERATIONS
  // =====================================================

  async getUserByUsername(username) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT USER_ID, USERNAME, PASSWORD_HASH, EMAIL, ROLE, IS_ACTIVE, 
             CREATED_AT, UPDATED_AT, LAST_LOGIN, CREATED_BY
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
      WHERE USERNAME = ? AND IS_ACTIVE = TRUE
    `;
    const result = await this.executeQuery(sql, [username.toUpperCase()]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getUserById(userId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT USER_ID, USERNAME, PASSWORD_HASH, EMAIL, ROLE, IS_ACTIVE, 
             CREATED_AT, UPDATED_AT, LAST_LOGIN, CREATED_BY
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
      WHERE USER_ID = ?
    `;
    const result = await this.executeQuery(sql, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async updateUserLastLogin(username) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
      SET LAST_LOGIN = CURRENT_TIMESTAMP(),
          UPDATED_AT = CURRENT_TIMESTAMP()
      WHERE USERNAME = ?
    `;
    await this.executeQuery(sql, [username.toUpperCase()]);
  }

  async createUser(userData) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const userId = uuidv4();
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
        (USER_ID, USERNAME, PASSWORD_HASH, EMAIL, ROLE, IS_ACTIVE, CREATED_BY)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeQuery(sql, [
      userId,
      userData.username.toUpperCase(),
      userData.passwordHash,
      userData.email || null,
      userData.role || 'admin',
      userData.isActive !== false,
      userData.createdBy || 'system'
    ]);
    return await this.getUserById(userId);
  }

  // =====================================================
  // ENDPOINT OPERATIONS
  // =====================================================

  async getAllEndpoints() {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT ENDPOINT_ID, NAME, DESCRIPTION, TYPE, TARGET, METHOD, 
             PARAMETERS, RATE_LIMIT, IS_ACTIVE, CREATED_AT, UPDATED_AT, 
             CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
      ORDER BY CREATED_AT DESC
    `;
    const result = await this.executeQuery(sql);
    return result.rows.map(row => this.mapEndpointRow(row));
  }

  async getEndpointById(endpointId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT ENDPOINT_ID, NAME, DESCRIPTION, TYPE, TARGET, METHOD, 
             PARAMETERS, RATE_LIMIT, IS_ACTIVE, CREATED_AT, UPDATED_AT, 
             CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
      WHERE ENDPOINT_ID = ?
    `;
    const result = await this.executeQuery(sql, [endpointId]);
    return result.rows.length > 0 ? this.mapEndpointRow(result.rows[0]) : null;
  }

  async createEndpoint(endpointData) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const endpointId = uuidv4();
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
        (ENDPOINT_ID, NAME, DESCRIPTION, TYPE, TARGET, METHOD, PARAMETERS, 
         RATE_LIMIT, IS_ACTIVE, CREATED_BY, METADATA)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeQuery(sql, [
      endpointId,
      endpointData.name,
      endpointData.description || null,
      endpointData.type,
      endpointData.target,
      endpointData.method || 'GET',
      endpointData.parameters ? JSON.stringify(endpointData.parameters) : null,
      endpointData.rateLimit || 100,
      endpointData.isActive !== false,
      endpointData.createdBy || 'admin',
      endpointData.metadata ? JSON.stringify(endpointData.metadata) : null
    ]);
    return await this.getEndpointById(endpointId);
  }

  async updateEndpoint(endpointId, endpointData) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
      SET NAME = ?,
          DESCRIPTION = ?,
          TYPE = ?,
          TARGET = ?,
          METHOD = ?,
          PARAMETERS = ?,
          RATE_LIMIT = ?,
          IS_ACTIVE = ?,
          UPDATED_AT = CURRENT_TIMESTAMP(),
          METADATA = ?
      WHERE ENDPOINT_ID = ?
    `;
    await this.executeQuery(sql, [
      endpointData.name,
      endpointData.description || null,
      endpointData.type,
      endpointData.target,
      endpointData.method || 'GET',
      endpointData.parameters ? JSON.stringify(endpointData.parameters) : null,
      endpointData.rateLimit || 100,
      endpointData.isActive !== false,
      endpointData.metadata ? JSON.stringify(endpointData.metadata) : null,
      endpointId
    ]);
    return await this.getEndpointById(endpointId);
  }

  async deleteEndpoint(endpointId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
      WHERE ENDPOINT_ID = ?
    `;
    await this.executeQuery(sql, [endpointId]);
    return true;
  }

  mapEndpointRow(row) {
    return {
      id: row.ENDPOINT_ID,
      name: row.NAME,
      description: row.DESCRIPTION || '',
      type: row.TYPE,
      target: row.TARGET,
      method: row.METHOD,
      parameters: row.PARAMETERS ? (typeof row.PARAMETERS === 'string' ? JSON.parse(row.PARAMETERS) : row.PARAMETERS) : [],
      rateLimit: row.RATE_LIMIT,
      isActive: row.IS_ACTIVE,
      createdAt: row.CREATED_AT?.toISOString() || new Date().toISOString(),
      updatedAt: row.UPDATED_AT?.toISOString() || new Date().toISOString(),
      createdBy: row.CREATED_BY,
      metadata: row.METADATA ? (typeof row.METADATA === 'string' ? JSON.parse(row.METADATA) : row.METADATA) : {}
    };
  }

  // =====================================================
  // PAT TOKEN OPERATIONS
  // =====================================================

  async createPATToken(endpointId, tokenHash, metadata = {}) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const tokenId = uuidv4();
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
        (TOKEN_ID, TOKEN, ENDPOINT_ID, CREATED_BY, METADATA)
      VALUES (?, ?, ?, ?, ?)
    `;
    await this.executeQuery(sql, [
      tokenId,
      tokenHash,
      endpointId,
      metadata.createdBy || 'admin',
      metadata ? JSON.stringify(metadata) : null
    ]);
    return await this.getPATTokenById(tokenId);
  }

  async getPATTokenByHash(tokenHash) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT TOKEN_ID, TOKEN, ENDPOINT_ID, CREATED_AT, LAST_USED, 
             USAGE_COUNT, IS_ACTIVE, CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
      WHERE TOKEN = ? AND IS_ACTIVE = TRUE
    `;
    const result = await this.executeQuery(sql, [tokenHash]);
    return result.rows.length > 0 ? this.mapTokenRow(result.rows[0]) : null;
  }

  async getPATTokenById(tokenId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT TOKEN_ID, TOKEN, ENDPOINT_ID, CREATED_AT, LAST_USED, 
             USAGE_COUNT, IS_ACTIVE, CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
      WHERE TOKEN_ID = ?
    `;
    const result = await this.executeQuery(sql, [tokenId]);
    return result.rows.length > 0 ? this.mapTokenRow(result.rows[0]) : null;
  }

  async getPATTokenByEndpointId(endpointId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT TOKEN_ID, TOKEN, ENDPOINT_ID, CREATED_AT, LAST_USED, 
             USAGE_COUNT, IS_ACTIVE, CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
      WHERE ENDPOINT_ID = ? AND IS_ACTIVE = TRUE
      ORDER BY CREATED_AT DESC
      LIMIT 1
    `;
    const result = await this.executeQuery(sql, [endpointId]);
    return result.rows.length > 0 ? this.mapTokenRow(result.rows[0]) : null;
  }

  async updatePATTokenUsage(tokenId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
      SET USAGE_COUNT = USAGE_COUNT + 1,
          LAST_USED = CURRENT_TIMESTAMP()
      WHERE TOKEN_ID = ?
    `;
    await this.executeQuery(sql, [tokenId]);
  }

  async revokePATToken(tokenHash) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
      SET IS_ACTIVE = FALSE
      WHERE TOKEN = ?
    `;
    await this.executeQuery(sql, [tokenHash]);
    return true;
  }

  async getAllPATTokens() {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT TOKEN_ID, TOKEN, ENDPOINT_ID, CREATED_AT, LAST_USED, 
             USAGE_COUNT, IS_ACTIVE, CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
      ORDER BY CREATED_AT DESC
    `;
    const result = await this.executeQuery(sql);
    return result.rows.map(row => this.mapTokenRow(row));
  }

  mapTokenRow(row) {
    return {
      id: row.TOKEN_ID,
      token: row.TOKEN, // This will be the hash, not the actual token
      endpointId: row.ENDPOINT_ID,
      createdAt: row.CREATED_AT?.toISOString() || new Date().toISOString(),
      lastUsed: row.LAST_USED?.toISOString() || null,
      usageCount: row.USAGE_COUNT || 0,
      isActive: row.IS_ACTIVE,
      createdBy: row.CREATED_BY,
      metadata: row.METADATA ? (typeof row.METADATA === 'string' ? JSON.parse(row.METADATA) : row.METADATA) : {}
    };
  }

  // =====================================================
  // STATISTICS
  // =====================================================

  async getEndpointStats() {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT 
        COUNT(*) AS TOTAL,
        COUNT(CASE WHEN IS_ACTIVE = TRUE THEN 1 END) AS ACTIVE,
        COUNT(CASE WHEN IS_ACTIVE = FALSE THEN 1 END) AS INACTIVE
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
    `;
    const result = await this.executeQuery(sql);
    return result.rows[0] || { TOTAL: 0, ACTIVE: 0, INACTIVE: 0 };
  }

  async getTokenStats() {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT 
        COUNT(*) AS TOTAL,
        COUNT(CASE WHEN IS_ACTIVE = TRUE THEN 1 END) AS ACTIVE,
        COUNT(CASE WHEN IS_ACTIVE = FALSE THEN 1 END) AS REVOKED,
        SUM(USAGE_COUNT) AS TOTAL_USAGE
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
    `;
    const result = await this.executeQuery(sql);
    return result.rows[0] || { TOTAL: 0, ACTIVE: 0, REVOKED: 0, TOTAL_USAGE: 0 };
  }

  // Cleanup method to close connection when needed
  async closeConnection() {
    if (this.connection) {
      try {
        this.connection.destroy();
        this.connection = null;
      } catch (error) {
        logger.error('Error closing database connection:', error);
      }
    }
  }
}

module.exports = new DatabaseService();

