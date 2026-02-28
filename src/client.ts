import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  OTPAuthConfig,
  OTPRequestPayload,
  OTPVerifyPayload,
  TokenResponse,
  MessageResponse,
  AuthErrorResponse,
} from './types';
import { AuthError } from './types';
import { TokenManager } from './token-manager';
import { AuthEventEmitter } from './events';
import { setupInterceptors } from './interceptors';

/**
 * Main client for FastAPI OTP Authentication
 *
 * Features:
 * - Request and verify OTP codes
 * - Automatic token refresh with interceptors
 * - In-memory token storage (refresh token in HTTP-only cookie)
 * - Event emission for auth state changes
 * - Type-safe API methods
 *
 * @example
 * ```typescript
 * const client = new OTPAuthClient({
 *   baseURL: 'https://api.example.com',
 *   authPrefix: '/auth'
 * });
 *
 * // Request OTP
 * await client.requestOTP('user@example.com');
 *
 * // Verify OTP
 * const { access_token } = await client.verifyOTP('user@example.com', '123456');
 *
 * // Make authenticated requests
 * const response = await client.axios.get('/protected-endpoint');
 * ```
 */
export class OTPAuthClient {
  public readonly axios: AxiosInstance;
  public readonly tokenManager: TokenManager;
  public readonly events: AuthEventEmitter;

  private readonly config: Required<OTPAuthConfig>;
  private refreshPromise: Promise<TokenResponse> | null = null;

  constructor(config: OTPAuthConfig) {
    // Set default config values
    this.config = {
      baseURL: config.baseURL,
      authPrefix: config.authPrefix ?? '/auth',
      autoRefresh: config.autoRefresh ?? true,
      refreshBuffer: config.refreshBuffer ?? 300,
      timeout: config.timeout ?? 10000,
      withCredentials: config.withCredentials ?? true,
      headers: config.headers ?? {},
    };

    // Initialize managers
    this.tokenManager = new TokenManager(this.config.refreshBuffer);
    this.events = new AuthEventEmitter();

    // Create axios instance
    this.axios = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      withCredentials: this.config.withCredentials,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
    });

    // Setup interceptors for automatic token injection and refresh
    if (this.config.autoRefresh) {
      setupInterceptors(this.axios, this);
    }
  }

  /**
   * Request an OTP code to be sent to the user's email
   *
   * @param email - User's email address
   * @returns Promise resolving to success message
   * @throws {AuthError} If request fails
   *
   * @example
   * ```typescript
   * await client.requestOTP('user@example.com');
   * // OTP code sent to email
   * ```
   */
  async requestOTP(email: string): Promise<MessageResponse> {
    try {
      const payload: OTPRequestPayload = { email };
      const response = await this.axios.post<MessageResponse>(
        `${this.config.authPrefix}/request-otp`,
        payload
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Verify an OTP code and receive access token
   * Refresh token is automatically set in HTTP-only cookie
   *
   * @param email - User's email address
   * @param code - OTP code received via email
   * @returns Promise resolving to token response with access token
   * @throws {AuthError} If verification fails
   *
   * @example
   * ```typescript
   * const { access_token } = await client.verifyOTP('user@example.com', '123456');
   * // Now authenticated, access_token stored in memory
   * ```
   */
  async verifyOTP(email: string, code: string): Promise<TokenResponse> {
    try {
      const payload: OTPVerifyPayload = { email, code };
      const response = await this.axios.post<TokenResponse>(
        `${this.config.authPrefix}/verify-otp`,
        payload
      );

      const { access_token } = response.data;

      // Store access token in memory
      this.tokenManager.setAccessToken(access_token);

      // Emit login event
      this.events.emit('login', { email, accessToken: access_token });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Refresh the access token using refresh token from HTTP-only cookie
   * This method is automatically called by interceptors when token expires
   *
   * @returns Promise resolving to new token response
   * @throws {AuthError} If refresh fails (e.g., refresh token expired)
   *
   * @example
   * ```typescript
   * try {
   *   const { access_token } = await client.refresh();
   *   // New access token received
   * } catch (error) {
   *   // Refresh token expired, user needs to login again
   * }
   * ```
   */
  async refresh(): Promise<TokenResponse> {
    // Prevent multiple simultaneous refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await this.axios.post<TokenResponse>(
          `${this.config.authPrefix}/refresh`
        );

        const { access_token } = response.data;

        // Store new access token
        this.tokenManager.setAccessToken(access_token);

        // Emit token refreshed event
        this.events.emit('tokenRefreshed', { accessToken: access_token });

        return response.data;
      } catch (error) {
        // Clear tokens on refresh failure
        this.tokenManager.clearTokens();
        throw this.handleError(error);
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Logout user by blacklisting refresh token and clearing local tokens
   *
   * @returns Promise resolving to success message
   * @throws {AuthError} If logout request fails
   *
   * @example
   * ```typescript
   * await client.logout();
   * // User logged out, tokens cleared
   * ```
   */
  async logout(): Promise<MessageResponse> {
    try {
      const response = await this.axios.post<MessageResponse>(
        `${this.config.authPrefix}/logout`
      );

      // Clear local tokens
      this.tokenManager.clearTokens();

      // Emit logout event
      this.events.emit('logout', {});

      return response.data;
    } catch (error) {
      // Even if request fails, clear local tokens
      this.tokenManager.clearTokens();
      this.events.emit('logout', { reason: 'error' });
      throw this.handleError(error);
    }
  }

  /**
   * Check if user is currently authenticated (has valid access token)
   *
   * @returns true if authenticated with valid token
   *
   * @example
   * ```typescript
   * if (client.isAuthenticated()) {
   *   // User is logged in
   * }
   * ```
   */
  isAuthenticated(): boolean {
    return this.tokenManager.isAccessTokenValid();
  }

  /**
   * Get the current user ID from access token
   *
   * @returns User ID or null if not authenticated
   *
   * @example
   * ```typescript
   * const userId = client.getUserId();
   * console.log('Current user:', userId);
   * ```
   */
  getUserId(): string | null {
    return this.tokenManager.getUserId();
  }

  /**
   * Get custom claims from the current access token
   *
   * @returns JWT claims object or null if not authenticated
   *
   * @example
   * ```typescript
   * const claims = client.getClaims();
   * console.log('User role:', claims?.role);
   * ```
   */
  getClaims(): Record<string, unknown> | null {
    return this.tokenManager.parseTokenClaims();
  }

  /**
   * Initialize the client by attempting to restore session from refresh token cookie
   * Call this on app startup to restore authenticated session
   *
   * @returns Promise resolving to true if session restored, false otherwise
   *
   * @example
   * ```typescript
   * // On app startup
   * const restored = await client.initialize();
   * if (restored) {
   *   console.log('Session restored from cookie');
   * }
   * ```
   */
  async initialize(): Promise<boolean> {
    try {
      // Try to refresh token from cookie
      await this.refresh();
      return true;
    } catch {
      // No valid refresh token in cookie
      return false;
    }
  }

  /**
   * Handle and transform errors into AuthError instances
   */
  private handleError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<AuthErrorResponse>;
      const message = axiosError.response?.data?.detail ?? axiosError.message;
      const status = axiosError.response?.status;

      const authError = new AuthError(message, status);

      // Emit error event
      this.events.emit('authError', { error: authError.toJSON() });

      return authError;
    }

    const authError = new AuthError(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );

    this.events.emit('authError', { error: authError.toJSON() });

    return authError;
  }
}
