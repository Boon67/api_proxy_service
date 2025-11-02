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
      WHERE UPPER(USERNAME) = UPPER(?) AND IS_ACTIVE = TRUE
    `;
    const result = await this.executeQuery(sql, [username]);
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
    // Try query with STATUS first, fallback if column doesn't exist
    try {
      const sql = `
        SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
               e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
               e.CREATED_BY, e.METADATA, e.STATUS,
               CASE WHEN t.TOKEN_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
        ORDER BY e.CREATED_AT DESC
      `;
      const result = await this.executeQuery(sql);
      // Map rows - tags will be loaded separately for each endpoint
      const endpoints = [];
      for (const row of result.rows) {
        endpoints.push(await this.mapEndpointRow(row));
      }
      return endpoints;
    } catch (e) {
      // STATUS column doesn't exist - fallback query without STATUS
      const sql = `
        SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
               e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
               e.CREATED_BY, e.METADATA,
               CASE WHEN t.TOKEN_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
        ORDER BY e.CREATED_AT DESC
      `;
      const result = await this.executeQuery(sql);
      // Map rows - tags will be loaded separately for each endpoint
      const endpoints = [];
      for (const row of result.rows) {
        endpoints.push(await this.mapEndpointRow(row));
      }
      return endpoints;
    }
  }

  async getEndpointById(endpointId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    // Try query with STATUS first, fallback if column doesn't exist
    try {
      const sql = `
        SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
               e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
               e.CREATED_BY, e.METADATA, e.STATUS,
               CASE WHEN t.TOKEN_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
        WHERE e.ENDPOINT_ID = ?
      `;
      const result = await this.executeQuery(sql, [endpointId]);
      if (result.rows.length === 0) return null;
      return this.mapEndpointRow(result.rows[0]);
    } catch (e) {
      // STATUS column doesn't exist - fallback query without STATUS
      const sql = `
        SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
               e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
               e.CREATED_BY, e.METADATA,
               CASE WHEN t.TOKEN_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
        WHERE e.ENDPOINT_ID = ?
      `;
      const result = await this.executeQuery(sql, [endpointId]);
      if (result.rows.length === 0) return null;
      return this.mapEndpointRow(result.rows[0]);
    }
  }

  async createEndpoint(endpointData) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const endpointId = uuidv4();
    // Determine status: use status if provided, otherwise derive from isActive, default to 'draft'
    const status = endpointData.status || 
      (endpointData.isActive === false ? 'suspended' : 
       endpointData.isActive === true ? 'active' : 'draft');
    const isActive = status === 'active';
    
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
        (ENDPOINT_ID, NAME, DESCRIPTION, TYPE, TARGET, METHOD, PARAMETERS, 
         RATE_LIMIT, STATUS, IS_ACTIVE, CREATED_BY, METADATA)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      status,
      isActive, // Keep IS_ACTIVE for backward compatibility
      endpointData.createdBy || 'admin',
      endpointData.metadata ? JSON.stringify(endpointData.metadata) : null
    ]);
    return await this.getEndpointById(endpointId);
  }

  async updateEndpoint(endpointId, endpointData) {
    await this.getConnection(); // Ensure dbConfig is initialized
    // Determine status: use status if provided, otherwise derive from isActive
    let status = endpointData.status;
    let isActive = endpointData.isActive;
    
    if (!status && isActive !== undefined) {
      status = isActive ? 'active' : 'suspended';
    } else if (status && isActive === undefined) {
      isActive = status === 'active';
    } else if (!status && isActive === undefined) {
      // Neither provided, get current status
      const current = await this.getEndpointById(endpointId);
      if (current) {
        status = current.status || 'draft';
        isActive = current.isActive;
      } else {
        status = 'draft';
        isActive = false;
      }
    }
    
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
      SET NAME = ?,
          DESCRIPTION = ?,
          TYPE = ?,
          TARGET = ?,
          METHOD = ?,
          PARAMETERS = ?,
          RATE_LIMIT = ?,
          STATUS = ?,
          IS_ACTIVE = ?,
          UPDATED_AT = CURRENT_TIMESTAMP(),
          UPDATED_BY = ?,
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
      status,
      isActive,
      endpointData.updatedBy || endpointData.createdBy || 'system',
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

  async mapEndpointRow(row) {
    // Derive status from STATUS column or IS_ACTIVE
    const status = row.STATUS || (row.IS_ACTIVE ? 'active' : 'suspended');
    
    // hasToken is included in the row if we joined with PAT_TOKENS
    const hasToken = row.HAS_TOKEN !== undefined ? row.HAS_TOKEN : false;
    
    // Get tags for this endpoint (gracefully handle if tags table doesn't exist yet)
    let tags = [];
    try {
      tags = await this.getEndpointTags(row.ENDPOINT_ID);
    } catch (e) {
      // Tags table doesn't exist yet - that's OK, return empty array
      tags = [];
    }
    
    return {
      id: row.ENDPOINT_ID,
      name: row.NAME,
      description: row.DESCRIPTION || '',
      type: row.TYPE,
      target: row.TARGET,
      method: row.METHOD,
      parameters: row.PARAMETERS ? (typeof row.PARAMETERS === 'string' ? JSON.parse(row.PARAMETERS) : row.PARAMETERS) : [],
      rateLimit: row.RATE_LIMIT,
      status: status,
      isActive: row.IS_ACTIVE !== undefined ? row.IS_ACTIVE : (status === 'active'),
      hasToken: hasToken,
      tags: tags,
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
    // For VARIANT columns, we need to use PARSE_JSON or pass as object
    // Snowflake SDK should handle object conversion, but let's use PARSE_JSON to be safe
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS
        (TOKEN_ID, TOKEN, ENDPOINT_ID, CREATED_BY, METADATA)
      VALUES (?, ?, ?, ?, PARSE_JSON(?))
    `;
    await this.executeQuery(sql, [
      tokenId,
      tokenHash,
      endpointId,
      metadata.createdBy || 'admin',
      metadata && Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : '{}'
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
    // Check if STATUS column exists
    try {
      const sql = `
        SELECT 
          COUNT(*) AS TOTAL,
          COUNT(CASE WHEN COALESCE(STATUS, CASE WHEN IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END) = 'active' THEN 1 END) AS ACTIVE,
          COUNT(CASE WHEN COALESCE(STATUS, CASE WHEN IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END) = 'draft' THEN 1 END) AS DRAFT,
          COUNT(CASE WHEN COALESCE(STATUS, CASE WHEN IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END) = 'suspended' THEN 1 END) AS SUSPENDED
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
      `;
      const result = await this.executeQuery(sql);
      return result.rows[0] || { TOTAL: 0, ACTIVE: 0, DRAFT: 0, SUSPENDED: 0 };
    } catch (e) {
      // STATUS column doesn't exist - fallback to IS_ACTIVE
      const sql = `
        SELECT 
          COUNT(*) AS TOTAL,
          COUNT(CASE WHEN IS_ACTIVE = TRUE THEN 1 END) AS ACTIVE,
          0 AS DRAFT,
          COUNT(CASE WHEN IS_ACTIVE = FALSE THEN 1 END) AS SUSPENDED
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
      `;
      const result = await this.executeQuery(sql);
      return result.rows[0] || { TOTAL: 0, ACTIVE: 0, DRAFT: 0, SUSPENDED: 0 };
    }
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

  // =====================================================
  // ACTIVITY LOG OPERATIONS
  // =====================================================

  async getEndpointUsageStats() {
    await this.getConnection(); // Ensure dbConfig is initialized
    // Check if STATUS column exists
    try {
      const sql = `
        SELECT 
          e.ENDPOINT_ID,
          e.NAME,
          e.TYPE,
          COALESCE(SUM(a.REQUEST_COUNT), 0) AS TOTAL_USAGE
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.TOKEN_USAGE_LOG a 
          ON e.ENDPOINT_ID = a.ENDPOINT_ID
          AND a.LAST_USED >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
        WHERE COALESCE(e.STATUS, CASE WHEN e.IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END) = 'active'
        GROUP BY e.ENDPOINT_ID, e.NAME, e.TYPE
        ORDER BY TOTAL_USAGE DESC
      `;
      const result = await this.executeQuery(sql);
      return result.rows.map(row => ({
        endpointId: row.ENDPOINT_ID,
        name: row.NAME,
        type: row.TYPE,
        usage: row.TOTAL_USAGE || 0
      }));
    } catch (e) {
      // STATUS column doesn't exist - fallback to IS_ACTIVE
      const sql = `
        SELECT 
          e.ENDPOINT_ID,
          e.NAME,
          e.TYPE,
          COALESCE(SUM(a.REQUEST_COUNT), 0) AS TOTAL_USAGE
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.TOKEN_USAGE_LOG a 
          ON e.ENDPOINT_ID = a.ENDPOINT_ID
          AND a.LAST_USED >= DATEADD(DAY, -30, CURRENT_TIMESTAMP())
        WHERE e.IS_ACTIVE = TRUE
        GROUP BY e.ENDPOINT_ID, e.NAME, e.TYPE
        ORDER BY TOTAL_USAGE DESC
      `;
      const result = await this.executeQuery(sql);
      return result.rows.map(row => ({
        endpointId: row.ENDPOINT_ID,
        name: row.NAME,
        type: row.TYPE,
        usage: row.TOTAL_USAGE || 0
      }));
    }
  }

  async getStatsWithHistory(periodDays = 30) {
    await this.getConnection(); // Ensure dbConfig is initialized
    
    // Get current stats
    const [endpointStats, tokenStats] = await Promise.all([
      this.getEndpointStats(),
      this.getTokenStats()
    ]);
    
    // Get historical comparison data
    const historicalSql = `
      WITH current_period AS (
        SELECT 
          COUNT(DISTINCT e.ENDPOINT_ID) AS endpoints_created,
          COUNT(DISTINCT t.TOKEN_ID) AS tokens_created,
          SUM(t.USAGE_COUNT) AS total_usage
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID
        WHERE e.CREATED_AT >= DATEADD(DAY, -${periodDays}, CURRENT_TIMESTAMP())
          OR t.CREATED_AT >= DATEADD(DAY, -${periodDays}, CURRENT_TIMESTAMP())
      ),
      previous_period AS (
        SELECT 
          COUNT(DISTINCT e.ENDPOINT_ID) AS endpoints_created,
          COUNT(DISTINCT t.TOKEN_ID) AS tokens_created,
          SUM(t.USAGE_COUNT) AS total_usage
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID
        WHERE (e.CREATED_AT >= DATEADD(DAY, -${periodDays * 2}, CURRENT_TIMESTAMP())
          AND e.CREATED_AT < DATEADD(DAY, -${periodDays}, CURRENT_TIMESTAMP()))
          OR (t.CREATED_AT >= DATEADD(DAY, -${periodDays * 2}, CURRENT_TIMESTAMP())
          AND t.CREATED_AT < DATEADD(DAY, -${periodDays}, CURRENT_TIMESTAMP()))
      )
      SELECT 
        c.endpoints_created AS current_endpoints,
        p.endpoints_created AS previous_endpoints,
        c.tokens_created AS current_tokens,
        p.tokens_created AS previous_tokens,
        c.total_usage AS current_usage,
        p.total_usage AS previous_usage
      FROM current_period c
      CROSS JOIN previous_period p
    `;
    
    const historicalResult = await this.executeQuery(historicalSql);
    const history = historicalResult.rows[0] || {};
    
    return {
      endpoints: {
        ...endpointStats,
        change: (history.current_endpoints || 0) - (history.previous_endpoints || 0)
      },
      tokens: {
        ...tokenStats,
        change: (history.current_tokens || 0) - (history.previous_tokens || 0),
        usageChange: (history.current_usage || 0) - (history.previous_usage || 0)
      }
    };
  }

  async logApiRequest(requestData) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.API_AUDIT_LOG
        (REQUEST_ID, ENDPOINT_ID, TOKEN_ID, REQUEST_METHOD, REQUEST_URL, 
         REQUEST_IP, USER_AGENT, REQUEST_BODY, RESPONSE_STATUS, 
         RESPONSE_TIME_MS, ERROR_MESSAGE)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeQuery(sql, [
      requestData.requestId || null,
      requestData.endpointId || null,
      requestData.tokenId || null,
      requestData.method || null,
      requestData.url || null,
      requestData.ip || null,
      requestData.userAgent || null,
      requestData.body ? JSON.stringify(requestData.body) : null,
      requestData.status || null,
      requestData.responseTime || null,
      requestData.errorMessage || null
    ]);
  }

  async updateTokenUsage(tokenId, endpointId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      MERGE INTO ${this.dbConfig.database}.${this.dbConfig.schema}.TOKEN_USAGE_LOG AS target
      USING (
        SELECT ? AS TOKEN_ID, ? AS ENDPOINT_ID, CURRENT_TIMESTAMP() AS LAST_USED
      ) AS source
      ON target.TOKEN_ID = source.TOKEN_ID 
        AND target.ENDPOINT_ID = source.ENDPOINT_ID
        AND DATE(target.LAST_USED) = DATE(source.LAST_USED)
      WHEN MATCHED THEN
        UPDATE SET 
          REQUEST_COUNT = target.REQUEST_COUNT + 1,
          LAST_USED = source.LAST_USED
      WHEN NOT MATCHED THEN
        INSERT (TOKEN_ID, ENDPOINT_ID, REQUEST_COUNT, LAST_USED)
        VALUES (source.TOKEN_ID, source.ENDPOINT_ID, 1, source.LAST_USED)
    `;
    await this.executeQuery(sql, [tokenId, endpointId]);
  }

  // =====================================================
  // SYSTEM SETTINGS OPERATIONS
  // =====================================================

  async getSystemSettings() {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT SETTING_KEY, SETTING_VALUE, DESCRIPTION, UPDATED_AT, UPDATED_BY
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.SYSTEM_SETTINGS
      ORDER BY SETTING_KEY
    `;
    const result = await this.executeQuery(sql);
    
    // Convert to object format
    const settings = {};
    result.rows.forEach(row => {
      const key = row.SETTING_KEY;
      let value = row.SETTING_VALUE;
      
      // Handle VARIANT type - convert JSON strings back to values
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If not JSON, keep as string
        }
      }
      
      // Convert boolean strings
      if (value === 'true') value = true;
      if (value === 'false') value = false;
      
      settings[key] = value;
    });
    
    return settings;
  }

  async updateSystemSetting(key, value, updatedBy = 'admin') {
    await this.getConnection(); // Ensure dbConfig is initialized
    
    // Convert value to appropriate format for VARIANT
    let variantValue = value;
    if (typeof value === 'object') {
      variantValue = JSON.stringify(value);
    } else if (typeof value === 'boolean') {
      variantValue = value;
    } else if (typeof value === 'number') {
      variantValue = value;
    } else {
      variantValue = String(value);
    }
    
    const sql = `
      MERGE INTO ${this.dbConfig.database}.${this.dbConfig.schema}.SYSTEM_SETTINGS AS target
      USING (
        SELECT ? AS SETTING_KEY, ? AS SETTING_VALUE, ? AS UPDATED_BY, CURRENT_TIMESTAMP() AS UPDATED_AT
      ) AS source
      ON target.SETTING_KEY = source.SETTING_KEY
      WHEN MATCHED THEN
        UPDATE SET 
          SETTING_VALUE = source.SETTING_VALUE,
          UPDATED_AT = source.UPDATED_AT,
          UPDATED_BY = source.UPDATED_BY
      WHEN NOT MATCHED THEN
        INSERT (SETTING_KEY, SETTING_VALUE, UPDATED_AT, UPDATED_BY)
        VALUES (source.SETTING_KEY, source.SETTING_VALUE, source.UPDATED_AT, source.UPDATED_BY)
    `;
    
    await this.executeQuery(sql, [key, variantValue, updatedBy]);
    return { key, value };
  }

  async updateSystemSettings(settings, updatedBy = 'admin') {
    await this.getConnection(); // Ensure dbConfig is initialized
    
    const updates = [];
    for (const [key, value] of Object.entries(settings)) {
      await this.updateSystemSetting(key, value, updatedBy);
      updates.push({ key, value });
    }
    
    return updates;
  }

  async getRecentActivity(limit = 20) {
    await this.getConnection(); // Ensure dbConfig is initialized
    
    // Check if STATUS and UPDATED_BY columns exist
    let hasStatus = false;
    let hasUpdatedBy = false;
    
    try {
      const testSql = `SELECT STATUS, UPDATED_BY FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS LIMIT 1`;
      await this.executeQuery(testSql);
      hasStatus = true;
      hasUpdatedBy = true;
    } catch (e) {
      // Check individually
      try {
        await this.executeQuery(`SELECT STATUS FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS LIMIT 1`);
        hasStatus = true;
      } catch (e2) {
        hasStatus = false;
      }
      try {
        await this.executeQuery(`SELECT UPDATED_BY FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS LIMIT 1`);
        hasUpdatedBy = true;
      } catch (e3) {
        hasUpdatedBy = false;
      }
    }
    
    // Build query based on available columns
    try {
      // Use STATUS and UPDATED_BY if available
      const statusExpr = hasStatus 
        ? `CASE 
            WHEN STATUS = 'active' THEN 'endpoint_enabled'
            WHEN STATUS = 'suspended' THEN 'endpoint_suspended'
            WHEN STATUS = 'draft' THEN 'endpoint_draft'
            ELSE 'endpoint_disabled'
          END`
        : `CASE 
            WHEN IS_ACTIVE = TRUE THEN 'endpoint_enabled'
            ELSE 'endpoint_disabled'
          END`;
      
      const userExpr = hasUpdatedBy 
        ? `COALESCE(UPDATED_BY, CREATED_BY)`
        : `CREATED_BY`;
      
      const sql = `
        WITH endpoint_activity AS (
          SELECT 
            ENDPOINT_ID as activity_id,
            'endpoint_created' as activity_type,
            NAME as entity_name,
            CREATED_AT as activity_timestamp,
            CREATED_BY as user,
            'endpoint' as entity_type
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
          WHERE CREATED_AT IS NOT NULL
          
          UNION ALL
          
          SELECT 
            ENDPOINT_ID as activity_id,
            ${statusExpr} as activity_type,
            NAME as entity_name,
            UPDATED_AT as activity_timestamp,
            ${userExpr} as user,
            'endpoint' as entity_type
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
          WHERE UPDATED_AT IS NOT NULL 
            AND UPDATED_AT != CREATED_AT
        ),
        token_activity AS (
          SELECT 
            TOKEN_ID as activity_id,
            'token_generated' as activity_type,
            e.NAME as entity_name,
            t.CREATED_AT as activity_timestamp,
            t.CREATED_BY as user,
            'token' as entity_type
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS t
          JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e 
            ON t.ENDPOINT_ID = e.ENDPOINT_ID
          WHERE t.CREATED_AT IS NOT NULL
          
          UNION ALL
          
          SELECT 
            TOKEN_ID as activity_id,
            CASE 
              WHEN IS_ACTIVE = FALSE THEN 'token_revoked'
              ELSE 'token_used'
            END as activity_type,
            e.NAME as entity_name,
            COALESCE(t.LAST_USED, t.CREATED_AT) as activity_timestamp,
            t.CREATED_BY as user,
            'token' as entity_type
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.PAT_TOKENS t
          JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e 
            ON t.ENDPOINT_ID = e.ENDPOINT_ID
          WHERE (t.LAST_USED IS NOT NULL OR t.CREATED_AT IS NOT NULL)
        )
        SELECT * FROM (
          SELECT * FROM endpoint_activity
          UNION ALL
          SELECT * FROM token_activity
        )
        ORDER BY activity_timestamp DESC
        LIMIT ?
      `;
      
      const result = await this.executeQuery(sql, [limit]);
      return result.rows.map(row => ({
        id: row.ACTIVITY_ID,
        type: row.ACTIVITY_TYPE.toLowerCase(),
        entityName: row.ENTITY_NAME,
        entityType: row.ENTITY_TYPE,
        timestamp: row.ACTIVITY_TIMESTAMP,
        user: row.USER || 'system'
      }));
    } catch (e) {
      // If query still fails, return empty array
      logger.error('Error fetching activity:', e);
      return [];
    }
  }

  // =====================================================
  // TAG OPERATIONS
  // =====================================================

  async getAllTags() {
    await this.getConnection();
    const sql = `
      SELECT TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_AT, CREATED_BY
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.TAGS
      ORDER BY NAME
    `;
    const result = await this.executeQuery(sql);
    return result.rows.map(row => ({
      id: row.TAG_ID,
      name: row.NAME,
      color: row.COLOR || '#3B82F6',
      description: row.DESCRIPTION || '',
      createdAt: row.CREATED_AT?.toISOString(),
      createdBy: row.CREATED_BY
    }));
  }

  async getTagById(tagId) {
    await this.getConnection();
    const sql = `
      SELECT TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_AT, CREATED_BY
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.TAGS
      WHERE TAG_ID = ?
    `;
    const result = await this.executeQuery(sql, [tagId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.TAG_ID,
      name: row.NAME,
      color: row.COLOR || '#3B82F6',
      description: row.DESCRIPTION || '',
      createdAt: row.CREATED_AT?.toISOString(),
      createdBy: row.CREATED_BY
    };
  }

  async getTagByName(name) {
    await this.getConnection();
    const sql = `
      SELECT TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_AT, CREATED_BY
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.TAGS
      WHERE UPPER(NAME) = UPPER(?)
    `;
    const result = await this.executeQuery(sql, [name]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.TAG_ID,
      name: row.NAME,
      color: row.COLOR || '#3B82F6',
      description: row.DESCRIPTION || '',
      createdAt: row.CREATED_AT?.toISOString(),
      createdBy: row.CREATED_BY
    };
  }

  async createTag(tagData) {
    await this.getConnection();
    // Check if tag with same name exists
    const existing = await this.getTagByName(tagData.name);
    if (existing) {
      return existing;
    }
    
    const tagId = uuidv4();
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.TAGS
        (TAG_ID, NAME, COLOR, DESCRIPTION, CREATED_BY)
      VALUES (?, ?, ?, ?, ?)
    `;
    await this.executeQuery(sql, [
      tagId,
      tagData.name,
      tagData.color || '#3B82F6',
      tagData.description || null,
      tagData.createdBy || 'system'
    ]);
    return await this.getTagById(tagId);
  }

  async updateTag(tagId, tagData) {
    await this.getConnection();
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.TAGS
      SET NAME = ?,
          COLOR = ?,
          DESCRIPTION = ?
      WHERE TAG_ID = ?
    `;
    await this.executeQuery(sql, [
      tagData.name,
      tagData.color || '#3B82F6',
      tagData.description || null,
      tagId
    ]);
    return await this.getTagById(tagId);
  }

  async deleteTag(tagId) {
    await this.getConnection();
    // First delete from junction tables
    await this.executeQuery(
      `DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINT_TAGS WHERE TAG_ID = ?`,
      [tagId]
    );
    await this.executeQuery(
      `DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.TOKEN_TAGS WHERE TAG_ID = ?`,
      [tagId]
    );
    // Then delete the tag
    await this.executeQuery(
      `DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.TAGS WHERE TAG_ID = ?`,
      [tagId]
    );
    return true;
  }

  async getEndpointTags(endpointId) {
    await this.getConnection();
    const sql = `
      SELECT t.TAG_ID, t.NAME, t.COLOR, t.DESCRIPTION
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINT_TAGS et
      JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.TAGS t ON et.TAG_ID = t.TAG_ID
      WHERE et.ENDPOINT_ID = ?
      ORDER BY t.NAME
    `;
    const result = await this.executeQuery(sql, [endpointId]);
    return result.rows.map(row => ({
      id: row.TAG_ID,
      name: row.NAME,
      color: row.COLOR || '#3B82F6',
      description: row.DESCRIPTION || ''
    }));
  }

  async setEndpointTags(endpointId, tagIds) {
    await this.getConnection();
    // Remove existing tags
    await this.executeQuery(
      `DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINT_TAGS WHERE ENDPOINT_ID = ?`,
      [endpointId]
    );
    // Add new tags using parameterized query
    if (tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await this.executeQuery(
          `INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINT_TAGS (ENDPOINT_ID, TAG_ID) VALUES (?, ?)`,
          [endpointId, tagId]
        );
      }
    }
    return await this.getEndpointTags(endpointId);
  }

  async getTokenTags(tokenId) {
    await this.getConnection();
    const sql = `
      SELECT t.TAG_ID, t.NAME, t.COLOR, t.DESCRIPTION
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.TOKEN_TAGS tt
      JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.TAGS t ON tt.TAG_ID = t.TAG_ID
      WHERE tt.TOKEN_ID = ?
      ORDER BY t.NAME
    `;
    const result = await this.executeQuery(sql, [tokenId]);
    return result.rows.map(row => ({
      id: row.TAG_ID,
      name: row.NAME,
      color: row.COLOR || '#3B82F6',
      description: row.DESCRIPTION || ''
    }));
  }

  async setTokenTags(tokenId, tagIds) {
    await this.getConnection();
    // Remove existing tags
    await this.executeQuery(
      `DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.TOKEN_TAGS WHERE TOKEN_ID = ?`,
      [tokenId]
    );
    // Add new tags using parameterized query
    if (tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await this.executeQuery(
          `INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.TOKEN_TAGS (TOKEN_ID, TAG_ID) VALUES (?, ?)`,
          [tokenId, tagId]
        );
      }
    }
    return await this.getTokenTags(tokenId);
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

