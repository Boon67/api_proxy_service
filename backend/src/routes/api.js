const express = require('express');
const { body, validationResult } = require('express-validator');
const Endpoint = require('../models/Endpoint');
const tokenService = require('../services/tokenService');
const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');
const { getEndpointUrl } = require('../utils/urlUtils');

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

// GET /api/endpoints/usage - Get endpoint usage statistics for charts
// This must come BEFORE /endpoints/:id to avoid route conflict
// Query parameter: days (1, 7, 30, 90) - default is 7
router.get('/endpoints/usage', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const usageStats = await databaseService.getEndpointUsageStats(days);
    
    res.json({
      success: true,
      data: usageStats,
      count: usageStats.length
    });
  } catch (error) {
    logger.error('Error fetching endpoint usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoint usage statistics'
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

    // Add endpoint URL to the response
    endpoint.url = getEndpointUrl(endpoint.id, endpoint.path);

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
    logger.info(`Endpoint created: ${createdEndpoint.name} (${createdEndpoint.id}) by ${req.user?.username || 'admin'}`);

    // Optionally generate an API key for the new endpoint if requested
    let generatedToken = null;
    const generateApiKey = req.body.generateApiKey === true || req.body.generateApiKey === 'true';
    
    if (generateApiKey) {
      try {
        const tokenData = await tokenService.createPATToken(createdEndpoint.id, {
          endpointName: createdEndpoint.name,
          createdBy: req.user?.username || 'admin'
        });
        logger.info(`API key generated for endpoint ${createdEndpoint.id}`);
        generatedToken = tokenData.token; // Store the actual token to return in response
        createdEndpoint.tokenId = tokenData.id;
      } catch (tokenError) {
        logger.error(`Failed to generate API key for endpoint ${createdEndpoint.id}:`, tokenError);
        // Don't fail endpoint creation if token generation fails
      }
    }
    
    // Refresh endpoint to include hasToken flag and path
    const refreshedEndpoint = await databaseService.getEndpointById(createdEndpoint.id);
    createdEndpoint.hasToken = refreshedEndpoint.hasToken;
    createdEndpoint.path = refreshedEndpoint.path;
    createdEndpoint.url = getEndpointUrl(createdEndpoint.id, refreshedEndpoint.path);

    const responseData = {
      ...createdEndpoint
    };
    
    // Include the token in response if it was generated (only shown once)
    if (generatedToken) {
      responseData.token = generatedToken;
    }

    res.status(201).json({
      success: true,
      data: responseData
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

    const updateData = {
      ...req.body,
      updatedBy: req.user?.username || 'system'
    };
    const updatedEndpoint = await databaseService.updateEndpoint(req.params.id, updateData);
    logger.info(`Endpoint updated: ${updatedEndpoint.name} (${updatedEndpoint.id})`);

    // Add endpoint URL to the response
    updatedEndpoint.url = getEndpointUrl(updatedEndpoint.id, updatedEndpoint.path);

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

    await databaseService.deleteEndpoint(req.params.id, req.user?.username || 'system');
    logger.info(`Endpoint deleted: ${endpoint.name} (${endpoint.id}) by ${req.user?.username || 'system'}`);

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

// POST /api/endpoints/:id/api_key - Generate API key for endpoint
router.post('/endpoints/:id/api_key', async (req, res) => {
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
      error: 'Failed to generate API key'
    });
  }
});

// GET /api/endpoints/:id/api_key - Get API key info for endpoint
router.get('/endpoints/:id/api_key', async (req, res) => {
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

// GET /api/api_keys - List all API keys (formerly /api/tokens)
router.get('/api_keys', async (req, res) => {
  try {
    const tokens = await tokenService.getAllTokens();
    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API keys'
    });
  }
});

// DELETE /api/api_keys/:id - Revoke an API key (if permanent=true, delete permanently)
router.delete('/api_keys/:id', async (req, res) => {
  try {
    const tokenId = req.params.id;
    const permanent = req.query.permanent === 'true' || req.query.permanent === true;
    
    // Get API key data by ID
    const tokenData = await databaseService.getPATTokenById(tokenId);
    if (!tokenData) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    if (permanent) {
      // Permanently delete the token
      if (tokenData.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete active API key. Please revoke it first.'
        });
      }

      await databaseService.deletePATToken(tokenId, req.user?.username || 'system');
      logger.info(`API key permanently deleted: ${tokenId} by ${req.user?.username || 'system'}`);

      res.json({
        success: true,
        message: 'API key permanently deleted'
      });
    } else {
      // Revoke the API key (soft delete)
      await databaseService.revokePATToken(tokenData.token);
      logger.info(`API key revoked: ${tokenId}`);

      res.json({
        success: true,
        message: 'API key revoked successfully'
      });
    }
  } catch (error) {
    logger.error('Error processing API key:', error);
    res.status(500).json({
      success: false,
      error: permanent ? 'Failed to delete API key' : 'Failed to revoke API key'
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

    // Support both status and isActive for backward compatibility
    const { status, isActive } = req.body;
    
    let newStatus = status;
    if (!newStatus && typeof isActive === 'boolean') {
      newStatus = isActive ? 'active' : 'suspended';
    } else if (!newStatus) {
      return res.status(400).json({
        success: false,
        error: 'status or isActive must be provided'
      });
    }
    
    if (!['active', 'draft', 'suspended'].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: 'status must be one of: active, draft, suspended'
      });
    }

    // Check if endpoint has a token before activating
    if (newStatus === 'active') {
      const tokenData = await tokenService.getTokenByEndpointId(req.params.id);
      if (!tokenData) {
        return res.status(400).json({
          success: false,
          error: 'Cannot activate endpoint without an API key. Please generate an API key first.'
        });
      }
    }

    const updatedEndpoint = await databaseService.updateEndpoint(req.params.id, {
      ...endpoint,
      status: newStatus,
      isActive: newStatus === 'active',
      updatedBy: req.user?.username || 'system'
    });

    const statusMessages = {
      active: 'enabled',
      suspended: 'suspended',
      draft: 'set to draft'
    };
    logger.info(`Endpoint ${statusMessages[newStatus]}: ${updatedEndpoint.name} (${updatedEndpoint.id})`);

    res.json({
      success: true,
      data: updatedEndpoint,
      message: `Endpoint ${statusMessages[newStatus]} successfully`
    });
  } catch (error) {
    logger.error('Error updating endpoint status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update endpoint status'
    });
  }
});

// POST /api/test-target - Test a target operation without creating an endpoint
router.post('/test-target', async (req, res) => {
  const startTime = Date.now();
  try {
    const { type, target, parameters = [], limit = 10, offset = 0 } = req.body;

    if (!type || !target) {
      return res.status(400).json({
        success: false,
        error: 'Type and target are required'
      });
    }

    // Get Snowflake connection
    const snowflakeService = require('../services/snowflakeService');
    const config = snowflakeService.loadConfig();
    const connection = await snowflakeService.createConnection(config);

    try {
      let result;
      
      switch (type) {
        case 'query':
          result = await snowflakeService.executeQuery(connection, target, parameters);
          break;
        
        case 'stored_procedure':
          result = await snowflakeService.executeStoredProcedure(connection, target, parameters);
          break;
        
        case 'function':
          result = await snowflakeService.executeFunction(connection, target, parameters);
          break;
        
        case 'table':
          result = await snowflakeService.getTableData(connection, target, parseInt(limit), parseInt(offset));
          break;
        
        default:
          throw new Error(`Unsupported type: ${type}`);
      }

      const duration = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          rows: result.rows || [],
          rowCount: result.rowCount || 0,
          testMetadata: {
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            parameters,
            limit: parseInt(limit),
            offset: parseInt(offset)
          }
        }
      });
    } finally {
      connection.destroy();
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error testing target:', error);
    res.status(500).json({
      success: false,
      error: 'Test execution failed',
      message: error.message,
      duration: `${duration}ms`
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
    const endpointStatus = endpoint.status || (endpoint.isActive ? 'active' : 'suspended');
    if (endpointStatus !== 'active' && !testInactive) {
      return res.status(403).json({
        success: false,
        error: `Endpoint is ${endpointStatus}`,
        message: 'Set endpoint to active or add ?allowInactive=true to test it'
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

// GET /api/activity - Get recent activity
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await databaseService.getRecentActivity(limit);
    
    res.json({
      success: true,
      data: activities,
      count: activities.length
    });
  } catch (error) {
    logger.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity'
    });
  }
});

// GET /api/stats - Get service statistics
router.get('/stats', async (req, res) => {
  try {
    const periodDays = parseInt(req.query.period) || 30;
    const stats = await databaseService.getStatsWithHistory(periodDays);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// GET /api/settings - Get system settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await databaseService.getSystemSettings();
    
    // Format settings for frontend (convert keys to camelCase)
    const formattedSettings = {
      logLevel: settings.log_level || 'info',
      rateLimitDefault: settings.rate_limit_default || 100,
      sessionTimeout: settings.session_timeout || 3600,
      enableAuditLog: settings.enable_audit_log !== false, // Default to true
    };
    
    res.json({
      success: true,
      data: formattedSettings
    });
  } catch (error) {
    logger.error('Error fetching system settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system settings'
    });
  }
});

// PUT /api/settings - Update system settings
router.put('/settings', [
  body('logLevel').optional().isIn(['error', 'warn', 'info', 'debug']).withMessage('Invalid log level'),
  body('rateLimitDefault').optional().isInt({ min: 1, max: 10000 }).withMessage('Rate limit must be between 1 and 10000'),
  body('sessionTimeout').optional().isInt({ min: 300, max: 86400 }).withMessage('Session timeout must be between 300 and 86400 seconds'),
  body('enableAuditLog').optional().isBoolean().withMessage('enableAuditLog must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const user = req.user?.username || 'system';
    const { logLevel, rateLimitDefault, sessionTimeout, enableAuditLog } = req.body;
    
    const updates = {};
    if (logLevel !== undefined) updates.log_level = logLevel;
    if (rateLimitDefault !== undefined) updates.rate_limit_default = rateLimitDefault;
    if (sessionTimeout !== undefined) updates.session_timeout = sessionTimeout;
    if (enableAuditLog !== undefined) updates.enable_audit_log = enableAuditLog;
    
    await databaseService.updateSystemSettings(updates, user);
    
    // Update logger level if changed
    if (logLevel) {
      logger.level = logLevel;
      logger.info(`Log level updated to: ${logLevel}`);
    }
    
    res.json({
      success: true,
      message: 'System settings updated successfully',
      data: updates
    });
  } catch (error) {
    logger.error('Error updating system settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update system settings'
    });
  }
});

// =====================================================
// TAG MANAGEMENT ROUTES
// =====================================================

// GET /api/tags - Get all tags
router.get('/tags', async (req, res) => {
  try {
    const tags = await databaseService.getAllTags();
    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    logger.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tags'
    });
  }
});

// POST /api/tags - Create a new tag
router.post('/tags', async (req, res) => {
  try {
    const { name, color, description } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required'
      });
    }

    const tag = await databaseService.createTag({
      name: name.trim(),
      color: color || '#3B82F6',
      description: description || null,
      createdBy: req.user?.username || 'system'
    });

    res.status(201).json({
      success: true,
      data: tag
    });
  } catch (error) {
    logger.error('Error creating tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tag'
    });
  }
});

// PUT /api/tags/:id - Update a tag
router.put('/tags/:id', async (req, res) => {
  try {
    const { name, color, description } = req.body;
    const tag = await databaseService.updateTag(req.params.id, {
      name: name?.trim(),
      color: color || '#3B82F6',
      description: description || null
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found'
      });
    }

    res.json({
      success: true,
      data: tag
    });
  } catch (error) {
    logger.error('Error updating tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tag'
    });
  }
});

// DELETE /api/tags/:id - Delete a tag
router.delete('/tags/:id', async (req, res) => {
  try {
    await databaseService.deleteTag(req.params.id);
    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tag'
    });
  }
});

// PUT /api/endpoints/:id/tags - Set tags for an endpoint
router.put('/endpoints/:id/tags', async (req, res) => {
  try {
    const { tagIds } = req.body;
    const endpoint = await databaseService.getEndpointById(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    const tags = await databaseService.setEndpointTags(req.params.id, tagIds || []);
    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    logger.error('Error setting endpoint tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set endpoint tags'
    });
  }
});

// PUT /api/api_keys/:id/tags - Set tags for an API key (deprecated - TOKEN_TAGS table no longer used)
// This route is kept for backward compatibility but token tags are no longer supported
router.put('/api_keys/:id/tags', async (req, res) => {
  try {
    const { tagIds } = req.body;
    const token = await databaseService.getPATTokenById(req.params.id);
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // TOKEN_TAGS table is no longer used, so this operation is a no-op
    // Return empty array to maintain API compatibility
    res.json({
      success: true,
      data: [],
      message: 'Token tags are no longer supported. This operation has no effect.'
    });
  } catch (error) {
    logger.error('Error setting API key tags:', error);
    res.status(500).json({
      success: false,
      error: 'API key tags are no longer supported'
    });
  }
});

module.exports = router;
