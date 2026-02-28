/**
 * FastAPI OTP Authentication Client
 *
 * A type-safe TypeScript client library for FastAPI OTP authentication
 * with automatic token refresh, event emission, and optional React hooks.
 *
 * @packageDocumentation
 */

// Export main client class
export { OTPAuthClient } from './client';

// Export managers
export { TokenManager } from './token-manager';
export { AuthEventEmitter } from './events';

// Export interceptor setup
export { setupInterceptors } from './interceptors';

// Export all types and interfaces
export type {
  OTPAuthConfig,
  OTPRequestPayload,
  OTPVerifyPayload,
  TokenResponse,
  MessageResponse,
  JWTClaims,
  AuthErrorResponse,
  AuthState,
  AuthEventType,
  AuthEventPayloads,
  AuthEventListener,
  TokenStorage,
  DecodedToken,
} from './types';

// Export custom error class
export { AuthError } from './types';
