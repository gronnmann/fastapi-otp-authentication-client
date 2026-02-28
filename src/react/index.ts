/**
 * React integration for FastAPI OTP Authentication Client
 *
 * Provides React Context, hooks, and components for easy integration
 * with React applications.
 *
 * @packageDocumentation
 */

// Export context and provider
export { AuthProvider, useAuthContext } from './context';
export type { AuthProviderProps, AuthContextValue } from './context';

// Export hooks
export { useOTPLogin, useAuthState, useLogout, useAuth, useRefresh } from './hooks';
