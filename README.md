# FastAPI OTP Authentication Client

A type-safe TypeScript client library for [FastAPI OTP Authentication](https://github.com/gronnmann/fastapi-otp-authentication) with automatic token refresh, event emission, and optional React hooks support.

[![npm version](https://img.shields.io/npm/v/fastapi-otp-authentication-client.svg)](https://www.npmjs.com/package/fastapi-otp-authentication-client)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

✨ **Type-Safe**: Full TypeScript support with comprehensive type definitions  
🔄 **Auto-Refresh**: Automatic access token refresh with configurable buffer  
🍪 **Secure**: Access tokens stored in memory only, refresh tokens in HTTP-only cookies  
⚡ **Interceptors**: Axios interceptors for automatic Authorization header injection  
📡 **Events**: Event emitter for auth state changes (login, logout, token refresh, errors)  
⚛️ **React Hooks**: Optional React Context and hooks for seamless integration  
🎯 **Framework Agnostic**: Core client works with any JavaScript framework  
📦 **Dual Builds**: Both ESM and CommonJS builds included  
🧪 **Well Tested**: Comprehensive unit and integration tests

## Installation

```bash
# pnpm (recommended)
pnpm add fastapi-otp-authentication-client axios

# npm
npm install fastapi-otp-authentication-client axios

# yarn
yarn add fastapi-otp-authentication-client axios
```

**Note**: `axios` is a peer dependency. For React hooks, you also need React 16.8+.

## Quick Start

### Vanilla TypeScript/JavaScript

```typescript
import { OTPAuthClient } from 'fastapi-otp-authentication-client';

// Create client
const client = new OTPAuthClient({
  baseURL: 'https://api.example.com',
  authPrefix: '/auth',
});

// Request OTP
await client.requestOTP('user@example.com');

// Verify OTP
const { access_token } = await client.verifyOTP('user@example.com', '123456');

// Make authenticated requests
const response = await client.axios.get('/api/protected-endpoint');

// Logout
await client.logout();
```

### React with Hooks

```tsx
import React from 'react';
import { AuthProvider, useOTPLogin, useAuthState } from 'fastapi-otp-authentication-client/react';

function App() {
  return (
    <AuthProvider config={{ baseURL: 'https://api.example.com' }}>
      <YourApp />
    </AuthProvider>
  );
}

function LoginForm() {
  const { requestOTP, verifyOTP, isLoading, error } = useOTPLogin();
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await verifyOTP(email, code);
    }}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input value={code} onChange={(e) => setCode(e.target.value)} />
      <button type="submit" disabled={isLoading}>Login</button>
      {error && <p>{error.detail}</p>}
    </form>
  );
}

function UserProfile() {
  const { isAuthenticated, userId, claims } = useAuthState();
  
  if (!isAuthenticated) return <LoginForm />;
  
  return <div>Welcome, User {userId}!</div>;
}
```

## Core Concepts

### Token Management

The library implements a secure token management strategy:

- **Access Tokens**: Stored in memory only (cleared on page reload)
- **Refresh Tokens**: Stored in HTTP-only cookies by the backend
- **Session Restoration**: On page reload, call `client.initialize()` to restore session from refresh token cookie
- **Automatic Refresh**: Access tokens are refreshed automatically when they expire or approach expiration

### Security

- ✅ No localStorage/sessionStorage usage (prevents XSS attacks)
- ✅ Refresh tokens in HTTP-only cookies (prevents JavaScript access)
- ✅ Automatic token refresh with configurable buffer
- ✅ Token validation with expiration checking
- ✅ Secure by default with `withCredentials: true`

## API Reference

### OTPAuthClient

Main client class for authentication operations.

#### Constructor

```typescript
new OTPAuthClient(config: OTPAuthConfig)
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | `string` | Required | Base URL of your FastAPI backend |
| `authPrefix` | `string` | `"/auth"` | Path prefix for auth endpoints |
| `autoRefresh` | `boolean` | `true` | Enable automatic token refresh |
| `refreshBuffer` | `number` | `300` | Seconds before expiry to trigger refresh |
| `timeout` | `number` | `10000` | Request timeout in milliseconds |
| `withCredentials` | `boolean` | `true` | Include cookies in requests |
| `headers` | `Record<string, string>` | `{}` | Custom headers for all requests |

#### Methods

##### `requestOTP(email: string): Promise<MessageResponse>`

Request an OTP code to be sent to the user's email.

```typescript
await client.requestOTP('user@example.com');
// OTP code sent via email
```

**Throws**: `AuthError` on failure (e.g., user not found, rate limited)

##### `verifyOTP(email: string, code: string): Promise<TokenResponse>`

Verify OTP code and receive access token.

```typescript
const { access_token, token_type } = await client.verifyOTP('user@example.com', '123456');
// User is now authenticated
```

**Throws**: `AuthError` on invalid code, expired code, or max attempts exceeded

##### `refresh(): Promise<TokenResponse>`

Refresh access token using refresh token from cookie.

```typescript
const { access_token } = await client.refresh();
// New access token received
```

**Note**: Automatically called by interceptors when token expires.

**Throws**: `AuthError` if refresh token is expired or invalid

##### `logout(): Promise<MessageResponse>`

Logout user by blacklisting refresh token and clearing local tokens.

```typescript
await client.logout();
// User logged out, tokens cleared
```

##### `isAuthenticated(): boolean`

Check if user has a valid access token.

```typescript
if (client.isAuthenticated()) {
  // User is logged in
}
```

##### `getUserId(): string | null`

Get user ID from access token.

```typescript
const userId = client.getUserId();
```

##### `getClaims(): Record<string, unknown> | null`

Get all JWT claims from access token.

```typescript
const claims = client.getClaims();
console.log('User role:', claims?.role);
```

##### `initialize(): Promise<boolean>`

Restore session from refresh token cookie. Call on app startup.

```typescript
const restored = await client.initialize();
if (restored) {
  // Session restored successfully
} else {
  // No active session, show login
}
```

#### Properties

##### `client.axios: AxiosInstance`

Pre-configured axios instance with automatic token injection.

```typescript
// Make authenticated requests
const response = await client.axios.get('/api/users');
const data = await client.axios.post('/api/items', { name: 'Item' });
```

##### `client.tokenManager: TokenManager`

Direct access to token manager for advanced use cases.

##### `client.events: AuthEventEmitter`

Event emitter for auth state changes.

### Events

Listen to authentication events:

```typescript
client.events.on('login', ({ email, accessToken }) => {
  console.log(`User ${email} logged in`);
});

client.events.on('logout', ({ reason }) => {
  console.log('User logged out', reason);
});

client.events.on('tokenRefreshed', ({ accessToken }) => {
  console.log('Token refreshed');
});

client.events.on('authError', ({ error }) => {
  console.error('Auth error:', error.detail);
});
```

**Event Types:**
- `login`: Emitted after successful OTP verification
- `logout`: Emitted after logout or when refresh fails
- `tokenRefreshed`: Emitted after successful token refresh
- `authError`: Emitted on any authentication error

## React Hooks

### AuthProvider

Wrap your app with `AuthProvider` to enable hooks.

```tsx
import { AuthProvider } from 'fastapi-otp-authentication-client/react';

<AuthProvider 
  config={{ baseURL: 'https://api.example.com' }}
  autoInitialize={true}
>
  <App />
</AuthProvider>
```

**Props:**
- `config`: `OTPAuthConfig` - Client configuration
- `autoInitialize`: `boolean` - Automatically restore session on mount (default: `true`)

### useOTPLogin

Hook for OTP login flow.

```tsx
import { useOTPLogin } from 'fastapi-otp-authentication-client/react';

function LoginForm() {
  const { requestOTP, verifyOTP, isLoading, error } = useOTPLogin();
  
  // Use requestOTP and verifyOTP functions
}
```

**Returns:**
- `requestOTP: (email: string) => Promise<MessageResponse>`
- `verifyOTP: (email: string, code: string) => Promise<void>`
- `isLoading: boolean`
- `error: AuthError | null`

### useAuthState

Hook for authentication state.

```tsx
import { useAuthState } from 'fastapi-otp-authentication-client/react';

function Profile() {
  const { isAuthenticated, isLoading, userId, claims } = useAuthState();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please login</div>;
  
  return <div>User ID: {userId}</div>;
}
```

**Returns:**
- `isAuthenticated: boolean`
- `isLoading: boolean`
- `error: AuthError | null`
- `accessToken: string | null`
- `userId: string | null`
- `claims: JWTClaims | null`

### useLogout

Hook for logout functionality.

```tsx
import { useLogout } from 'fastapi-otp-authentication-client/react';

function LogoutButton() {
  const { logout, isLoading } = useLogout();
  
  return (
    <button onClick={logout} disabled={isLoading}>
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
```

**Returns:**
- `logout: () => Promise<void>`
- `isLoading: boolean`
- `error: AuthError | null`

### useAuth

Hook to access the client instance directly.

```tsx
import { useAuth } from 'fastapi-otp-authentication-client/react';

function DataFetcher() {
  const client = useAuth();
  
  const fetchData = async () => {
    const response = await client.axios.get('/api/data');
    return response.data;
  };
}
```

### useRefresh

Hook for manual token refresh.

```tsx
import { useRefresh } from 'fastapi-otp-authentication-client/react';

function RefreshButton() {
  const { refresh, isLoading, error } = useRefresh();
  
  return <button onClick={refresh}>Refresh Token</button>;
}
```

## Error Handling

All errors are thrown as `AuthError` instances with `detail` and optional `status` properties.

```typescript
try {
  await client.verifyOTP(email, code);
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Status:', error.status);
    console.error('Message:', error.detail);
    
    if (error.status === 401) {
      // Invalid OTP
    } else if (error.status === 429) {
      // Rate limited
    }
  }
}
```

**Common Status Codes:**
- `401`: Invalid OTP, expired token, or authentication failed
- `404`: User not found
- `429`: Too many OTP requests (rate limited)

## Advanced Usage

### Session Restoration on Page Load

```typescript
// In your app initialization
async function initApp() {
  const restored = await client.initialize();
  
  if (restored) {
    // Navigate to dashboard
    console.log('Welcome back!', client.getUserId());
  } else {
    // Show login page
    console.log('Please log in');
  }
}

// React
function App() {
  return (
    <AuthProvider config={config} autoInitialize={true}>
      {/* autoInitialize handles session restoration */}
    </AuthProvider>
  );
}
```

### Custom Headers

```typescript
const client = new OTPAuthClient({
  baseURL: 'https://api.example.com',
  headers: {
    'X-Client-Version': '1.0.0',
    'X-Custom-Header': 'value',
  },
});
```

### Disable Auto-Refresh

```typescript
const client = new OTPAuthClient({
  baseURL: 'https://api.example.com',
  autoRefresh: false, // Manual token management
});

// Manually refresh when needed
if (client.tokenManager.shouldRefresh()) {
  await client.refresh();
}
```

### Event Listeners with Cleanup

```typescript
useEffect(() => {
  const unsubscribe = client.events.on('login', ({ email }) => {
    console.log('Logged in:', email);
  });
  
  return () => unsubscribe(); // Cleanup
}, [client]);
```

## Backend Integration

This library is designed to work with the [FastAPI OTP Authentication](https://github.com/gronnmann/fastapi-otp-authentication) backend library.

**Backend Setup:**

```python
from fastapi import FastAPI
from fastapi_otp_authentication import get_auth_router, OTPAuthConfig

app = FastAPI()

class MyOTPConfig(OTPAuthConfig):
    secret_key = "your-secret-key"
    cookie_secure = True  # Required for production
    
    async def send_otp(self, email: str, code: str) -> None:
        # Send OTP via email
        pass

auth_router = get_auth_router(get_otp_db, MyOTPConfig())
app.include_router(auth_router, prefix="/auth", tags=["auth"])
```

**CORS Configuration:**

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.com"],
    allow_credentials=True,  # Required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## TypeScript Types

All types are exported for use in your application:

```typescript
import type {
  OTPAuthConfig,
  TokenResponse,
  MessageResponse,
  AuthError,
  JWTClaims,
  AuthState,
  AuthEventType,
} from 'fastapi-otp-authentication-client';
```

## Examples

See the [examples/](examples/) directory for complete examples:

- [examples/vanilla-usage.ts](examples/vanilla-usage.ts) - Vanilla TypeScript usage
- [examples/react-usage.tsx](examples/react-usage.tsx) - React hooks usage

## Testing

Run the test suite:

```bash
pnpm test           # Run tests
pnpm test:ui        # Interactive test UI
pnpm test:coverage  # Coverage report
```

## Building

```bash
pnpm build      # Build library
pnpm type-check # Type check only
pnpm lint       # Lint code
```

## Browser Compatibility

- Modern browsers with ES2020 support
- Requires `fetch` API and `Promise` support
- Works with bundlers (webpack, vite, rollup)

## License

MIT

## Contributing

Contributions are welcome! Please ensure:

1. Tests pass: `pnpm test`
2. Types are correct: `pnpm type-check`
3. Code is formatted: `pnpm format`

## Changelog

### 1.0.0

- Initial release
- Full TypeScript support
- Automatic token refresh
- React hooks integration
- Comprehensive test coverage

## Support

For issues and questions, please use the [GitHub issue tracker](https://github.com/your-repo/fastapi-otp-authentication-client/issues).
