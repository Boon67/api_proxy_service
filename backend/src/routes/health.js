const express = require('express');
const snowflakeService = require('../services/snowflakeService');
const tokenService = require('../services/tokenService');
const logger = require('../utils/logger');

const router = express.Router();

// Basic health check
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    services: {}
  };

  try {
    // Check Snowflake connection - use loadConfig to get current config (SPCS or local)
    const config = snowflakeService.loadConfig();
    const snowflakeTest = await snowflakeService.testConnection(config);
    health.services.snowflake = {
      status: snowflakeTest.success ? 'healthy' : 'unhealthy',
      message: snowflakeTest.message
    };

    if (!snowflakeTest.success) {
      health.status = 'degraded';
    }

  } catch (error) {
    logger.error('Snowflake health check failed:', error);
    health.services.snowflake = {
      status: 'unhealthy',
      message: error.message
    };
    health.status = 'degraded';
  }

  // Check token service
  try {
    const tokenStats = tokenService.getTokenStats();
    health.services.tokens = {
      status: 'healthy',
      stats: tokenStats
    };
  } catch (error) {
    logger.error('Token service health check failed:', error);
    health.services.tokens = {
      status: 'unhealthy',
      message: error.message
    };
    health.status = 'degraded';
  }

  // Check environment variables
  const requiredEnvVars = [
    'SNOWFLAKE_ACCOUNT',
    'SNOWFLAKE_USERNAME',
    'SNOWFLAKE_PASSWORD',
    'SNOWFLAKE_WAREHOUSE',
    'SNOWFLAKE_DATABASE'
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    health.services.environment = {
      status: 'unhealthy',
      message: `Missing environment variables: ${missingEnvVars.join(', ')}`
    };
    health.status = 'unhealthy';
  } else {
    health.services.environment = {
      status: 'healthy',
      message: 'All required environment variables present'
    };
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

// Readiness check
router.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are ready - use loadConfig to get current config
    const config = snowflakeService.loadConfig();
    const snowflakeTest = await snowflakeService.testConnection(config);
    
    if (!snowflakeTest.success) {
      return res.status(503).json({
        status: 'not ready',
        message: 'Snowflake connection failed',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'ready',
      message: 'Service is ready to accept requests',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      message: 'Service is not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness check
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    message: 'Service is alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
