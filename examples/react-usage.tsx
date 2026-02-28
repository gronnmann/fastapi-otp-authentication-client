/**
 * React Example with Hooks
 *
 * This example demonstrates how to use the FastAPI OTP Authentication Client
 * in a React application using the provided hooks and context.
 */

import React, { useState, useEffect } from 'react';
import {
  AuthProvider,
  useOTPLogin,
  useAuthState,
  useLogout,
  useAuth,
} from 'fastapi-otp-authentication-client/react';

// ===== Example 1: Setup - Wrap your app with AuthProvider =====
function App() {
  return (
    <AuthProvider
      config={{
        baseURL: 'https://api.example.com',
        authPrefix: '/auth',
      }}
      autoInitialize={true} // Automatically restore session on mount
    >
      <AppContent />
    </AuthProvider>
  );
}

// ===== Example 2: Login Form Component =====
function LoginForm() {
  const { requestOTP, verifyOTP, isLoading, error } = useOTPLogin();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestOTP(email);
      setStep('code');
      alert('OTP code sent to your email!');
    } catch (err: any) {
      alert(`Error: ${err.detail}`);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyOTP(email, code);
      alert('Login successful!');
      // User is now logged in, AuthProvider will update state
    } catch (err: any) {
      alert(`Error: ${err.detail}`);
    }
  };

  return (
    <div>
      <h2>Login</h2>

      {step === 'email' ? (
        <form onSubmit={handleRequestOTP}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP}>
          <input
            type="text"
            placeholder="OTP Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={isLoading}
            maxLength={6}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button type="button" onClick={() => setStep('email')} disabled={isLoading}>
            Back
          </button>
        </form>
      )}

      {error && <p style={{ color: 'red' }}>{error.detail}</p>}
    </div>
  );
}

// ===== Example 3: User Profile Component =====
function UserProfile() {
  const { isAuthenticated, isLoading, userId, claims } = useAuthState();
  const { logout, isLoading: logoutLoading } = useLogout();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>Please log in to view your profile</div>;
  }

  const handleLogout = async () => {
    try {
      await logout();
      alert('Logged out successfully');
    } catch (err: any) {
      alert(`Logout error: ${err.detail}`);
    }
  };

  return (
    <div>
      <h2>User Profile</h2>
      <p>User ID: {userId}</p>
      <p>Email: {claims?.email || 'N/A'}</p>
      {claims?.role && <p>Role: {claims.role}</p>}
      {claims?.username && <p>Username: {claims.username}</p>}

      <button onClick={handleLogout} disabled={logoutLoading}>
        {logoutLoading ? 'Logging out...' : 'Logout'}
      </button>
    </div>
  );
}

// ===== Example 4: Protected Route Component =====
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthState();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
}

// ===== Example 5: Making Authenticated API Requests =====
function DataFetcher() {
  const client = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.axios.get('/api/protected-data');
      setData(response.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Fetch Protected Data</h3>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Fetching...' : 'Fetch Data'}
      </button>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

// ===== Example 6: App Content with Conditional Rendering =====
function AppContent() {
  const { isAuthenticated, isLoading } = useAuthState();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Loading...</h2>
        <p>Restoring session...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>FastAPI OTP Authentication Demo</h1>

      {isAuthenticated ? (
        <div>
          <UserProfile />
          <hr />
          <DataFetcher />
        </div>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}

// ===== Example 7: Custom Hook for Protected Data =====
function useProtectedData<T>(url: string) {
  const client = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await client.axios.get<T>(url);
        if (!cancelled) {
          setData(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [client, url]);

  return { data, loading, error };
}

// Usage of custom hook:
function UserDashboard() {
  const { data, loading, error } = useProtectedData<{ name: string; stats: any }>(
    '/api/dashboard'
  );

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h2>Dashboard for {data.name}</h2>
      <pre>{JSON.stringify(data.stats, null, 2)}</pre>
    </div>
  );
}

// ===== Example 8: Listening to Auth Events =====
function AuthEventLogger() {
  const client = useAuth();
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeLogin = client.events.on('login', ({ email }) => {
      setEvents((prev) => [...prev, `User ${email} logged in`]);
    });

    const unsubscribeLogout = client.events.on('logout', ({ reason }) => {
      setEvents((prev) => [...prev, `User logged out ${reason ? `(${reason})` : ''}`]);
    });

    const unsubscribeRefresh = client.events.on('tokenRefreshed', () => {
      setEvents((prev) => [...prev, 'Token refreshed']);
    });

    const unsubscribeError = client.events.on('authError', ({ error }) => {
      setEvents((prev) => [...prev, `Error: ${error.detail}`]);
    });

    return () => {
      unsubscribeLogin();
      unsubscribeLogout();
      unsubscribeRefresh();
      unsubscribeError();
    };
  }, [client]);

  return (
    <div>
      <h3>Auth Events Log</h3>
      <ul>
        {events.map((event, index) => (
          <li key={index}>{event}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
export {
  LoginForm,
  UserProfile,
  ProtectedRoute,
  DataFetcher,
  UserDashboard,
  AuthEventLogger,
};
