const tokenService = require('../../src/services/tokenService');

describe('TokenService', () => {
  beforeEach(() => {
    // Clear tokens before each test
    tokenService.tokens.clear();
  });

  describe('generatePATToken', () => {
    it('should generate a valid PAT token', () => {
      const token = tokenService.generatePATToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes hex-encoded
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const token1 = tokenService.generatePATToken();
      const token2 = tokenService.generatePATToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateJWTToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = { userId: '123', username: 'test' };
      const token = tokenService.generateJWTToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyJWTToken', () => {
    it('should verify a valid JWT token', () => {
      const payload = { userId: '123', username: 'test' };
      const token = tokenService.generateJWTToken(payload);
      const decoded = tokenService.verifyJWTToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe('123');
      expect(decoded.username).toBe('test');
    });

    it('should return null for invalid token', () => {
      const decoded = tokenService.verifyJWTToken('invalid.token.here');
      
      expect(decoded).toBeNull();
    });
  });

  describe('createPATToken', () => {
    it('should create a PAT token with metadata', () => {
      const endpointId = 'endpoint-123';
      const metadata = { endpointName: 'Test Endpoint' };
      
      const tokenData = tokenService.createPATToken(endpointId, metadata);
      
      expect(tokenData).toBeDefined();
      expect(tokenData.id).toBeDefined();
      expect(tokenData.token).toBeDefined();
      expect(tokenData.endpointId).toBe(endpointId);
      expect(tokenData.createdAt).toBeDefined();
      expect(tokenData.lastUsed).toBeNull();
      expect(tokenData.usageCount).toBe(0);
      expect(tokenData.isActive).toBe(true);
      expect(tokenData.metadata).toEqual(metadata);
    });

    it('should store token in memory', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      
      const storedToken = tokenService.tokens.get(tokenData.token);
      expect(storedToken).toEqual(tokenData);
    });
  });

  describe('validatePATToken', () => {
    it('should validate an active token', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      
      const validatedToken = tokenService.validatePATToken(tokenData.token);
      
      expect(validatedToken).toBeDefined();
      expect(validatedToken.endpointId).toBe(endpointId);
      expect(validatedToken.usageCount).toBe(1);
      expect(validatedToken.lastUsed).toBeDefined();
    });

    it('should return null for invalid token', () => {
      const validatedToken = tokenService.validatePATToken('invalid-token');
      
      expect(validatedToken).toBeNull();
    });

    it('should return null for inactive token', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      tokenService.revokePATToken(tokenData.token);
      
      const validatedToken = tokenService.validatePATToken(tokenData.token);
      
      expect(validatedToken).toBeNull();
    });

    it('should increment usage count on validation', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      
      expect(tokenData.usageCount).toBe(0);
      
      tokenService.validatePATToken(tokenData.token);
      const updatedToken = tokenService.tokens.get(tokenData.token);
      
      expect(updatedToken.usageCount).toBe(1);
    });
  });

  describe('revokePATToken', () => {
    it('should revoke an active token', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      
      const result = tokenService.revokePATToken(tokenData.token);
      
      expect(result).toBe(true);
      
      const updatedToken = tokenService.tokens.get(tokenData.token);
      expect(updatedToken.isActive).toBe(false);
    });

    it('should return false for non-existent token', () => {
      const result = tokenService.revokePATToken('non-existent-token');
      
      expect(result).toBe(false);
    });
  });

  describe('getTokenByEndpointId', () => {
    it('should return token for active endpoint', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      
      const foundToken = tokenService.getTokenByEndpointId(endpointId);
      
      expect(foundToken).toBeDefined();
      expect(foundToken.endpointId).toBe(endpointId);
      expect(foundToken.token).toBe(tokenData.token);
    });

    it('should return null for non-existent endpoint', () => {
      const foundToken = tokenService.getTokenByEndpointId('non-existent-endpoint');
      
      expect(foundToken).toBeNull();
    });

    it('should return null for revoked token', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      tokenService.revokePATToken(tokenData.token);
      
      const foundToken = tokenService.getTokenByEndpointId(endpointId);
      
      expect(foundToken).toBeNull();
    });
  });

  describe('getAllTokens', () => {
    it('should return all tokens', () => {
      const token1 = tokenService.createPATToken('endpoint-1');
      const token2 = tokenService.createPATToken('endpoint-2');
      
      const allTokens = tokenService.getAllTokens();
      
      expect(allTokens).toHaveLength(2);
      expect(allTokens).toContainEqual(token1);
      expect(allTokens).toContainEqual(token2);
    });

    it('should return empty array when no tokens', () => {
      const allTokens = tokenService.getAllTokens();
      
      expect(allTokens).toHaveLength(0);
    });
  });

  describe('getTokenStats', () => {
    it('should return correct statistics', () => {
      const token1 = tokenService.createPATToken('endpoint-1');
      const token2 = tokenService.createPATToken('endpoint-2');
      tokenService.revokePATToken(token1.token);
      
      // Simulate usage
      tokenService.validatePATToken(token2.token);
      tokenService.validatePATToken(token2.token);
      
      const stats = tokenService.getTokenStats();
      
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1);
      expect(stats.revoked).toBe(1);
      expect(stats.totalUsage).toBe(2);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should revoke expired tokens', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      
      // Manually set old creation date
      tokenData.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      tokenService.tokens.set(tokenData.token, tokenData);
      
      tokenService.cleanupExpiredTokens();
      
      const updatedToken = tokenService.tokens.get(tokenData.token);
      expect(updatedToken.isActive).toBe(false);
    });

    it('should not revoke recent tokens', () => {
      const endpointId = 'endpoint-123';
      const tokenData = tokenService.createPATToken(endpointId);
      
      tokenService.cleanupExpiredTokens();
      
      const updatedToken = tokenService.tokens.get(tokenData.token);
      expect(updatedToken.isActive).toBe(true);
    });
  });
});
