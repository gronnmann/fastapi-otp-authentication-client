import { useState, useCallback } from 'react';
import { useAuthContext } from './context';
import type { MessageResponse, JWTClaims, AuthError } from '../types';

/**
 * Hook for OTP login flow
 *
 * Provides methods and state for requesting and verifying OTP codes
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { requestOTP, verifyOTP, isLoading, error } = useOTPLogin();
 *   const [email, setEmail] = useState('');
 *   const [code, setCode] = useState('');
 *   const [step, setStep] = useState<'email' | 'code'>('email');
 *
 *   const handleRequestOTP = async () => {
 *     try {
 *       await requestOTP(email);
 *       setStep('code');
 *     } catch (err) {
 *       console.error('Failed to request OTP:', err);
 *     }
 *   };
 *
 *   const handleVerifyOTP = async () => {
 *     try {
 *       await verifyOTP(email, code);
 *       // User is now logged in
 *     } catch (err) {
 *       console.error('Failed to verify OTP:', err);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {step === 'email' ? (
 *         <form onSubmit={(e) => { e.preventDefault(); handleRequestOTP(); }}>
 *           <input value={email} onChange={(e) => setEmail(e.target.value)} />
 *           <button type="submit" disabled={isLoading}>
 *             Request OTP
 *           </button>
 *         </form>
 *       ) : (
 *         <form onSubmit={(e) => { e.preventDefault(); handleVerifyOTP(); }}>
 *           <input value={code} onChange={(e) => setCode(e.target.value)} />
 *           <button type="submit" disabled={isLoading}>
 *             Verify OTP
 *           </button>
 *         </form>
 *       )}
 *       {error && <p>Error: {error.detail}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOTPLogin() {
  const { requestOTP: contextRequestOTP, verifyOTP: contextVerifyOTP, state } = useAuthContext();
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<AuthError | null>(null);

  const requestOTP = useCallback(
    async (email: string): Promise<MessageResponse> => {
      setLocalLoading(true);
      setLocalError(null);
      try {
        const result = await contextRequestOTP(email);
        setLocalLoading(false);
        return result;
      } catch (error) {
        setLocalLoading(false);
        setLocalError(error as AuthError);
        throw error;
      }
    },
    [contextRequestOTP]
  );

  const verifyOTP = useCallback(
    async (email: string, code: string): Promise<void> => {
      setLocalLoading(true);
      setLocalError(null);
      try {
        await contextVerifyOTP(email, code);
        setLocalLoading(false);
      } catch (error) {
        setLocalLoading(false);
        setLocalError(error as AuthError);
        throw error;
      }
    },
    [contextVerifyOTP]
  );

  return {
    requestOTP,
    verifyOTP,
    isLoading: localLoading || state.isLoading,
    error: localError || state.error,
  };
}

/**
 * Hook for authentication state
 *
 * Returns current authentication state and user information
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { isAuthenticated, isLoading, userId, claims } = useAuthState();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!isAuthenticated) return <div>Please log in</div>;
 *
 *   return (
 *     <div>
 *       <h1>User ID: {userId}</h1>
 *       <p>Email: {claims?.email}</p>
 *       <p>Role: {claims?.role}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuthState() {
  const { client, state } = useAuthContext();

  const userId = client.getUserId();
  const claims = client.getClaims();

  return {
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    accessToken: state.accessToken,
    userId,
    claims: claims as JWTClaims | null,
  };
}

/**
 * Hook for logout functionality
 *
 * Provides a logout function with loading state
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const { logout, isLoading } = useLogout();
 *
 *   return (
 *     <button onClick={logout} disabled={isLoading}>
 *       {isLoading ? 'Logging out...' : 'Logout'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useLogout() {
  const { logout: contextLogout, state } = useAuthContext();
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<AuthError | null>(null);

  const logout = useCallback(async (): Promise<void> => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      await contextLogout();
      setLocalLoading(false);
    } catch (error) {
      setLocalLoading(false);
      setLocalError(error as AuthError);
      throw error;
    }
  }, [contextLogout]);

  return {
    logout,
    isLoading: localLoading || state.isLoading,
    error: localError || state.error,
  };
}

/**
 * Hook for accessing the auth client directly
 *
 * Provides direct access to the OTPAuthClient instance for advanced use cases
 *
 * @example
 * ```tsx
 * function AdvancedComponent() {
 *   const client = useAuth();
 *
 *   const makeAuthenticatedRequest = async () => {
 *     const response = await client.axios.get('/protected-endpoint');
 *     console.log(response.data);
 *   };
 *
 *   return <button onClick={makeAuthenticatedRequest}>Fetch Data</button>;
 * }
 * ```
 */
export function useAuth() {
  const { client } = useAuthContext();
  return client;
}

/**
 * Hook for token refresh
 *
 * Provides a manual refresh function with loading state
 *
 * @example
 * ```tsx
 * function RefreshButton() {
 *   const { refresh, isLoading, error } = useRefresh();
 *
 *   return (
 *     <div>
 *       <button onClick={refresh} disabled={isLoading}>
 *         {isLoading ? 'Refreshing...' : 'Refresh Token'}
 *       </button>
 *       {error && <p>Error: {error.detail}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRefresh() {
  const { refresh: contextRefresh } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await contextRefresh();
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setError(err as AuthError);
      throw err;
    }
  }, [contextRefresh]);

  return {
    refresh,
    isLoading,
    error,
  };
}
