/**
 * Vanilla TypeScript/JavaScript Example
 *
 * This example demonstrates how to use the FastAPI OTP Authentication Client
 * without any framework - just plain TypeScript/JavaScript.
 */

import { OTPAuthClient } from 'fastapi-otp-authentication-client';

// Create client instance
const client = new OTPAuthClient({
  baseURL: 'https://api.example.com',
  authPrefix: '/auth',
  autoRefresh: true,
  refreshBuffer: 300, // Refresh token 5 minutes before expiry
});

// Listen to authentication events
client.events.on('login', ({ email, accessToken }) => {
  console.log(`User ${email} logged in`);
  console.log('Access token:', accessToken);
});

client.events.on('logout', ({ reason }) => {
  console.log('User logged out', reason ? `(${reason})` : '');
});

client.events.on('tokenRefreshed', ({ accessToken }) => {
  console.log('Token refreshed:', accessToken);
});

client.events.on('authError', ({ error }) => {
  console.error('Authentication error:', error.detail);
});

// ===== Example 1: Complete OTP Login Flow =====
async function loginWithOTP() {
  try {
    const email = 'user@example.com';

    // Step 1: Request OTP code
    console.log('Requesting OTP code...');
    await client.requestOTP(email);
    console.log('OTP code sent to', email);

    // In a real app, the user would enter the OTP code from their email
    const otpCode = '123456'; // This would come from user input

    // Step 2: Verify OTP code
    console.log('Verifying OTP code...');
    const { access_token } = await client.verifyOTP(email, otpCode);
    console.log('Login successful! Access token:', access_token);

    // Check authentication state
    console.log('Is authenticated:', client.isAuthenticated());
    console.log('User ID:', client.getUserId());
    console.log('Claims:', client.getClaims());
  } catch (error) {
    console.error('Login failed:', error);
  }
}

// ===== Example 2: Making Authenticated API Requests =====
async function fetchProtectedData() {
  try {
    // The axios instance automatically adds Authorization header
    const response = await client.axios.get('/api/protected-endpoint');
    console.log('Protected data:', response.data);
  } catch (error) {
    console.error('Failed to fetch data:', error);
  }
}

// ===== Example 3: Manual Token Refresh =====
async function refreshToken() {
  try {
    const { access_token } = await client.refresh();
    console.log('Token refreshed:', access_token);
  } catch (error) {
    console.error('Token refresh failed:', error);
    // User needs to login again
  }
}

// ===== Example 4: Logout =====
async function logout() {
  try {
    await client.logout();
    console.log('Logged out successfully');
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

// ===== Example 5: Initialize on App Startup (Restore Session) =====
async function initializeApp() {
  try {
    // Try to restore session from refresh token cookie
    const restored = await client.initialize();

    if (restored) {
      console.log('Session restored from cookie');
      console.log('User ID:', client.getUserId());
      // User is authenticated, navigate to dashboard
    } else {
      console.log('No active session, show login page');
      // Show login page
    }
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

// ===== Example 6: Using Custom Headers =====
const clientWithHeaders = new OTPAuthClient({
  baseURL: 'https://api.example.com',
  headers: {
    'X-Custom-Header': 'custom-value',
    'X-Client-Version': '1.0.0',
  },
});

// ===== Example 7: Handling Errors =====
async function loginWithErrorHandling() {
  try {
    await client.requestOTP('user@example.com');
  } catch (error: any) {
    if (error.status === 429) {
      console.error('Too many requests, please wait before trying again');
    } else if (error.status === 404) {
      console.error('User not found');
    } else {
      console.error('An error occurred:', error.detail);
    }
  }
}

// ===== Example Usage in Browser =====
// Typically you would call initializeApp when your app starts:
// document.addEventListener('DOMContentLoaded', () => {
//   initializeApp();
// });

// And bind login form to loginWithOTP:
// document.getElementById('login-form')?.addEventListener('submit', (e) => {
//   e.preventDefault();
//   loginWithOTP();
// });

export {
  client,
  loginWithOTP,
  fetchProtectedData,
  refreshToken,
  logout,
  initializeApp,
};
