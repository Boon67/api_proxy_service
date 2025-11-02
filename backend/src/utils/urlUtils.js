/**
 * Utility functions for generating endpoint URLs based on environment
 */

const fs = require('fs');

/**
 * Detects if the application is running in Snowflake Container Services (SPCS)
 * @returns {boolean} True if running in SPCS, false if local
 */
function isSPCS() {
  // Check for SPCS-specific environment variables or files
  try {
    return !!(
      process.env.SNOWFLAKE_HOST ||
      process.env.SERVICE_NAME ||
      (fs.existsSync && fs.existsSync('/snowflake/session/token'))
    );
  } catch (e) {
    return false;
  }
}

/**
 * Gets the base URL for the API proxy service
 * Endpoints should be accessible through the frontend URL (not backend directly)
 * @returns {string} Base URL (e.g., http://localhost:3000/api/proxy or https://xxx.snowflakecomputing.app/api/proxy)
 */
function getBaseUrl() {
  // If running in SPCS, use the SERVICE_URL environment variable
  if (process.env.SERVICE_URL) {
    // SERVICE_URL is already a full URL (e.g., https://xxx.snowflakecomputing.app)
    // Frontend proxies /api/* to backend, so endpoints are at /api/proxy
    return `${process.env.SERVICE_URL}/api/proxy`;
  }
  
  // If FRONTEND_URL is set, use it
  if (process.env.FRONTEND_URL) {
    // FRONTEND_URL points to the frontend
    // Frontend proxies /api/* to backend, so endpoints are at /api/proxy
    const url = new URL(process.env.FRONTEND_URL);
    return `${url.origin}/api/proxy`;
  }
  
  // Default to localhost frontend for development (port 3000)
  // Frontend proxies /api/* to backend (port 3001), so endpoints are at /api/proxy
  return `http://localhost:3000/api/proxy`;
}

/**
 * Generates the full URL for an endpoint
 * @param {string} endpointId - The endpoint ID
 * @param {string} token - Optional PAT token (if not provided, token must be in Authorization header)
 * @returns {string} Full endpoint URL
 */
function getEndpointUrl(endpointId, token = null) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/${endpointId}`;
  
  // If token is provided, add it as a query parameter (optional - can also use Authorization header)
  if (token) {
    return `${url}?token=${token}`;
  }
  
  return url;
}

module.exports = {
  isSPCS,
  getBaseUrl,
  getEndpointUrl
};

