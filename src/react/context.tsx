import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { OTPAuthClient } from '../client';
import type { OTPAuthConfig, AuthState, MessageResponse } from '../types';

/**
 * Context value provided by AuthProvider
 */
export interface AuthContextValue {
  client: OTPAuthClient;
  state: AuthState;
  requestOTP: (email: string) => Promise<MessageResponse>;
  verifyOTP: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  initialize: () => Promise<boolean>;
}

/**
 * Auth Context
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Props for AuthProvider component
 */
export interface AuthProviderProps {
  /** Configuration for OTP Auth Client */
  config: OTPAuthConfig;
  /** Child components */
  children: ReactNode;
  /** Automatically initialize client on mount (default: true) */
  autoInitialize?: boolean;
}

/**
 * Auth Provider Component
 *
 * Wraps your application to provide authentication context and state management.
 * Automatically handles token refresh, state updates, and event listening.
 *
 * @example
 * ```tsx
 * import { AuthProvider } from 'fastapi-otp-authentication-client/react';
 *
 * function App() {
 *   return (
 *     <AuthProvider config={{ baseURL: 'https://api.example.com' }}>
 *       <YourApp />
 *     </AuthProvider>
 *   );
 * }
 * ```
 */
export function AuthProvider({ config, children, autoInitialize = true }: AuthProviderProps) {
  // Create client instance (stable reference)
  const client = useMemo(() => new OTPAuthClient(config), [config.baseURL]);

  // Auth state
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: autoInitialize,
    error: null,
    accessToken: null,
  });

  // Initialize client on mount
  useEffect(() => {
    if (autoInitialize) {
      client
        .initialize()
        .then((restored) => {
          setState({
            isAuthenticated: restored,
            isLoading: false,
            error: null,
            accessToken: restored ? client.tokenManager.getAccessToken() : null,
          });
        })
        .catch(() => {
          setState({
            isAuthenticated: false,
            isLoading: false,
            error: null,
            accessToken: null,
          });
        });
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [client, autoInitialize]);

  // Listen to auth events
  useEffect(() => {
    const unsubscribeLogin = client.events.on('login', ({ accessToken }) => {
      setState({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        accessToken,
      });
    });

    const unsubscribeLogout = client.events.on('logout', () => {
      setState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        accessToken: null,
      });
    });

    const unsubscribeTokenRefreshed = client.events.on('tokenRefreshed', ({ accessToken }) => {
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        accessToken,
      }));
    });

    const unsubscribeAuthError = client.events.on('authError', ({ error }) => {
      setState((prev) => ({
        ...prev,
        error,
      }));
    });

    return () => {
      unsubscribeLogin();
      unsubscribeLogout();
      unsubscribeTokenRefreshed();
      unsubscribeAuthError();
    };
  }, [client]);

  // Wrapped methods with loading state
  const requestOTP = useCallback(
    async (email: string): Promise<MessageResponse> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const result = await client.requestOTP(email);
        setState((prev) => ({ ...prev, isLoading: false }));
        return result;
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [client]
  );

  const verifyOTP = useCallback(
    async (email: string, code: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await client.verifyOTP(email, code);
        // State will be updated by event listener
        setState((prev) => ({ ...prev, isLoading: false }));
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [client]
  );

  const logout = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await client.logout();
      // State will be updated by event listener
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [client]);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      await client.refresh();
      // State will be updated by event listener
    } catch (error) {
      throw error;
    }
  }, [client]);

  const initialize = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const restored = await client.initialize();
      setState({
        isAuthenticated: restored,
        isLoading: false,
        error: null,
        accessToken: restored ? client.tokenManager.getAccessToken() : null,
      });
      return restored;
    } catch (error) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        accessToken: null,
      });
      return false;
    }
  }, [client]);

  const value = useMemo(
    () => ({
      client,
      state,
      requestOTP,
      verifyOTP,
      logout,
      refresh,
      initialize,
    }),
    [client, state, requestOTP, verifyOTP, logout, refresh, initialize]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 *
 * @throws Error if used outside AuthProvider
 * @returns Auth context value
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { client, state, logout } = useAuthContext();
 *
 *   return (
 *     <div>
 *       {state.isAuthenticated ? (
 *         <button onClick={logout}>Logout</button>
 *       ) : (
 *         <p>Not authenticated</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
