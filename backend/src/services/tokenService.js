const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const databaseService = require('./databaseService');

class TokenService {
  constructor() {
    // Token service now uses database via databaseService
  }

  generatePATToken() {
    // Generate a cryptographically secure random token
    const token = crypto.randomBytes(32).toString('hex');
    return token;
  }

  hashToken(token) {
    // Hash token for storage (use SHA256)
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateJWTToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
  }

  verifyJWTToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      logger.error('JWT verification error:', error);
      return null;
    }
  }

  async createPATToken(endpointId, metadata = {}) {
    const token = this.generatePATToken();
    const tokenHash = this.hashToken(token);
    
    // Store hashed token in database
    const tokenData = await databaseService.createPATToken(endpointId, tokenHash, metadata);
    
    // Return token data with actual token (only returned once during creation)
    logger.info(`PAT token created for endpoint ${endpointId}`);
    
    return {
      ...tokenData,
      token // Return the actual token (not hash) for the first time only
    };
  }

  async validatePATToken(token) {
    const tokenHash = this.hashToken(token);
    const tokenData = await databaseService.getPATTokenByHash(tokenHash);
    
    if (!tokenData || !tokenData.isActive) {
      return null;
    }

    // Update usage statistics
    try {
    await databaseService.updatePATTokenUsage(tokenData.id);
      logger.debug(`PAT token usage updated: tokenId=${tokenData.id}`);
    } catch (error) {
      logger.error('Error updating PAT token usage in validatePATToken:', error);
      // Don't fail token validation if usage update fails
    }

    return {
      ...tokenData,
      token // Include token for backward compatibility
    };
  }

  async revokePATToken(token, revokedBy = 'system') {
    const tokenHash = this.hashToken(token);
    const result = await databaseService.revokePATToken(tokenHash, revokedBy);
    logger.info(`PAT token revoked: ${token.substring(0, 8)}...`);
    return result;
  }

  async getTokenByEndpointId(endpointId) {
    const tokenData = await databaseService.getPATTokenByEndpointId(endpointId);
    if (!tokenData) {
      return null;
    }
    // Note: We don't return the actual token, only metadata
    // The actual token is only returned during creation
    return tokenData;
  }

  async getAllTokens() {
    return await databaseService.getAllPATTokens();
  }

  async getTokenStats() {
    return await databaseService.getTokenStats();
  }

  async cleanupExpiredTokens() {
    // This could be implemented as a scheduled job
    // For now, tokens don't expire automatically
    logger.info('Token cleanup called (not implemented for database storage)');
  }
}

module.exports = new TokenService();
