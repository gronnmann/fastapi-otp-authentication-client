import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { OTPAuthClient } from '../src/client';

vi.mock('axios');
const mockedAxios = axios as any;

describe('OTPAuthClient - Integration Tests', () => {
  let client: OTPAuthClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    mockedAxios.create = vi.fn(() => mockAxiosInstance);
    mockedAxios.isAxiosError = vi.fn(() => true);

    client = new OTPAuthClient({
      baseURL: 'https://api.example.com',
      authPrefix: '/auth',
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full OTP authentication flow', async () => {
      // Step 1: Request OTP
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { message: 'OTP code has been sent to your email' },
      });

      await client.requestOTP('user@example.com');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/request-otp', {
        email: 'user@example.com',
      });

      // Step 2: Verify OTP and receive token
      const accessToken = createMockToken({
        sub: 'user-123',
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          access_token: accessToken,
          token_type: 'bearer',
        },
      });

      const loginResult = await client.verifyOTP('user@example.com', '123456');
      expect(loginResult.access_token).toBe(accessToken);
      expect(client.isAuthenticated()).toBe(true);

      // Step 3: Token is automatically refreshed when needed
      const newToken = createMockToken({
        sub: 'user-123',
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          access_token: newToken,
          token_type: 'bearer',
        },
      });

      await client.refresh();
      expect(client.tokenManager.getAccessToken()).toBe(newToken);

      // Step 4: Logout
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { message: 'Successfully logged out' },
      });

      await client.logout();
      expect(client.isAuthenticated()).toBe(false);
      expect(client.tokenManager.getAccessToken()).toBeNull();
    });
  });

  describe('Event Flow Integration', () => {
    it('should emit events in correct order during auth flow', async () => {
      const events: string[] = [];

      client.events.on('login', () => events.push('login'));
      client.events.on('tokenRefreshed', () => events.push('tokenRefreshed'));
      client.events.on('logout', () => events.push('logout'));
      client.events.on('authError', () => events.push('authError'));

      // Login
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          access_token: createMockToken({
            sub: 'user-123',
            type: 'access',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
          token_type: 'bearer',
        },
      });
      await client.verifyOTP('user@example.com', '123456');

      // Refresh
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          access_token: createMockToken({
            sub: 'user-123',
            type: 'access',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
          token_type: 'bearer',
        },
      });
      await client.refresh();

      // Logout
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { message: 'Successfully logged out' },
      });
      await client.logout();

      expect(events).toEqual(['login', 'tokenRefreshed', 'logout']);
    });

    it('should emit authError event on failures', async () => {
      const errorEvents: any[] = [];
      client.events.on('authError', (payload) => errorEvents.push(payload));

      // Failed OTP request
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          data: { detail: 'User not found' },
          status: 404,
        },
        isAxiosError: true,
      });

      try {
        await client.requestOTP('nonexistent@example.com');
      } catch (error) {
        // Expected
      }

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].error.detail).toBe('User not found');
      expect(errorEvents[0].error.status).toBe(404);
    });
  });

  describe('Session Restoration', () => {
    it('should restore session on initialize', async () => {
      const restoredToken = createMockToken({
        sub: 'user-456',
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          access_token: restoredToken,
          token_type: 'bearer',
        },
      });

      const restored = await client.initialize();

      expect(restored).toBe(true);
      expect(client.isAuthenticated()).toBe(true);
      expect(client.tokenManager.getAccessToken()).toBe(restoredToken);
      expect(client.getUserId()).toBe('user-456');
    });

    it('should handle missing session gracefully', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          data: { detail: 'Refresh token not found in cookies' },
          status: 401,
        },
        isAxiosError: true,
      });

      const restored = await client.initialize();

      expect(restored).toBe(false);
      expect(client.isAuthenticated()).toBe(false);
      expect(client.tokenManager.getAccessToken()).toBeNull();
    });
  });

  describe('Token Lifecycle', () => {
    it('should handle token expiration and refresh cycle', async () => {
      // Login with soon-to-expire token
      const shortLivedToken = createMockToken({
        sub: 'user-789',
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + 200, // Expires in 200 seconds
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          access_token: shortLivedToken,
          token_type: 'bearer',
        },
      });

      await client.verifyOTP('user@example.com', '123456');
      expect(client.isAuthenticated()).toBe(false); // Token is within refresh buffer

      // Refresh to get new token
      const freshToken = createMockToken({
        sub: 'user-789',
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          access_token: freshToken,
          token_type: 'bearer',
        },
      });

      await client.refresh();
      expect(client.isAuthenticated()).toBe(true);
      expect(client.tokenManager.getAccessToken()).toBe(freshToken);
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
