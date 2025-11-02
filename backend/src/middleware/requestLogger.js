const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced request logging middleware
 * Logs detailed information about incoming requests
 */
const requestLogger = (req, res, next) => {
  // Generate or use existing request ID
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  
  // Set request ID in response header
  res.setHeader('X-Request-ID', requestId);
  
  const startTime = Date.now();
  
  // Log incoming request
  logger.info(`[${requestId}] ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    origin: req.get('origin'),
    referer: req.get('referer'),
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
    authorization: req.get('authorization') ? 'Bearer ***' : undefined,
    bodySize: req.body && typeof req.body === 'object' ? JSON.stringify(req.body).length : 0,
    params: Object.keys(req.params).length > 0 ? req.params : undefined
  });
  
  // Log request body for non-sensitive endpoints (exclude passwords, tokens)
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    // Remove sensitive fields
    if (sanitizedBody.password) sanitizedBody.password = '***';
    if (sanitizedBody.token) sanitizedBody.token = '***';
    if (sanitizedBody.secret) sanitizedBody.secret = '***';
    
    logger.debug(`[${requestId}] Request body:`, sanitizedBody);
  }
  
  // Capture response details
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info(`[${requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: body ? (typeof body === 'string' ? body.length : JSON.stringify(body).length) : 0,
      contentType: res.get('content-type')
    });
    
    // Log response body for errors or debug mode
    if (process.env.LOG_RESPONSES === 'true' || res.statusCode >= 400) {
      try {
        const responseBody = typeof body === 'string' ? JSON.parse(body) : body;
        const sanitizedResponse = { ...responseBody };
        if (sanitizedResponse.data && sanitizedResponse.data.token) {
          sanitizedResponse.data.token = '***';
        }
        logger.debug(`[${requestId}] Response body:`, sanitizedResponse);
      } catch (e) {
        // Not JSON, skip
      }
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

module.exports = requestLogger;

