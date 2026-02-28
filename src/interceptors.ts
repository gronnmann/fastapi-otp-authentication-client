import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import type { OTPAuthClient } from './client';

/**
 * Setup axios interceptors for automatic token management
 *
 * Request interceptor: Injects Authorization header with access token
 * Response interceptor: Handles 401 errors by refreshing token and retrying request
 *
 * @param axiosInstance - Axios instance to configure
 * @param client - OTP Auth Client instance
 */
export function setupInterceptors(axiosInstance: AxiosInstance, client: OTPAuthClient): void {
  // Request interceptor: Add Authorization header
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = client.tokenManager.getAccessToken();

      // Only add Authorization header if:
      // 1. Token exists
      // 2. Not an auth endpoint (to avoid adding token to login/refresh/logout)
      const isAuthEndpoint =
        config.url?.includes('/request-otp') ||
        config.url?.includes('/verify-otp') ||
        config.url?.includes('/refresh') ||
        config.url?.includes('/logout');

      if (token && !isAuthEndpoint) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor: Handle 401 errors with automatic token refresh
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // Check if this is a 401 error and we haven't already retried
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        // Don't retry if this is already a refresh or auth endpoint
        const isAuthEndpoint =
          originalRequest.url?.includes('/refresh') ||
          originalRequest.url?.includes('/verify-otp') ||
          originalRequest.url?.includes('/request-otp');

        if (isAuthEndpoint) {
          return Promise.reject(error);
        }

        // Mark request as retried
        originalRequest._retry = true;

        try {
          // Attempt to refresh the token
          await client.refresh();

          // Get the new token
          const newToken = client.tokenManager.getAccessToken();

          // Update the Authorization header with new token
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }

          // Retry the original request with new token
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // Refresh failed - user needs to login again
          client.tokenManager.clearTokens();
          client.events.emit('logout', { reason: 'token_refresh_failed' });
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
}
