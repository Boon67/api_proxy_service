const express = require('express');
const snowflakeService = require('../services/snowflakeService');
const tokenService = require('../services/tokenService');
const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to validate PAT token
const validatePATToken = async (req, res, next) => {
  const token = req.params.token;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'PAT token required'
    });
  }

  const tokenData = await tokenService.validatePATToken(token);
  if (!tokenData) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired PAT token'
    });
  }

  req.tokenData = tokenData;
  next();
};

// Middleware to get endpoint data
const getEndpointData = async (req, res, next) => {
  const endpoint = await databaseService.getEndpointById(req.tokenData.endpointId);
  if (!endpoint) {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: 'Endpoint not found'
    });
  }

  if (!endpoint.isActive) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Endpoint is inactive'
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
  try {
    const { endpoint } = req;
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
    logger.error('Error executing endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Execution failed',
      message: error.message
    });
  }
};

// GET /proxy/:token - Execute GET endpoint
router.get('/:token', validatePATToken, getEndpointData, validateMethod, executeEndpoint);

// POST /proxy/:token - Execute POST endpoint
router.post('/:token', validatePATToken, getEndpointData, validateMethod, executeEndpoint);

// PUT /proxy/:token - Execute PUT endpoint
router.put('/:token', validatePATToken, getEndpointData, validateMethod, executeEndpoint);

// DELETE /proxy/:token - Execute DELETE endpoint
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
