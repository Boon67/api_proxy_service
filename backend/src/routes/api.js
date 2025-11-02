const express = require('express');
const { body, validationResult } = require('express-validator');
const Endpoint = require('../models/Endpoint');
const tokenService = require('../services/tokenService');
const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validateEndpoint = [
  body('name').notEmpty().withMessage('Name is required'),
  body('type').isIn(['query', 'stored_procedure', 'function', 'table']).withMessage('Invalid type'),
  body('target').notEmpty().withMessage('Target is required'),
  body('method').isIn(['GET', 'POST', 'PUT', 'DELETE']).withMessage('Invalid method'),
  body('rateLimit').optional().isInt({ min: 1 }).withMessage('Rate limit must be a positive integer'),
  body('parameters').optional().isArray().withMessage('Parameters must be an array')
];

// GET /api/endpoints - List all endpoints
router.get('/endpoints', async (req, res) => {
  try {
    const endpointList = await databaseService.getAllEndpoints();
    res.json({
      success: true,
      data: endpointList,
      count: endpointList.length
    });
  } catch (error) {
    logger.error('Error fetching endpoints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoints'
    });
  }
});

// GET /api/endpoints/:id - Get specific endpoint
router.get('/endpoints/:id', async (req, res) => {
  try {
    const endpoint = await databaseService.getEndpointById(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    res.json({
      success: true,
      data: endpoint
    });
  } catch (error) {
    logger.error('Error fetching endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoint'
    });
  }
});

// POST /api/endpoints - Create new endpoint
router.post('/endpoints', validateEndpoint, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const endpointData = {
      ...req.body,
      createdBy: req.user.username || 'admin'
    };

    // Validate using Endpoint model
    const endpoint = new Endpoint(endpointData);
    const validationErrors = endpoint.validate();
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const createdEndpoint = await databaseService.createEndpoint(endpointData);
    logger.info(`Endpoint created: ${createdEndpoint.name} (${createdEndpoint.id})`);

    res.status(201).json({
      success: true,
      data: createdEndpoint
    });
  } catch (error) {
    logger.error('Error creating endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create endpoint'
    });
  }
});

// PUT /api/endpoints/:id - Update endpoint
router.put('/endpoints/:id', validateEndpoint, async (req, res) => {
  try {
    const existingEndpoint = await databaseService.getEndpointById(req.params.id);
    if (!existingEndpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Validate using Endpoint model
    const endpoint = new Endpoint({ ...existingEndpoint, ...req.body });
    const validationErrors = endpoint.validate();
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const updatedEndpoint = await databaseService.updateEndpoint(req.params.id, req.body);
    logger.info(`Endpoint updated: ${updatedEndpoint.name} (${updatedEndpoint.id})`);

    res.json({
      success: true,
      data: updatedEndpoint
    });
  } catch (error) {
    logger.error('Error updating endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update endpoint'
    });
  }
});

// DELETE /api/endpoints/:id - Delete endpoint
router.delete('/endpoints/:id', async (req, res) => {
  try {
    const endpoint = await databaseService.getEndpointById(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    // Revoke associated PAT token
    const tokenData = await tokenService.getTokenByEndpointId(req.params.id);
    if (tokenData) {
      await tokenService.revokePATToken(tokenData.token);
    }

    await databaseService.deleteEndpoint(req.params.id);
    logger.info(`Endpoint deleted: ${endpoint.name} (${endpoint.id})`);

    res.json({
      success: true,
      message: 'Endpoint deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete endpoint'
    });
  }
});

// POST /api/endpoints/:id/token - Generate PAT token for endpoint
router.post('/endpoints/:id/token', async (req, res) => {
  try {
    const endpoint = await databaseService.getEndpointById(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    // Revoke existing token if any (by endpoint ID - need to get token hash from DB)
    const existingToken = await tokenService.getTokenByEndpointId(req.params.id);
    if (existingToken) {
      // Revoke by token hash stored in database
      await databaseService.revokePATToken(existingToken.token);
    }

    // Create new token
    const tokenData = await tokenService.createPATToken(req.params.id, {
      endpointName: endpoint.name,
      createdBy: req.user.username || 'admin'
    });

    res.json({
      success: true,
      data: {
        token: tokenData.token, // Actual token (only returned once)
        endpointId: req.params.id,
        createdAt: tokenData.createdAt
      }
    });
  } catch (error) {
    logger.error('Error generating token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate token'
    });
  }
});

// GET /api/endpoints/:id/token - Get token info for endpoint
router.get('/endpoints/:id/token', async (req, res) => {
  try {
    const tokenData = await tokenService.getTokenByEndpointId(req.params.id);
    if (!tokenData) {
      return res.status(404).json({
        success: false,
        error: 'No token found for this endpoint'
      });
    }

    res.json({
      success: true,
      data: {
        // Note: Actual token is not returned for security
        tokenId: tokenData.id,
        createdAt: tokenData.createdAt,
        lastUsed: tokenData.lastUsed,
        usageCount: tokenData.usageCount,
        isActive: tokenData.isActive
      }
    });
  } catch (error) {
    logger.error('Error fetching token info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token info'
    });
  }
});

// GET /api/tokens - List all tokens
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await tokenService.getAllTokens();
    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });
  } catch (error) {
    logger.error('Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tokens'
    });
  }
});

// PATCH /api/endpoints/:id/status - Enable or disable endpoint
router.patch('/endpoints/:id/status', async (req, res) => {
  try {
    const endpoint = await databaseService.getEndpointById(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean value'
      });
    }

    const updatedEndpoint = await databaseService.updateEndpoint(req.params.id, {
      ...endpoint,
      isActive
    });

    logger.info(`Endpoint ${isActive ? 'enabled' : 'disabled'}: ${updatedEndpoint.name} (${updatedEndpoint.id})`);

    res.json({
      success: true,
      data: updatedEndpoint,
      message: `Endpoint ${isActive ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    logger.error('Error updating endpoint status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update endpoint status'
    });
  }
});

// POST /api/endpoints/:id/test - Test an endpoint
router.post('/endpoints/:id/test', async (req, res) => {
  const startTime = Date.now();
  try {
    const endpoint = await databaseService.getEndpointById(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    // Check if endpoint is active (optional - allow testing inactive endpoints)
    const testInactive = req.query.allowInactive === 'true';
    if (!endpoint.isActive && !testInactive) {
      return res.status(403).json({
        success: false,
        error: 'Endpoint is disabled',
        message: 'Enable the endpoint or add ?allowInactive=true to test it'
      });
    }

    // Get Snowflake connection
    const snowflakeService = require('../services/snowflakeService');
    const config = snowflakeService.loadConfig(); // Automatically detects SPCS vs local
    const connection = await snowflakeService.createConnection(config);

    let result;
    const testParameters = req.body.parameters || [];

    try {
      switch (endpoint.type) {
        case 'query':
          result = await snowflakeService.executeQuery(connection, endpoint.target, testParameters);
          break;
        
        case 'stored_procedure':
          result = await snowflakeService.executeStoredProcedure(connection, endpoint.target, testParameters);
          break;
        
        case 'function':
          result = await snowflakeService.executeFunction(connection, endpoint.target, testParameters);
          break;
        
        case 'table':
          const limit = req.query.limit ? parseInt(req.query.limit) : 10; // Default to 10 for testing
          const offset = req.query.offset ? parseInt(req.query.offset) : 0;
          result = await snowflakeService.getTableData(connection, endpoint.target, limit, offset);
          break;
        
        default:
          throw new Error(`Unsupported endpoint type: ${endpoint.type}`);
      }

      const duration = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          rows: result.rows || [],
          rowCount: result.rowCount || 0,
          endpoint: {
            id: endpoint.id,
            name: endpoint.name,
            type: endpoint.type,
            target: endpoint.target
          },
          testMetadata: {
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            parameters: testParameters,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset) : undefined
          }
        }
      });

    } finally {
      connection.destroy();
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error testing endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Test execution failed',
      message: error.message,
      duration: `${duration}ms`
    });
  }
});

// GET /api/stats - Get service statistics
router.get('/stats', async (req, res) => {
  try {
    const [tokenStats, endpointStats] = await Promise.all([
      tokenService.getTokenStats(),
      databaseService.getEndpointStats()
    ]);

    res.json({
      success: true,
      data: {
        endpoints: endpointStats,
        tokens: tokenStats
      }
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
