/**
 * TypeScript type definitions for FastAPI OTP Authentication Client
 * Mirrors backend schemas from the FastAPI OTP Authentication library
 */

/**
 * OTP request payload for requesting a new OTP code
 */
export interface OTPRequestPayload {
  email: string;
}

/**
 * OTP verification payload for verifying an OTP code
 */
export interface OTPVerifyPayload {
  email: string;
  code: string;
}

/**
 * Token response from verify-otp and refresh endpoints
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

/**
 * Generic message response
 */
export interface MessageResponse {
  message: string;
}

/**
 * JWT token claims structure
 */
export interface JWTClaims {
  sub: string; // User ID
  type: 'access' | 'refresh';
  jti: string; // Token ID (UUID)
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
  [key: string]: unknown; // Additional custom claims
}

/**
 * Error response from the API
 */
export interface AuthErrorResponse {
  detail: string;
  status?: number;
}

/**
 * Configuration options for the OTP Auth Client
 */
export interface OTPAuthConfig {
  /**
   * Base URL of the FastAPI backend
   * @example "https://api.example.com"
   */
  baseURL: string;

  /**
   * Path prefix for auth endpoints
   * @default "/auth"
   */
  authPrefix?: string;

  /**
   * Enable automatic token refresh
   * @default true
   */
  autoRefresh?: boolean;

  /**
   * Time in seconds before token expiry to trigger refresh
   * @default 300 (5 minutes)
   */
  refreshBuffer?: number;

  /**
   * Axios timeout in milliseconds
   * @default 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * Enable credentials (cookies) in requests
   * @default true
   */
  withCredentials?: boolean;

  /**
   * Custom headers to include in all requests
   */
  headers?: Record<string, string>;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthErrorResponse | null;
  accessToken: string | null;
}

/**
 * Event types emitted by the auth client
 */
export type AuthEventType = 'login' | 'logout' | 'tokenRefreshed' | 'authError';

/**
 * Event payloads for each event type
 */
export interface AuthEventPayloads {
  login: { email: string; accessToken: string };
  logout: { reason?: string };
  tokenRefreshed: { accessToken: string };
  authError: { error: AuthErrorResponse };
}

/**
 * Event listener function type
 */
export type AuthEventListener<T extends AuthEventType> = (
  payload: AuthEventPayloads[T]
) => void;

/**
 * Custom error class for authentication errors
 */
export class AuthError extends Error {
  public readonly status?: number;
  public readonly detail: string;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AuthError';
    this.detail = message;
    this.status = status;
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  toJSON(): AuthErrorResponse {
    return {
      detail: this.detail,
      status: this.status,
    };
  }
}

/**
 * Token storage interface
 */
export interface TokenStorage {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  clearTokens(): void;
  isAccessTokenValid(): boolean;
}

/**
 * Decoded access token with claims
 */
export interface DecodedToken {
  claims: JWTClaims;
  raw: string;
  isExpired: boolean;
  expiresAt: Date;
}
