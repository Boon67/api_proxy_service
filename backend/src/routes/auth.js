const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const databaseService = require('../services/databaseService');

const router = express.Router();

// Login endpoint - handle GET requests with Method Not Allowed
router.get('/login', (req, res) => {
  res.status(405).json({
    success: false,
    error: 'Method Not Allowed',
    message: 'Use POST method for login'
  });
});

// Login endpoint
router.post('/login', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || require('uuid').v4();
  
  try {
    logger.info(`[${requestId}] Login request received`, {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      origin: req.get('origin'),
      bodyKeys: Object.keys(req.body)
    });

    const { username, password } = req.body;

    if (!username || !password) {
      logger.warn(`[${requestId}] Login failed: Missing credentials`, {
        hasUsername: !!username,
        hasPassword: !!password
      });
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    logger.debug(`[${requestId}] Attempting login for username: ${username}`);

    // Find user in database
    const user = await databaseService.getUserByUsername(username);
    if (!user) {
      logger.warn(`[${requestId}] Login failed: User not found`, { username });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    logger.debug(`[${requestId}] User found, verifying password for: ${username}`);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!isValidPassword) {
      logger.warn(`[${requestId}] Login failed: Invalid password`, { username });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Update last login
    await databaseService.updateUserLastLogin(username);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.USER_ID, 
        username: user.USERNAME, 
        role: user.ROLE 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] Login successful`, {
      username: user.USERNAME,
      userId: user.USER_ID,
      role: user.ROLE,
      duration: `${duration}ms`
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.USER_ID,
          username: user.USERNAME,
          email: user.EMAIL,
          role: user.ROLE
        }
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] Login error`, {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
      errorName: error.name,
      errorCode: error.code,
      sqlState: error.sqlState,
      sqlCode: error.sqlCode
    });
    // Log to console for debugging
    console.error(`[${requestId}] Login error details:`, {
      message: error.message,
      name: error.name,
      code: error.code,
      sqlState: error.sqlState,
      sqlCode: error.sqlCode,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Optionally verify user still exists in database
    const user = await databaseService.getUserById(decoded.userId);
    if (!user || !user.IS_ACTIVE) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: decoded.userId,
          username: decoded.username,
          role: decoded.role
        }
      }
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

module.exports = router;

