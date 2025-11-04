const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');

/**
 * Telemetry middleware - logs all API requests to database with detailed metrics
 * Captures start/end time, IP address, response times, request/response sizes, etc.
 */
const telemetry = async (req, res, next) => {
  // Skip telemetry for health checks and static assets
  if (req.path === '/health' || req.path.startsWith('/static/')) {
    return next();
  }

  const startTime = Date.now();
  const startTimestamp = new Date();
  
  // Get real client IP address (handles proxies)
  const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           'unknown';
  };

  const clientIp = getClientIp(req);
  const forwardedFor = req.headers['x-forwarded-for'] || null;
  const requestId = req.requestId || req.headers['x-request-id'] || null;
  
  // Capture request size
  const requestSize = req.headers['content-length'] 
    ? parseInt(req.headers['content-length']) 
    : (req.body ? JSON.stringify(req.body).length : 0);

  // Store telemetry data on request object
  req.telemetry = {
    startTime,
    startTimestamp,
    clientIp,
    forwardedFor,
    requestId,
    requestSize
  };

  // Capture response details
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function (body) {
    logTelemetry(req, res, startTime, startTimestamp, clientIp, forwardedFor, requestSize, body, null);
    return originalSend.call(this, body);
  };

  res.json = function (body) {
    // body is already an object for res.json, so we can use it directly
    logTelemetry(req, res, startTime, startTimestamp, clientIp, forwardedFor, requestSize, body, null);
    return originalJson.call(this, body);
  };

  // Handle errors
  res.on('finish', () => {
    if (res.statusCode >= 400 && !res.telemetryLogged) {
      logTelemetry(req, res, startTime, startTimestamp, clientIp, forwardedFor, requestSize, null, 'Request completed with error');
    }
  });

  next();
};

/**
 * Log telemetry data to database
 */
async function logTelemetry(req, res, startTime, startTimestamp, clientIp, forwardedFor, requestSize, responseBody, errorMessage) {
  // Mark as logged to prevent duplicate logging
  res.telemetryLogged = true;

  const endTime = Date.now();
  const endTimestamp = new Date();
  const duration = endTime - startTime;
  let responseSize = 0;
  if (responseBody) {
    if (typeof responseBody === 'string') {
      responseSize = responseBody.length;
    } else {
      try {
        responseSize = JSON.stringify(responseBody).length;
      } catch (e) {
        // If stringify fails, estimate size
        responseSize = 0;
      }
    }
  }

  // Get user ID from request if available
  const userId = req.user?.id || req.user?.userId || null;

  // Determine endpoint ID and API key ID from request context
  const endpointId = req.endpoint?.id || null;
  const apiKeyId = req.tokenData?.id || req.tokenData?.tokenId || null;

  // Get route path (remove query string)
  const routePath = req.route?.path || req.path || req.originalUrl?.split('?')[0] || null;

  const telemetryData = {
    requestId: req.requestId || null,
    endpointId,
    apiKeyId,
    method: req.method,
    url: req.originalUrl || req.url,
    routePath,
    ip: clientIp,
    forwardedFor,
    userAgent: req.get('user-agent') || null,
    body: req.body && Object.keys(req.body).length > 0 ? sanitizeBody(req.body) : null,
    requestSize,
    status: res.statusCode,
    responseSize,
    responseTime: duration,
    startTime: startTimestamp,
    endTime: endTimestamp,
    errorMessage: errorMessage || (res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null),
    userId
  };

  // Log to database asynchronously (don't block response)
  databaseService.logApiRequest(telemetryData).catch(err => {
    logger.warn(`Failed to log telemetry for request ${req.requestId}:`, err.message);
  });
}

/**
 * Sanitize request body by removing sensitive fields
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key', 'x-api-key', 'authorization', 'creditCard', 'ssn'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  });

  return sanitized;
}

module.exports = telemetry;

