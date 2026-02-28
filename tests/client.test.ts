import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { OTPAuthClient } from '../src/client';
import { AuthError } from '../src/types';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('OTPAuthClient', () => {
  let client: OTPAuthClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    mockedAxios.create = vi.fn(() => mockAxiosInstance);

    client = new OTPAuthClient({
      baseURL: 'https://api.example.com',
      authPrefix: '/auth',
    });
  });

  describe('Initialization', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.example.com',
          timeout: 10000,
          withCredentials: true,
        })
      );
    });

    it('should setup interceptors by default', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should not setup interceptors when autoRefresh is false', () => {
      const mockInstance = {
        post: vi.fn(),
        get: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };
      mockedAxios.create = vi.fn(() => mockInstance);

      new OTPAuthClient({
        baseURL: 'https://api.example.com',
        autoRefresh: false,
      });

      expect(mockInstance.interceptors.request.use).not.toHaveBeenCalled();
    });
  });

  describe('requestOTP', () => {
    it('should request OTP successfully', async () => {
      const mockResponse = { data: { message: 'OTP sent' } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.requestOTP('test@example.com');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/request-otp', {
        email: 'test@example.com',
      });
      expect(result).toEqual({ message: 'OTP sent' });
    });

    it('should throw AuthError on failure', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: { detail: 'Email not found' },
          status: 404,
        },
        isAxiosError: true,
      });

      mockedAxios.isAxiosError = vi.fn(() => true);

      await expect(client.requestOTP('test@example.com')).rejects.toThrow(AuthError);
    });
  });

  describe('verifyOTP', () => {
    it('should verify OTP successfully', async () => {
      const mockToken = 'mock-access-token';
      const mockResponse = {
        data: {
          access_token: mockToken,
          token_type: 'bearer',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const loginListener = vi.fn();
      client.events.on('login', loginListener);

      const result = await client.verifyOTP('test@example.com', '123456');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/verify-otp', {
        email: 'test@example.com',
        code: '123456',
      });
      expect(result.access_token).toBe(mockToken);
      expect(client.tokenManager.getAccessToken()).toBe(mockToken);
      expect(loginListener).toHaveBeenCalledWith({
        email: 'test@example.com',
        accessToken: mockToken,
      });
    });

    it('should throw AuthError on invalid OTP', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: { detail: 'Invalid OTP code' },
          status: 401,
        },
        isAxiosError: true,
      });

      mockedAxios.isAxiosError = vi.fn(() => true);

      await expect(client.verifyOTP('test@example.com', '999999')).rejects.toThrow(AuthError);
    });
  });

  describe('refresh', () => {
    it('should refresh token successfully', async () => {
      const newToken = 'new-access-token';
      const mockResponse = {
        data: {
          access_token: newToken,
          token_type: 'bearer',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const refreshListener = vi.fn();
      client.events.on('tokenRefreshed', refreshListener);

      const result = await client.refresh();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/refresh');
      expect(result.access_token).toBe(newToken);
      expect(client.tokenManager.getAccessToken()).toBe(newToken);
      expect(refreshListener).toHaveBeenCalledWith({ accessToken: newToken });
    });

    it('should clear tokens on refresh failure', async () => {
      client.tokenManager.setAccessToken('old-token');

      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: { detail: 'Refresh token expired' },
          status: 401,
        },
        isAxiosError: true,
      });

      mockedAxios.isAxiosError = vi.fn(() => true);

      await expect(client.refresh()).rejects.toThrow(AuthError);
      expect(client.tokenManager.getAccessToken()).toBeNull();
    });

    it('should prevent multiple simultaneous refresh calls', async () => {
      const mockResponse = {
        data: { access_token: 'new-token', token_type: 'bearer' },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const [result1, result2, result3] = await Promise.all([
        client.refresh(),
        client.refresh(),
        client.refresh(),
      ]);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      client.tokenManager.setAccessToken('token-to-clear');
      const mockResponse = { data: { message: 'Logged out' } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const logoutListener = vi.fn();
      client.events.on('logout', logoutListener);

      const result = await client.logout();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/logout');
      expect(result).toEqual({ message: 'Logged out' });
      expect(client.tokenManager.getAccessToken()).toBeNull();
      expect(logoutListener).toHaveBeenCalled();
    });

    it('should clear tokens even if logout request fails', async () => {
      client.tokenManager.setAccessToken('token-to-clear');
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));
      mockedAxios.isAxiosError = vi.fn(() => false);

      await expect(client.logout()).rejects.toThrow();
      expect(client.tokenManager.getAccessToken()).toBeNull();
    });
  });

  describe('Authentication State', () => {
    it('should return false when not authenticated', () => {
      expect(client.isAuthenticated()).toBe(false);
    });

    it('should return true when authenticated with valid token', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const validToken = createMockToken({ sub: 'user-123', type: 'access', exp: futureTimestamp });
      client.tokenManager.setAccessToken(validToken);
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should get user ID from token', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 7200;
      const validToken = createMockToken({ sub: 'user-456', type: 'access', exp: futureTimestamp });
      client.tokenManager.setAccessToken(validToken);
      expect(client.getUserId()).toBe('user-456');
    });

    it('should get custom claims', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 7200;
      const validToken = createMockToken({
        sub: 'user-789',
        type: 'access',
        exp: futureTimestamp,
        role: 'admin',
      });
      client.tokenManager.setAccessToken(validToken);
      const claims = client.getClaims();
      expect(claims?.role).toBe('admin');
    });
  });

  describe('initialize', () => {
    it('should restore session from cookie', async () => {
      const mockResponse = {
        data: { access_token: 'restored-token', token_type: 'bearer' },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const restored = await client.initialize();

      expect(restored).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/refresh');
      expect(client.tokenManager.getAccessToken()).toBe('restored-token');
    });

    it('should return false when no valid session', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: { data: { detail: 'No refresh token' }, status: 401 },
        isAxiosError: true,
      });
      mockedAxios.isAxiosError = vi.fn(() => true);

      const restored = await client.initialize();

      expect(restored).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should emit authError event on errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: { detail: 'Test error' },
          status: 400,
        },
        isAxiosError: true,
      });
      mockedAxios.isAxiosError = vi.fn(() => true);

      const errorListener = vi.fn();
      client.events.on('authError', errorListener);

      await expect(client.requestOTP('test@example.com')).rejects.toThrow();
      expect(errorListener).toHaveBeenCalledWith({
        error: {
          detail: 'Test error',
          status: 400,
        },
      });
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
