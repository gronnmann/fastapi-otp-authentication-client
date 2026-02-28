import { beforeAll, afterEach, vi } from 'vitest';

// Mock axios module
vi.mock('axios');

// Setup global test environment
beforeAll(() => {
  // Mock console methods to avoid noise in test output
  global.console = {
    ...console,
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  };
});

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
