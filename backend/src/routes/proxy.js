const express = require('express');
const snowflakeService = require('../services/snowflakeService');
const tokenService = require('../services/tokenService');
const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to validate API key (PAT token)
const validatePATToken = async (req, res, next) => {
  // Try to get token from multiple sources (in order of preference):
  // 1. X-API-Key header - highest priority
  // 2. Query parameter (?API_KEY=... or ?token=...)
  // 3. URL path parameter (/:token) - lowest priority
  let token = null;
  
  // First, try X-API-Key header (highest priority)
  if (req.headers['x-api-key']) {
    token = req.headers['x-api-key'];
  }
  // Also support Authorization header for backward compatibility
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7); // Remove "Bearer " prefix
  }
  
  // If not in header, try query parameters (support both API_KEY and token for backward compatibility)
  if (!token && req.query.API_KEY) {
    token = req.query.API_KEY;
  } else if (!token && req.query.token) {
    token = req.query.token;
  }
  
  // If still not found, try path parameter
  // Only use path parameter as token if it looks like a token (UUID format or long hex string)
  // Don't use short custom paths (like "TB1") as tokens
  if (!token && req.params.token) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const longHexRegex = /^[0-9a-f]{64}$/i; // SHA256 hash length
    // Only use path parameter as token if it looks like a UUID or a long token hash
    if (uuidRegex.test(req.params.token) || longHexRegex.test(req.params.token)) {
      token = req.params.token;
    }
    // Otherwise, assume req.params.token is a custom path and token should come from header/query
  }
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key required. Provide API key in URL path, X-API-Key header, or query parameter (?API_KEY=... or ?token=...)'
    });
  }

  const tokenData = await tokenService.validatePATToken(token);
  if (!tokenData) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired API key'
    });
  }

  req.tokenData = tokenData;
  next();
};

// Middleware to get endpoint data
// This middleware now handles both UUID-based tokens and custom path-based lookups
const getEndpointData = async (req, res, next) => {
  let endpoint = null;
  
  // Check if path parameter is a custom path (not a UUID) or a UUID
  // The URL pattern is /api/proxy/:pathOrToken where pathOrToken could be a custom path or UUID
  if (req.params.token) {
    // Try to get endpoint by path/UUID first
    endpoint = await databaseService.getEndpointByIdOrPath(req.params.token);
  }
  
  // If endpoint found, validate that the API key matches
  if (endpoint && req.tokenData) {
    // Validate that the token's endpointId matches the endpoint found
    if (req.tokenData.endpointId !== endpoint.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'API key does not match this endpoint'
      });
    }
  } else if (!endpoint) {
    // If no endpoint found and we have token data, try getting endpoint from token
    if (req.tokenData && req.tokenData.endpointId) {
      endpoint = await databaseService.getEndpointById(req.tokenData.endpointId);
    }
  }
  
  if (!endpoint) {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: 'Endpoint not found'
    });
  }

  // Only active endpoints can receive requests
  const endpointStatus = endpoint.status || (endpoint.isActive ? 'active' : 'suspended');
  if (endpointStatus !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: `Endpoint is ${endpointStatus}. Only active endpoints can receive requests.`
    });
  }

  req.endpoint = endpoint;
  next();
};

// Middleware to validate HTTP method
const validateMethod = (req, res, next) => {
  if (req.method !== req.endpoint.method) {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `This endpoint only accepts ${req.endpoint.method} requests`
    });
  }
  next();
};

// Execute query based on endpoint type
const executeEndpoint = async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId || req.tokenData?.tokenId;
  let responseStatus = 200;
  let errorMessage = null;

  try {
    const { endpoint, tokenData } = req;
    let result;

    // Get Snowflake connection (in production, use connection pooling)
    // Automatically detects SPCS vs local and loads appropriate config
    const config = snowflakeService.loadConfig();
    const connection = await snowflakeService.createConnection(config);

    try {
      switch (endpoint.type) {
        case 'query':
          result = await snowflakeService.executeQuery(connection, endpoint.target, req.body.parameters || []);
          break;
        
        case 'stored_procedure':
          result = await snowflakeService.executeStoredProcedure(connection, endpoint.target, req.body.parameters || []);
          break;
        
        case 'function':
          result = await snowflakeService.executeFunction(connection, endpoint.target, req.body.parameters || []);
          break;
        
        case 'table':
          const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
          const offset = req.query.offset ? parseInt(req.query.offset) : 0;
          result = await snowflakeService.getTableData(connection, endpoint.target, limit, offset);
          break;
        
        default:
          throw new Error(`Unsupported endpoint type: ${endpoint.type}`);
      }

      // Log successful request and update token usage
      const responseTime = Date.now() - startTime;
      
      // Log to audit log (async, don't wait)
      databaseService.logApiRequest({
        requestId,
        endpointId: endpoint.id,
        tokenId: tokenData?.id || null,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        body: req.body,
        status: 200,
        responseTime,
        errorMessage: null
      }).catch(err => logger.error('Error logging API request:', err));

      // Update token usage (async, don't wait)
      // Note: tokenData.id should be set from validatePATToken, but also update API_KEYS.USAGE_COUNT
      if (tokenData?.id) {
        logger.info(`Updating token usage: tokenId=${tokenData.id}, endpointId=${endpoint.id}, endpointName=${endpoint.name}`);
        databaseService.updateTokenUsage(tokenData.id, endpoint.id)
          .then((result) => {
            logger.info(`Token usage updated successfully: tokenId=${tokenData.id}, endpointId=${endpoint.id}, result:`, JSON.stringify(result || {}));
          })
          .catch(err => {
            logger.error('Error updating token usage:', err);
            logger.error('Error stack:', err.stack);
            logger.error('TokenData:', JSON.stringify(tokenData, null, 2));
            logger.error('Endpoint:', JSON.stringify({ id: endpoint.id, name: endpoint.name }, null, 2));
          });
      } else {
        logger.warn('tokenData.id is missing, cannot update token usage', {
          tokenDataKeys: tokenData ? Object.keys(tokenData) : 'tokenData is null',
          tokenData: tokenData ? JSON.stringify(tokenData, null, 2) : 'null',
          endpointId: endpoint.id,
          endpointName: endpoint.name
        });
      }

      res.json({
        success: true,
        data: result.rows,
        metadata: {
          rowCount: result.rowCount,
          endpoint: endpoint.name,
          type: endpoint.type,
          timestamp: new Date().toISOString()
        }
      });

    } finally {
      // Close connection
      connection.destroy();
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;
    responseStatus = 500;
    errorMessage = error.message;
    
    logger.error('Error executing endpoint:', error);
    
    // Log failed request (async, don't wait)
    databaseService.logApiRequest({
      requestId,
      endpointId: req.endpoint?.id || null,
      tokenId: req.tokenData?.id || null,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      body: req.body,
      status: 500,
      responseTime,
      errorMessage: error.message
    }).catch(err => logger.error('Error logging API request:', err));

    res.status(500).json({
      success: false,
      error: 'Execution failed',
      message: error.message
    });
  }
};

// Routes that support token in path, Authorization header, or query parameter
// The validatePATToken middleware checks all three sources
router.get('/:token', validatePATToken, getEndpointData, validateMethod, executeEndpoint);
router.post('/:token', validatePATToken, getEndpointData, validateMethod, executeEndpoint);
router.put('/:token', validatePATToken, getEndpointData, validateMethod, executeEndpoint);
router.delete('/:token', validatePATToken, getEndpointData, validateMethod, executeEndpoint);

// GET /proxy/:token/info - Get endpoint information
router.get('/:token/info', validatePATToken, getEndpointData, (req, res) => {
  res.json({
    success: true,
    data: {
      endpoint: req.endpoint,
      token: {
        createdAt: req.tokenData.createdAt,
        lastUsed: req.tokenData.lastUsed,
        usageCount: req.tokenData.usageCount
      }
    }
  });
});

// Health check for proxy service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Proxy service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
