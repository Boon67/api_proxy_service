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
      
      // Set warehouse immediately after connection is established
      if (this.dbConfig && this.dbConfig.warehouse) {
        try {
          await snowflakeService.executeQuery(this.connection, `USE WAREHOUSE ${this.dbConfig.warehouse}`, []);
          logger.info(`Warehouse ${this.dbConfig.warehouse} set for connection`);
        } catch (warehouseError) {
          logger.warn(`Could not set warehouse ${this.dbConfig.warehouse}: ${warehouseError.message}`);
        }
      } else {
        logger.warn('No warehouse configured - some queries may fail');
      }
    }
    return this.connection;
  }

  async executeQuery(sql, binds = []) {
    try {
      const connection = await this.getConnection();
      
      // Ensure warehouse is set before executing queries that require it
      // Re-set warehouse if this is a query that needs it and not a USE WAREHOUSE command
      if (this.dbConfig && this.dbConfig.warehouse && !sql.toUpperCase().includes('USE WAREHOUSE')) {
        // Check if warehouse needs to be set (some queries like SELECT require warehouse)
        const needsWarehouse = sql.toUpperCase().match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|MERGE)\b/);
        if (needsWarehouse) {
          try {
            await snowflakeService.executeQuery(connection, `USE WAREHOUSE ${this.dbConfig.warehouse}`, []);
          } catch (warehouseError) {
            // Log but don't fail - connection might already have warehouse set
            logger.debug(`Warehouse ${this.dbConfig.warehouse} may already be in use: ${warehouseError.message}`);
          }
        }
      }
      
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
      SELECT USER_ID, USERNAME, PASSWORD_HASH, FIRST_NAME, LAST_NAME, EMAIL, CONTACT_NUMBER, 
             ROLE, IS_ACTIVE, CREATED_AT, UPDATED_AT, LAST_LOGIN, CREATED_BY
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
      WHERE UPPER(USERNAME) = UPPER(?) AND IS_ACTIVE = TRUE
    `;
    const result = await this.executeQuery(sql, [username]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getUserById(userId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT USER_ID, USERNAME, PASSWORD_HASH, FIRST_NAME, LAST_NAME, EMAIL, CONTACT_NUMBER, 
             ROLE, IS_ACTIVE, CREATED_AT, UPDATED_AT, LAST_LOGIN, CREATED_BY
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

  async updateUserPassword(username, passwordHash) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
      SET PASSWORD_HASH = ?,
          UPDATED_AT = CURRENT_TIMESTAMP()
      WHERE UPPER(USERNAME) = UPPER(?)
    `;
    await this.executeQuery(sql, [passwordHash, username]);
    return true;
  }

  async getAllUsers() {
    await this.getConnection();
    const sql = `
      SELECT USER_ID, USERNAME, FIRST_NAME, LAST_NAME, EMAIL, CONTACT_NUMBER, ROLE, IS_ACTIVE, 
             CREATED_AT, UPDATED_AT, LAST_LOGIN, CREATED_BY
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
      ORDER BY CREATED_AT DESC
    `;
    const result = await this.executeQuery(sql, []);
    return result.rows;
  }

  async createUser(userData) {
    await this.getConnection();
    const userId = uuidv4();
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
        (USER_ID, USERNAME, PASSWORD_HASH, FIRST_NAME, LAST_NAME, EMAIL, CONTACT_NUMBER, ROLE, IS_ACTIVE, CREATED_BY)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeQuery(sql, [
      userId,
      userData.username.toUpperCase(),
      userData.passwordHash,
      userData.firstName || null,
      userData.lastName || null,
      userData.email || null,
      userData.contactNumber || null,
      userData.role || 'admin',
      userData.isActive !== false,
      userData.createdBy || 'system'
    ]);
    return await this.getUserById(userId);
  }

  async updateUser(userId, userData) {
    await this.getConnection();
    const updates = [];
    const values = [];
    
    if (userData.firstName !== undefined) {
      updates.push('FIRST_NAME = ?');
      values.push(userData.firstName || null);
    }
    if (userData.lastName !== undefined) {
      updates.push('LAST_NAME = ?');
      values.push(userData.lastName || null);
    }
    if (userData.email !== undefined) {
      updates.push('EMAIL = ?');
      values.push(userData.email || null);
    }
    if (userData.contactNumber !== undefined) {
      updates.push('CONTACT_NUMBER = ?');
      values.push(userData.contactNumber || null);
    }
    if (userData.role !== undefined) {
      updates.push('ROLE = ?');
      values.push(userData.role);
    }
    if (userData.isActive !== undefined) {
      updates.push('IS_ACTIVE = ?');
      values.push(userData.isActive);
    }
    if (userData.passwordHash !== undefined) {
      updates.push('PASSWORD_HASH = ?');
      values.push(userData.passwordHash);
    }
    
    if (updates.length === 0) {
      return await this.getUserById(userId);
    }
    
    updates.push('UPDATED_AT = CURRENT_TIMESTAMP()');
    values.push(userId);
    
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
      SET ${updates.join(', ')}
      WHERE USER_ID = ?
    `;
    await this.executeQuery(sql, values);
    return await this.getUserById(userId);
  }

  async deleteUser(userId) {
    await this.getConnection();
    const sql = `
      DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.USERS
      WHERE USER_ID = ?
    `;
    await this.executeQuery(sql, [userId]);
    return true;
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
               e.CREATED_BY, e.METADATA, e.STATUS, e.PATH,
               CASE WHEN t.API_KEY_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
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
      // Try including PATH, fallback if column doesn't exist
      try {
        const sql = `
          SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
                 e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
                 e.CREATED_BY, e.METADATA, e.PATH,
                 CASE WHEN t.API_KEY_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
          LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
            ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
          ORDER BY e.CREATED_AT DESC
        `;
        const result = await this.executeQuery(sql);
        const endpoints = [];
        for (const row of result.rows) {
          endpoints.push(await this.mapEndpointRow(row));
        }
        return endpoints;
      } catch (e2) {
        // PATH column doesn't exist - final fallback
      const sql = `
        SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
               e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
               e.CREATED_BY, e.METADATA,
               CASE WHEN t.API_KEY_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
          LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
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
  }

  async getEndpointById(endpointId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    // Try query with STATUS first, fallback if column doesn't exist
    try {
      const sql = `
        SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
               e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
               e.CREATED_BY, e.METADATA, e.STATUS, e.PATH,
               CASE WHEN t.API_KEY_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
        WHERE e.ENDPOINT_ID = ?
      `;
      const result = await this.executeQuery(sql, [endpointId]);
      if (result.rows.length === 0) return null;
      return this.mapEndpointRow(result.rows[0]);
    } catch (e) {
      // STATUS or PATH column doesn't exist - fallback query
      try {
        const sql = `
          SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
                 e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
                 e.CREATED_BY, e.METADATA, e.STATUS, e.PATH,
                 CASE WHEN t.API_KEY_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
          LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
            ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
          WHERE e.ENDPOINT_ID = ?
        `;
        const result = await this.executeQuery(sql, [endpointId]);
        if (result.rows.length === 0) return null;
        return this.mapEndpointRow(result.rows[0]);
      } catch (e2) {
        // PATH column doesn't exist - final fallback
      const sql = `
        SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
               e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
               e.CREATED_BY, e.METADATA,
               CASE WHEN t.API_KEY_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
          LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
        WHERE e.ENDPOINT_ID = ?
      `;
      const result = await this.executeQuery(sql, [endpointId]);
      if (result.rows.length === 0) return null;
      return this.mapEndpointRow(result.rows[0]);
      }
    }
  }

  async getEndpointByPath(path) {
    await this.getConnection(); // Ensure dbConfig is initialized
    // Try query with STATUS first, fallback if column doesn't exist
    try {
      const sql = `
        SELECT e.ENDPOINT_ID, e.NAME, e.DESCRIPTION, e.TYPE, e.TARGET, e.METHOD, 
               e.PARAMETERS, e.RATE_LIMIT, e.IS_ACTIVE, e.CREATED_AT, e.UPDATED_AT, 
               e.CREATED_BY, e.METADATA, e.STATUS, e.PATH,
               CASE WHEN t.API_KEY_ID IS NOT NULL AND t.IS_ACTIVE = TRUE THEN TRUE ELSE FALSE END AS HAS_TOKEN
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID AND t.IS_ACTIVE = TRUE
        WHERE e.PATH = ? AND e.PATH IS NOT NULL
      `;
      const result = await this.executeQuery(sql, [path]);
      if (result.rows.length === 0) return null;
      return this.mapEndpointRow(result.rows[0]);
    } catch (e) {
      // PATH column doesn't exist - return null
      return null;
    }
  }

  async getEndpointByIdOrPath(identifier) {
    // Check if identifier is a UUID (36 chars with hyphens) or a custom path
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(identifier)) {
      return await this.getEndpointById(identifier);
    } else {
      return await this.getEndpointByPath(identifier);
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
    
    // Validate and normalize path if provided
    let path = endpointData.path ? endpointData.path.trim() : null;
    if (path) {
      // Validate path is URL-safe (alphanumeric, hyphens, underscores only)
      const pathRegex = /^[a-zA-Z0-9_-]+$/;
      if (!pathRegex.test(path)) {
        throw new Error('Path must contain only alphanumeric characters, hyphens, and underscores');
      }
      // Check if path already exists
      const existing = await this.getEndpointByPath(path);
      if (existing) {
        throw new Error(`Path "${path}" is already in use by another endpoint`);
      }
    }

    // Try to include PATH column, fallback if it doesn't exist
    try {
      const sql = `
        INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS
          (ENDPOINT_ID, NAME, DESCRIPTION, TYPE, TARGET, METHOD, PARAMETERS, 
           RATE_LIMIT, STATUS, IS_ACTIVE, CREATED_BY, METADATA, PATH)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        endpointData.metadata ? JSON.stringify(endpointData.metadata) : null,
        path
      ]);
    } catch (e) {
      // PATH column doesn't exist - insert without it
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
        isActive,
      endpointData.createdBy || 'admin',
      endpointData.metadata ? JSON.stringify(endpointData.metadata) : null
    ]);
    }
    
    // Log endpoint creation activity
    const createdEndpoint = await this.getEndpointById(endpointId);
    if (createdEndpoint) {
      await this.logActivity({
        type: 'endpoint_created',
        user: endpointData.createdBy || 'admin',
        entityName: createdEndpoint.name,
        entityType: 'endpoint',
        endpointId: endpointId
      }).catch(err => {
        logger.warn('Could not log endpoint creation activity:', err.message);
      });
    }
    
    return createdEndpoint;
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
    
    // Validate and normalize path if provided
    // If path is explicitly provided (even if empty string), we should update it
    let path = undefined;
    if (endpointData.path !== undefined) {
      if (endpointData.path && typeof endpointData.path === 'string') {
        path = endpointData.path.trim();
        if (path === '') {
          path = null; // Empty string means clear the path
        } else {
          // Validate path is URL-safe (alphanumeric, hyphens, underscores only)
          const pathRegex = /^[a-zA-Z0-9_-]+$/;
          if (!pathRegex.test(path)) {
            throw new Error('Path must contain only alphanumeric characters, hyphens, and underscores');
          }
          // Check if path already exists (and is not the current endpoint)
          const existing = await this.getEndpointByPath(path);
          if (existing && existing.id !== endpointId) {
            throw new Error(`Path "${path}" is already in use by another endpoint`);
          }
        }
      } else {
        path = null; // Explicitly set to null to clear
      }
    }

    // Try to include PATH column, fallback if it doesn't exist
    try {
      if (path !== undefined) {
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
              METADATA = ?,
              PATH = ?
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
          path,
          endpointId
        ]);
      } else {
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
      }
    } catch (e) {
      // PATH column doesn't exist - update without it
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
    }
    
    // Log endpoint update activity
    const updatedEndpoint = await this.getEndpointById(endpointId);
    if (updatedEndpoint) {
      await this.logActivity({
        type: 'endpoint_updated',
        user: endpointData.updatedBy || endpointData.createdBy || 'system',
        entityName: updatedEndpoint.name,
        entityType: 'endpoint',
        endpointId: endpointId
      }).catch(err => {
        logger.warn('Could not log endpoint update activity:', err.message);
      });
    }
    
    return updatedEndpoint;
  }

  async deleteEndpoint(endpointId, deletedBy = 'system') {
    await this.getConnection(); // Ensure dbConfig is initialized
    // Get endpoint info before deletion for activity log
    const endpoint = await this.getEndpointById(endpointId);
    
    // Log deletion activity before deleting
    if (endpoint) {
      await this.logActivity({
        type: 'endpoint_deleted',
        user: deletedBy,
        entityName: endpoint.name,
        entityType: 'endpoint',
        endpointId: endpointId
      }).catch(err => {
        logger.warn('Could not log endpoint deletion activity:', err.message);
      });
    }
    
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
    
    // hasToken is included in the row if we joined with API_KEYS
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
      path: row.PATH || null,
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
    // For VARIANT columns, Snowflake doesn't allow PARSE_JSON in VALUES clause
    // Use INSERT with SELECT statement instead to work around this limitation
    const metadataObj = metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0 
      ? metadata 
      : (metadata.createdBy ? { createdBy: metadata.createdBy } : {});
    const metadataJson = JSON.stringify(metadataObj);
    // Escape single quotes in JSON string for SQL injection safety
    const escapedJson = metadataJson.replace(/'/g, "''");
    // Use INSERT ... SELECT pattern to work around Snowflake's VALUES clause limitation
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
        (API_KEY_ID, API_KEY, ENDPOINT_ID, CREATED_BY, METADATA)
      SELECT ?, ?, ?, ?, TRY_PARSE_JSON('${escapedJson}')
    `;
    await this.executeQuery(sql, [
      tokenId,
      tokenHash,
      endpointId,
      metadata.createdBy || 'admin'
    ]);
    
    // Log API key generation activity
    const tokenData = await this.getPATTokenById(tokenId);
    if (tokenData && tokenData.endpointId) {
      const endpoint = await this.getEndpointById(tokenData.endpointId).catch(() => null);
      if (endpoint) {
        await this.logActivity({
          type: 'token_generated',
          user: metadata.createdBy || 'admin',
          entityName: endpoint.name,
          entityType: 'api_key',
          endpointId: tokenData.endpointId,
          apiKeyId: tokenId
        }).catch(err => {
          logger.warn('Could not log token generation activity:', err.message);
        });
      }
    }
    
    return tokenData;
  }

  async getPATTokenByHash(tokenHash) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT API_KEY_ID, API_KEY, ENDPOINT_ID, CREATED_AT, LAST_USED, 
             USAGE_COUNT, IS_ACTIVE, CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
      WHERE API_KEY = ? AND IS_ACTIVE = TRUE
    `;
    const result = await this.executeQuery(sql, [tokenHash]);
    return result.rows.length > 0 ? this.mapTokenRow(result.rows[0]) : null;
  }

  async getPATTokenById(tokenId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT API_KEY_ID, API_KEY, ENDPOINT_ID, CREATED_AT, LAST_USED, 
             USAGE_COUNT, IS_ACTIVE, CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
      WHERE API_KEY_ID = ?
    `;
    const result = await this.executeQuery(sql, [tokenId]);
    return result.rows.length > 0 ? this.mapTokenRow(result.rows[0]) : null;
  }

  async getPATTokenByEndpointId(endpointId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT API_KEY_ID, API_KEY, ENDPOINT_ID, CREATED_AT, LAST_USED, 
             USAGE_COUNT, IS_ACTIVE, CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
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
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
      SET USAGE_COUNT = USAGE_COUNT + 1,
          LAST_USED = CURRENT_TIMESTAMP()
      WHERE API_KEY_ID = ?
    `;
    const result = await this.executeQuery(sql, [tokenId]);
    logger.debug(`updatePATTokenUsage executed for tokenId=${tokenId}, rows affected=${result?.rowsAffected || 'unknown'}`);
    return result;
  }

  async revokePATToken(tokenHash, revokedBy = 'system') {
    await this.getConnection(); // Ensure dbConfig is initialized
    
    // Get token info before revoking for activity log
    const token = await this.getPATTokenByHash(tokenHash);
    let endpoint = null;
    if (token && token.endpointId) {
      endpoint = await this.getEndpointById(token.endpointId).catch(() => null);
    }
    
    const sql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
      SET IS_ACTIVE = FALSE
      WHERE API_KEY = ?
    `;
    await this.executeQuery(sql, [tokenHash]);
    
    // Log revocation activity
    if (token && endpoint) {
      await this.logActivity({
        type: 'token_revoked',
        user: revokedBy,
        entityName: endpoint.name,
        entityType: 'api_key',
        endpointId: token.endpointId,
        apiKeyId: token.id
      }).catch(err => {
        logger.warn('Could not log token revocation activity:', err.message);
      });
    }
    
    return true;
  }

  async deletePATToken(tokenId, deletedBy = 'system') {
    await this.getConnection(); // Ensure dbConfig is initialized
    
    // Get token info before deletion for activity log
    const token = await this.getPATTokenById(tokenId);
    let endpoint = null;
    if (token && token.endpointId) {
      endpoint = await this.getEndpointById(token.endpointId).catch(() => null);
    }
    
    // Log deletion activity before deleting
    if (token && endpoint) {
      await this.logActivity({
        type: 'api_key_deleted',
        user: deletedBy,
        entityName: endpoint.name,
        entityType: 'api_key',
        endpointId: token.endpointId,
        apiKeyId: tokenId
      }).catch(err => {
        logger.warn('Could not log API key deletion activity:', err.message);
      });
    }
    
    // First delete related records
    // Note: TOKEN_TAGS table is no longer used

    // Delete token usage logs
    const deleteUsageSql = `
      DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_USAGE_LOG
      WHERE API_KEY_ID = ?
    `;
    await this.executeQuery(deleteUsageSql, [tokenId]).catch(err => {
      // If API_USAGE_LOG table doesn't exist or error, continue
      logger.warn('Could not delete token usage logs:', err.message);
    });

    // Note: API_AUDIT_LOG entries are kept for audit purposes, just set API_KEY_ID to NULL
    const updateAuditSql = `
      UPDATE ${this.dbConfig.database}.${this.dbConfig.schema}.API_AUDIT_LOG
      SET API_KEY_ID = NULL
      WHERE API_KEY_ID = ?
    `;
    await this.executeQuery(updateAuditSql, [tokenId]).catch(err => {
      // If API_AUDIT_LOG table doesn't exist or error, continue
      logger.warn('Could not update audit log:', err.message);
    });

    // Finally delete the token itself
    const deleteTokenSql = `
      DELETE FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
      WHERE API_KEY_ID = ?
    `;
    await this.executeQuery(deleteTokenSql, [tokenId]);
    return true;
  }

  async getAllPATTokens() {
    await this.getConnection(); // Ensure dbConfig is initialized
    const sql = `
      SELECT API_KEY_ID, API_KEY, ENDPOINT_ID, CREATED_AT, LAST_USED, 
             USAGE_COUNT, IS_ACTIVE, CREATED_BY, METADATA
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
      ORDER BY CREATED_AT DESC
    `;
    const result = await this.executeQuery(sql);
    return result.rows.map(row => this.mapTokenRow(row));
  }

  mapTokenRow(row) {
    return {
      id: row.API_KEY_ID,
      token: row.API_KEY, // This will be the hash, not the actual token
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
      FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS
    `;
    const result = await this.executeQuery(sql);
    return result.rows[0] || { TOTAL: 0, ACTIVE: 0, REVOKED: 0, TOTAL_USAGE: 0 };
  }

  // =====================================================
  // ACTIVITY LOG OPERATIONS
  // =====================================================

  async getEndpointUsageStats(days = 7) {
    await this.getConnection(); // Ensure dbConfig is initialized
    // Validate days parameter
    const validDays = [1, 7, 30, 90];
    const dayRange = validDays.includes(parseInt(days)) ? parseInt(days) : 7;
    
    // Check if STATUS column exists
    try {
      const sql = `
        SELECT 
          e.ENDPOINT_ID,
          e.NAME,
          e.TYPE,
          COALESCE(SUM(a.REQUEST_COUNT), 0) AS TOTAL_USAGE
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_USAGE_LOG a 
          ON e.ENDPOINT_ID = a.ENDPOINT_ID
          AND a.LAST_USED >= DATEADD(DAY, -?, CURRENT_TIMESTAMP())
        WHERE COALESCE(e.STATUS, CASE WHEN e.IS_ACTIVE = TRUE THEN 'active' ELSE 'suspended' END) = 'active'
        GROUP BY e.ENDPOINT_ID, e.NAME, e.TYPE
        ORDER BY TOTAL_USAGE DESC
      `;
      const result = await this.executeQuery(sql, [dayRange]);
      logger.info(`getEndpointUsageStats (${dayRange} days): Found ${result.rows.length} endpoints with usage data`);
      const mapped = result.rows.map(row => {
        const usage = Number(row.TOTAL_USAGE) || 0;
        logger.info(`Endpoint ${row.ENDPOINT_ID} (${row.NAME}): ${usage} requests`);
        return {
        endpointId: row.ENDPOINT_ID,
        name: row.NAME,
        type: row.TYPE,
          usage: usage
        };
      });
      logger.info(`getEndpointUsageStats returning: ${JSON.stringify(mapped, null, 2)}`);
      return mapped;
    } catch (e) {
      // STATUS column doesn't exist - fallback to IS_ACTIVE
      const sql = `
        SELECT 
          e.ENDPOINT_ID,
          e.NAME,
          e.TYPE,
          COALESCE(SUM(a.REQUEST_COUNT), 0) AS TOTAL_USAGE
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_USAGE_LOG a 
          ON e.ENDPOINT_ID = a.ENDPOINT_ID
          AND a.LAST_USED >= DATEADD(DAY, -?, CURRENT_TIMESTAMP())
        WHERE e.IS_ACTIVE = TRUE
        GROUP BY e.ENDPOINT_ID, e.NAME, e.TYPE
        ORDER BY TOTAL_USAGE DESC
      `;
      const result = await this.executeQuery(sql, [dayRange]);
      logger.info(`getEndpointUsageStats (fallback, ${dayRange} days): Found ${result.rows.length} endpoints with usage data`);
      const mapped = result.rows.map(row => {
        const usage = Number(row.TOTAL_USAGE) || 0;
        logger.info(`Endpoint ${row.ENDPOINT_ID} (${row.NAME}): ${usage} requests`);
        return {
        endpointId: row.ENDPOINT_ID,
        name: row.NAME,
        type: row.TYPE,
          usage: usage
        };
      });
      logger.info(`getEndpointUsageStats (fallback) returning: ${JSON.stringify(mapped, null, 2)}`);
      return mapped;
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
          COUNT(DISTINCT t.API_KEY_ID) AS tokens_created,
          SUM(t.USAGE_COUNT) AS total_usage
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
          ON e.ENDPOINT_ID = t.ENDPOINT_ID
        WHERE e.CREATED_AT >= DATEADD(DAY, -${periodDays}, CURRENT_TIMESTAMP())
          OR t.CREATED_AT >= DATEADD(DAY, -${periodDays}, CURRENT_TIMESTAMP())
      ),
      previous_period AS (
        SELECT 
          COUNT(DISTINCT e.ENDPOINT_ID) AS endpoints_created,
          COUNT(DISTINCT t.API_KEY_ID) AS tokens_created,
          SUM(t.USAGE_COUNT) AS total_usage
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e
        LEFT JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t 
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
    
    // Normalize keys to lowercase for frontend compatibility
    const normalizedEndpointStats = {
      total: endpointStats.TOTAL || endpointStats.total || 0,
      active: endpointStats.ACTIVE || endpointStats.active || 0,
      draft: endpointStats.DRAFT || endpointStats.draft || 0,
      suspended: endpointStats.SUSPENDED || endpointStats.suspended || 0,
      inactive: (endpointStats.DRAFT || endpointStats.draft || 0) + (endpointStats.SUSPENDED || endpointStats.suspended || 0),
        change: (history.current_endpoints || 0) - (history.previous_endpoints || 0)
    };
    
    const normalizedTokenStats = {
      total: tokenStats.TOTAL || tokenStats.total || 0,
      active: tokenStats.ACTIVE || tokenStats.active || 0,
      revoked: tokenStats.REVOKED || tokenStats.revoked || 0,
      totalUsage: tokenStats.TOTAL_USAGE || tokenStats.totalUsage || 0,
        change: (history.current_tokens || 0) - (history.previous_tokens || 0),
        usageChange: (history.current_usage || 0) - (history.previous_usage || 0)
    };
    
    return {
      endpoints: normalizedEndpointStats,
      tokens: normalizedTokenStats
    };
  }

  async logApiRequest(requestData) {
    await this.getConnection(); // Ensure dbConfig is initialized
    
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.API_AUDIT_LOG
        (REQUEST_ID, ENDPOINT_ID, API_KEY_ID, REQUEST_METHOD, REQUEST_URL, 
         REQUEST_IP, REQUEST_IP_X_FORWARDED, USER_AGENT, REQUEST_BODY, 
         REQUEST_SIZE_BYTES, RESPONSE_STATUS, RESPONSE_SIZE_BYTES,
         RESPONSE_TIME_MS, START_TIME, END_TIME, ERROR_MESSAGE, 
         ROUTE_PATH, USER_ID)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeQuery(sql, [
      requestData.requestId || null,
      requestData.endpointId || null,
      requestData.apiKeyId || requestData.tokenId || null,
      requestData.method || null,
      requestData.url || null,
      requestData.ip || null,
      requestData.forwardedFor || null,
      requestData.userAgent || null,
      requestData.body ? JSON.stringify(requestData.body) : null,
      requestData.requestSize || null,
      requestData.status || null,
      requestData.responseSize || null,
      requestData.responseTime || null,
      requestData.startTime || null,
      requestData.endTime || null,
      requestData.errorMessage || null,
      requestData.routePath || null,
      requestData.userId || null
    ]);
  }

  async logActivity(activityData) {
    await this.getConnection(); // Ensure dbConfig is initialized
    // Log activity to API_AUDIT_LOG using a special format
    // REQUEST_METHOD='ACTIVITY' marks this as an activity log entry
    // REQUEST_BODY contains JSON with activity details
    const activityBody = {
      activityType: activityData.type, // e.g., 'endpoint_deleted', 'api_key_deleted', 'endpoint_updated'
      user: activityData.user || 'system',
      entityName: activityData.entityName || null,
      entityType: activityData.entityType || null // 'endpoint' or 'api_key'
    };
    
    const sql = `
      INSERT INTO ${this.dbConfig.database}.${this.dbConfig.schema}.API_AUDIT_LOG
        (REQUEST_ID, ENDPOINT_ID, API_KEY_ID, REQUEST_METHOD, REQUEST_URL, 
         REQUEST_IP, USER_AGENT, REQUEST_BODY, RESPONSE_STATUS, 
         RESPONSE_TIME_MS, ERROR_MESSAGE)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeQuery(sql, [
      uuidv4(), // REQUEST_ID
      activityData.endpointId || null,
      activityData.apiKeyId || null,
      'ACTIVITY', // REQUEST_METHOD - special marker
      null, // REQUEST_URL
      null, // REQUEST_IP
      null, // USER_AGENT
      JSON.stringify(activityBody), // REQUEST_BODY contains activity data
      200, // RESPONSE_STATUS
      null, // RESPONSE_TIME_MS
      null // ERROR_MESSAGE
    ]).catch(err => {
      logger.warn('Could not log activity:', err.message);
      // Don't throw - activity logging shouldn't break operations
    });
  }

  async updateTokenUsage(tokenId, endpointId) {
    await this.getConnection(); // Ensure dbConfig is initialized
    logger.info(`updateTokenUsage called: tokenId=${tokenId}, endpointId=${endpointId}`);
    
    const sql = `
      MERGE INTO ${this.dbConfig.database}.${this.dbConfig.schema}.API_USAGE_LOG AS target
      USING (
        SELECT ? AS API_KEY_ID, ? AS ENDPOINT_ID, CURRENT_TIMESTAMP() AS LAST_USED
      ) AS source
      ON target.API_KEY_ID = source.API_KEY_ID 
        AND target.ENDPOINT_ID = source.ENDPOINT_ID
        AND DATE(target.LAST_USED) = DATE(source.LAST_USED)
      WHEN MATCHED THEN
        UPDATE SET 
          REQUEST_COUNT = target.REQUEST_COUNT + 1,
          LAST_USED = source.LAST_USED
      WHEN NOT MATCHED THEN
        INSERT (API_KEY_ID, ENDPOINT_ID, REQUEST_COUNT, LAST_USED)
        VALUES (source.API_KEY_ID, source.ENDPOINT_ID, 1, source.LAST_USED)
    `;
    try {
      logger.debug(`Executing MERGE query for API_USAGE_LOG with tokenId=${tokenId}, endpointId=${endpointId}`);
      const result = await this.executeQuery(sql, [tokenId, endpointId]);
      logger.info(`updateTokenUsage executed successfully: tokenId=${tokenId}, endpointId=${endpointId}, rowsAffected=${result?.rowsAffected || 'unknown'}, result keys: ${result ? Object.keys(result).join(', ') : 'none'}`);
      
      // Also verify the update by querying the table
      const verifySql = `
        SELECT REQUEST_COUNT, LAST_USED
        FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_USAGE_LOG
        WHERE API_KEY_ID = ? AND ENDPOINT_ID = ? 
          AND DATE(LAST_USED) = CURRENT_DATE()
        ORDER BY LAST_USED DESC
        LIMIT 1
      `;
      try {
        const verifyResult = await this.executeQuery(verifySql, [tokenId, endpointId]);
        if (verifyResult.rows.length > 0) {
          logger.info(`Verified API_USAGE_LOG entry: REQUEST_COUNT=${verifyResult.rows[0].REQUEST_COUNT}, LAST_USED=${verifyResult.rows[0].LAST_USED}`);
        } else {
          logger.warn(`No API_USAGE_LOG entry found after update for tokenId=${tokenId}, endpointId=${endpointId}`);
        }
      } catch (verifyErr) {
        logger.warn(`Could not verify API_USAGE_LOG entry: ${verifyErr.message}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in updateTokenUsage: ${error.message}`, { tokenId, endpointId, error: error.stack });
      throw error;
    }
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
            'endpoint_updated' as activity_type,
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
            API_KEY_ID as activity_id,
            'token_generated' as activity_type,
            e.NAME as entity_name,
            t.CREATED_AT as activity_timestamp,
            t.CREATED_BY as user,
            'api_key' as entity_type
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t
          JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e 
            ON t.ENDPOINT_ID = e.ENDPOINT_ID
          WHERE t.CREATED_AT IS NOT NULL
          
          UNION ALL
          
          SELECT 
            t.API_KEY_ID as activity_id,
            CASE 
              WHEN t.IS_ACTIVE = FALSE THEN 'token_revoked'
              ELSE 'token_used'
            END as activity_type,
            e.NAME as entity_name,
            t.LAST_USED as activity_timestamp,
            t.CREATED_BY as user,
            'api_key' as entity_type
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t
          JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e 
            ON t.ENDPOINT_ID = e.ENDPOINT_ID
          WHERE t.LAST_USED IS NOT NULL
            AND t.IS_ACTIVE = TRUE
            
          UNION ALL
          
          -- Show revoked tokens (when IS_ACTIVE = FALSE)
          SELECT 
            API_KEY_ID as activity_id,
            'token_revoked' as activity_type,
            e.NAME as entity_name,
            COALESCE(t.LAST_USED, t.CREATED_AT) as activity_timestamp,
            t.CREATED_BY as user,
            'api_key' as entity_type
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_KEYS t
          JOIN ${this.dbConfig.database}.${this.dbConfig.schema}.ENDPOINTS e 
            ON t.ENDPOINT_ID = e.ENDPOINT_ID
          WHERE t.IS_ACTIVE = FALSE
        ),
        activity_log AS (
          -- Get activity events from API_AUDIT_LOG where REQUEST_METHOD = 'ACTIVITY'
          SELECT 
            REQUEST_ID as activity_id,
            PARSE_JSON(REQUEST_BODY):activityType::STRING as activity_type,
            PARSE_JSON(REQUEST_BODY):entityName::STRING as entity_name,
            PARSE_JSON(REQUEST_BODY):entityType::STRING as entity_type,
            CREATED_AT as activity_timestamp,
            PARSE_JSON(REQUEST_BODY):user::STRING as user,
            ENDPOINT_ID,
            API_KEY_ID
          FROM ${this.dbConfig.database}.${this.dbConfig.schema}.API_AUDIT_LOG
          WHERE REQUEST_METHOD = 'ACTIVITY'
            AND REQUEST_BODY IS NOT NULL
        )
        SELECT * FROM (
          SELECT * FROM endpoint_activity
          UNION ALL
          SELECT * FROM token_activity
          UNION ALL
          SELECT 
            activity_id,
            activity_type,
            entity_name,
            entity_type,
            activity_timestamp,
            user,
            NULL as ENDPOINT_ID,
            NULL as API_KEY_ID
          FROM activity_log
        )
        ORDER BY activity_timestamp DESC
        LIMIT ?
      `;
      
      const result = await this.executeQuery(sql, [limit]);
      
      logger.debug(`getRecentActivity returned ${result.rows.length} rows`);
      
      return result.rows.map(row => ({
        id: row.ACTIVITY_ID,
        type: row.ACTIVITY_TYPE ? row.ACTIVITY_TYPE.toLowerCase() : 'unknown',
        entityName: row.ENTITY_NAME || 'Unknown',
        entityType: row.ENTITY_TYPE || 'unknown',
        timestamp: row.ACTIVITY_TIMESTAMP,
        user: row.USER || 'system'
      }));
    } catch (e) {
      // If query still fails, return empty array
      logger.error('Error fetching activity:', e);
      logger.error('Activity query error details:', {
        message: e.message,
        code: e.code,
        sqlState: e.sqlState,
        sqlCode: e.sqlCode
      });
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
    // Note: TOKEN_TAGS table is no longer used
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

