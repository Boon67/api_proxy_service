const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const requestLogger = require('./middleware/requestLogger');
const telemetry = require('./middleware/telemetry');
const apiRoutes = require('./routes/api');
const proxyRoutes = require('./routes/proxy');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy to get real client IP (important for SPCS deployment)
app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// CORS configuration - allow requests from frontend
// In SPCS, requests come from *.snowflakecomputing.app domains
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow Snowflake Container Services domains
    if (origin.includes('.snowflakecomputing.app') || origin.includes('.snowflakecomputing.com')) {
      return callback(null, true);
    }
    
    // Allow explicit FRONTEND_URL if set
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
// When trust proxy is enabled, we need to disable the validation warning
// and use a keyGenerator that properly extracts the real IP from headers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  // Disable trust proxy validation since we're properly handling it with keyGenerator
  validate: {
    trustProxy: false
  },
  // Use the real IP from headers when behind a proxy
  keyGenerator: (req) => {
    // Get the real IP from X-Forwarded-For header (first IP in the chain)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      return ips[0]; // Return the original client IP (first in chain)
    }
    // Fallback to X-Real-IP header
    if (req.headers['x-real-ip']) {
      return req.headers['x-real-ip'];
    }
    // Final fallback to connection remote address
    return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  },
  // Skip successful health checks to avoid rate limiting them
  skip: (req) => {
    return req.path === '/health' || req.path.startsWith('/health/');
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Enhanced request logging middleware (before morgan for detailed logging)
app.use(requestLogger);

// Telemetry middleware - logs all requests to database with metrics
// Applied after requestLogger so we have requestId available
app.use(telemetry);

// Standard HTTP request logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Health check route (no auth required)
app.use('/health', healthRoutes);

// Auth routes (no auth required)
// Mount at both /auth and /api/auth for compatibility
// Frontend uses /api as base URL in production, so /auth/login becomes /api/auth/login
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

// User management routes (require authentication)
app.use('/api', authMiddleware, userRoutes);

// API management routes (require admin auth)
app.use('/api', authMiddleware, apiRoutes);

// Proxy routes (require PAT token)
app.use('/proxy', proxyRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Snowflake API Proxy Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Validate Snowflake connection on startup
async function validateSnowflakeConnection() {
  const databaseService = require('./services/databaseService');
  const snowflakeService = require('./services/snowflakeService');
  
  try {
    logger.info('🔍 Validating Snowflake connection...');
    
    // Load configuration
    const config = snowflakeService.loadConfig();
    
    // Check for missing credentials
    if (!config.account) {
      throw new Error('SNOWFLAKE_ACCOUNT is not configured. Please check config/snowflake.json or environment variables.');
    }
    
    if (!config.username && !snowflakeService.getOAuthToken()) {
      throw new Error('SNOWFLAKE_USERNAME is not configured. Please check config/snowflake.json or environment variables.');
    }
    
    if (!config.token && !config.password && !snowflakeService.getOAuthToken()) {
      throw new Error('No authentication method configured. Please provide either:\n' +
        '  - PAT token (recommended): Add "token" field in config/snowflake.json\n' +
        '  - Username/password: Add "username" and "password" fields\n' +
        '  - OAuth token (SPCS only): Ensure /snowflake/session/token exists');
    }
    
    if (!config.warehouse) {
      logger.warn('⚠️  SNOWFLAKE_WAREHOUSE is not configured. Some queries may fail.');
    }
    
    if (!config.database) {
      throw new Error('SNOWFLAKE_DATABASE is not configured. Please check config/snowflake.json or environment variables.');
    }
    
    // Test database connection
    const connection = await databaseService.getConnection();
    
    // Run a simple test query
    await databaseService.executeQuery('SELECT 1 AS test');
    
    logger.info('✅ Snowflake connection validated successfully');
    logger.info(`   Database: ${config.database}.${config.schema}`);
    logger.info(`   Warehouse: ${config.warehouse || 'NOT SET'}`);
    logger.info(`   Role: ${config.role || 'NOT SET'}`);
    
    return true;
  } catch (error) {
    logger.error('❌ Snowflake connection validation FAILED');
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.error('');
    logger.error('ERROR:', error.message);
    logger.error('');
    
    // Provide helpful error messages based on error type
    if (error.message.includes('Programmatic access token is invalid') || 
        error.message.includes('token') ||
        error.code === '390144') {
      logger.error('💡 Your PAT token has expired or is invalid.');
      logger.error('');
      logger.error('To fix this issue:');
      logger.error('');
      logger.error('1. Generate a new PAT token in Snowflake:');
      logger.error('   USE ROLE ACCOUNTADMIN;');
      logger.error('   ALTER USER <username>');
      logger.error('     ADD PROGRAMMATIC ACCESS TOKEN API_PROXY_TOKEN');
      logger.error('     DAYS_TO_EXPIRY = 365;');
      logger.error('');
      logger.error('2. Copy the token_secret value (starts with "snpat_" or "eyJ")');
      logger.error('');
      logger.error('3. Update config/snowflake.json:');
      logger.error('   {');
      logger.error('     "account": "your-account.snowflakecomputing.com",');
      logger.error('     "username": "your-username",');
      logger.error('     "token": "your-new-token-here",  // Replace "password" with "token"');
      logger.error('     "warehouse": "API_PROXY_WH",');
      logger.error('     "database": "API_PROXY",');
      logger.error('     "schema": "APP",');
      logger.error('     "role": "API_PROXY_SERVICE_ROLE"');
      logger.error('   }');
      logger.error('');
      logger.error('4. Restart the backend server');
      logger.error('');
      logger.error('For more information, see: docs/SNOWFLAKE_SETUP.md');
    } else if (error.message.includes('Incorrect username or password') ||
               error.message.includes('authentication')) {
      logger.error('💡 Authentication failed. Please check your credentials.');
      logger.error('');
      logger.error('Verify in config/snowflake.json:');
      logger.error('  - username is correct');
      logger.error('  - password or token is valid');
      logger.error('  - account identifier is correct (e.g., "ABC12345.snowflakecomputing.com")');
    } else if (error.message.includes('does not exist') || error.message.includes('Object')) {
      logger.error('💡 Database object not found.');
      logger.error('');
      logger.error('Please ensure:');
      logger.error('  - Database exists: ' + (databaseService.dbConfig?.database || 'NOT SET'));
      logger.error('  - Schema exists: ' + (databaseService.dbConfig?.schema || 'NOT SET'));
      logger.error('  - User has access to the database');
      logger.error('');
      logger.error('Run the setup script:');
      logger.error('  ./scripts/deploy.sh');
    } else if (error.message.includes('warehouse')) {
      logger.error('💡 Warehouse issue detected.');
      logger.error('');
      logger.error('Please ensure:');
      logger.error('  - Warehouse exists and is running');
      logger.error('  - User has USAGE privilege on the warehouse');
      logger.error('  - Warehouse name is correct in config');
    }
    
    logger.error('');
    logger.error('Full error details:');
    if (error.code) logger.error('  Error code:', error.code);
    if (error.sqlState) logger.error('  SQL state:', error.sqlState);
    logger.error('  Error message:', error.message);
    logger.error('');
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.error('');
    logger.error('⚠️  Server is starting but LOGIN WILL NOT WORK until Snowflake connection is fixed.');
    logger.error('');
    
    return false;
  }
}

// Start server
app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('');
  
  // Validate Snowflake connection (non-blocking)
  await validateSnowflakeConnection();
});

module.exports = app;
