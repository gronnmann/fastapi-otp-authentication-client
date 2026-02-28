import { describe, it, expect, beforeEach } from 'vitest';
import { TokenManager } from '../src/token-manager';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  // Valid JWT token (expires in the future)
  const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const validToken = createMockToken({
    sub: 'user-123',
    type: 'access',
    exp: futureTimestamp,
  });

  // Expired JWT token
  const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  const expiredToken = createMockToken({
    sub: 'user-123',
    type: 'access',
    exp: pastTimestamp,
  });

  // Token about to expire (within refresh buffer)
  const soonExpireTimestamp = Math.floor(Date.now() / 1000) + 200; // 200 seconds from now
  const soonExpireToken = createMockToken({
    sub: 'user-123',
    type: 'access',
    exp: soonExpireTimestamp,
  });

  beforeEach(() => {
    tokenManager = new TokenManager(300); // 5 minute refresh buffer
  });

  describe('Token Storage', () => {
    it('should initialize with no token', () => {
      expect(tokenManager.getAccessToken()).toBeNull();
    });

    it('should store and retrieve access token', () => {
      tokenManager.setAccessToken(validToken);
      expect(tokenManager.getAccessToken()).toBe(validToken);
    });

    it('should clear tokens', () => {
      tokenManager.setAccessToken(validToken);
      tokenManager.clearTokens();
      expect(tokenManager.getAccessToken()).toBeNull();
    });
  });

  describe('Token Validation', () => {
    it('should return false for no token', () => {
      expect(tokenManager.isAccessTokenValid()).toBe(false);
    });

    it('should return true for valid token', () => {
      tokenManager.setAccessToken(validToken);
      expect(tokenManager.isAccessTokenValid()).toBe(true);
    });

    it('should return false for expired token', () => {
      tokenManager.setAccessToken(expiredToken);
      expect(tokenManager.isAccessTokenValid()).toBe(false);
    });

    it('should return false for token expiring within buffer', () => {
      tokenManager.setAccessToken(soonExpireToken);
      expect(tokenManager.isAccessTokenValid()).toBe(false);
    });

    it('should return false for malformed token', () => {
      tokenManager.setAccessToken('not-a-valid-jwt');
      expect(tokenManager.isAccessTokenValid()).toBe(false);
    });
  });

  describe('Token Decoding', () => {
    it('should decode valid token', () => {
      const decoded = tokenManager.decodeToken(validToken);
      expect(decoded.claims.sub).toBe('user-123');
      expect(decoded.claims.type).toBe('access');
      expect(decoded.isExpired).toBe(false);
    });

    it('should detect expired token', () => {
      const decoded = tokenManager.decodeToken(expiredToken);
      expect(decoded.isExpired).toBe(true);
    });

    it('should throw error for invalid token', () => {
      expect(() => tokenManager.decodeToken('invalid')).toThrow();
    });

    it('should parse token claims', () => {
      tokenManager.setAccessToken(validToken);
      const claims = tokenManager.parseTokenClaims();
      expect(claims?.sub).toBe('user-123');
      expect(claims?.type).toBe('access');
    });

    it('should return null claims for no token', () => {
      expect(tokenManager.parseTokenClaims()).toBeNull();
    });
  });

  describe('User Information', () => {
    it('should get user ID from token', () => {
      tokenManager.setAccessToken(validToken);
      expect(tokenManager.getUserId()).toBe('user-123');
    });

    it('should return null user ID when no token', () => {
      expect(tokenManager.getUserId()).toBeNull();
    });
  });

  describe('Token Expiry', () => {
    it('should calculate time until expiry', () => {
      tokenManager.setAccessToken(validToken);
      const timeRemaining = tokenManager.getTimeUntilExpiry();
      expect(timeRemaining).toBeGreaterThan(3000); // More than 50 minutes (accounting for buffer)
    });

    it('should return null when no token', () => {
      expect(tokenManager.getTimeUntilExpiry()).toBeNull();
    });

    it('should return 0 for expired token', () => {
      tokenManager.setAccessToken(expiredToken);
      expect(tokenManager.getTimeUntilExpiry()).toBe(0);
    });
  });

  describe('Refresh Check', () => {
    it('should require refresh for no token', () => {
      expect(tokenManager.shouldRefresh()).toBe(true);
    });

    it('should not require refresh for valid token', () => {
      tokenManager.setAccessToken(validToken);
      expect(tokenManager.shouldRefresh()).toBe(false);
    });

    it('should require refresh for expired token', () => {
      tokenManager.setAccessToken(expiredToken);
      expect(tokenManager.shouldRefresh()).toBe(true);
    });

    it('should require refresh for soon-expiring token', () => {
      tokenManager.setAccessToken(soonExpireToken);
      expect(tokenManager.shouldRefresh()).toBe(true);
    });
  });
});

/**
 * Helper function to create mock JWT tokens
 */
function createMockToken(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  return `${encodedHeader}.${encodedPayload}.mock-signature`;
}
