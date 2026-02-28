import { jwtDecode } from 'jwt-decode';
import type { JWTClaims, TokenStorage, DecodedToken } from './types';

/**
 * TokenManager handles in-memory storage and validation of access tokens.
 * Refresh tokens are stored in HTTP-only cookies by the backend.
 *
 * Security:
 * - Access tokens are stored only in memory (no localStorage/sessionStorage)
 * - On page reload, call refresh endpoint to restore session from cookie
 */
export class TokenManager implements TokenStorage {
  private accessToken: string | null = null;
  private readonly refreshBuffer: number;

  /**
   * @param refreshBuffer - Time in seconds before token expiry to consider it expired (default: 300 = 5 minutes)
   */
  constructor(refreshBuffer: number = 300) {
    this.refreshBuffer = refreshBuffer;
  }

  /**
   * Get the current access token
   * @returns Access token or null if not set
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Set the access token
   * @param token - JWT access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Clear all tokens from memory
   */
  clearTokens(): void {
    this.accessToken = null;
  }

  /**
   * Check if the current access token is valid (not expired)
   * Takes into account the refresh buffer for proactive token refresh
   * @returns true if token exists and is not expired (considering buffer)
   */
  isAccessTokenValid(): boolean {
    if (!this.accessToken) {
      return false;
    }

    try {
      const decoded = this.decodeToken(this.accessToken);
      return !decoded.isExpired;
    } catch {
      return false;
    }
  }

  /**
   * Decode and validate a JWT token
   * @param token - JWT token string
   * @returns Decoded token with claims and expiration info
   * @throws Error if token is invalid or cannot be decoded
   */
  decodeToken(token: string): DecodedToken {
    try {
      const claims = jwtDecode<JWTClaims>(token);

      if (!claims.exp) {
        throw new Error('Token does not contain expiration claim');
      }

      // Calculate expiration considering the refresh buffer
      const expiresAt = new Date(claims.exp * 1000);
      const bufferTime = this.refreshBuffer * 1000;
      const effectiveExpiry = new Date(expiresAt.getTime() - bufferTime);
      const isExpired = Date.now() >= effectiveExpiry.getTime();

      return {
        claims,
        raw: token,
        isExpired,
        expiresAt,
      };
    } catch (error) {
      throw new Error(
        `Failed to decode token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse JWT claims without verifying signature
   * Useful for extracting user info from token
   * @param token - JWT token string (optional, uses current token if not provided)
   * @returns JWT claims or null if token is invalid
   */
  parseTokenClaims(token?: string): JWTClaims | null {
    const targetToken = token ?? this.accessToken;
    if (!targetToken) {
      return null;
    }

    try {
      return jwtDecode<JWTClaims>(targetToken);
    } catch {
      return null;
    }
  }

  /**
   * Get the user ID from the current access token
   * @returns User ID (subject) or null if no valid token
   */
  getUserId(): string | null {
    const claims = this.parseTokenClaims();
    return claims?.sub ?? null;
  }

  /**
   * Get time remaining until token expiry (in seconds)
   * @returns Seconds until expiry, or 0 if expired/invalid, or null if no token
   */
  getTimeUntilExpiry(): number | null {
    if (!this.accessToken) {
      return null;
    }

    try {
      const decoded = this.decodeToken(this.accessToken);
      const timeRemaining = Math.floor(
        (decoded.expiresAt.getTime() - Date.now() - this.refreshBuffer * 1000) / 1000
      );
      return Math.max(0, timeRemaining);
    } catch {
      return 0;
    }
  }

  /**
   * Check if token needs refresh (expired or about to expire within buffer)
   * @returns true if token should be refreshed
   */
  shouldRefresh(): boolean {
    return !this.isAccessTokenValid();
  }
}
