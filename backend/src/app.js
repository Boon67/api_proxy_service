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

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
