// Global test setup
require('dotenv').config({ path: '.env.test' });

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Generate random test keys to avoid conflicts
  randomKey: () => `test:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
  
  // Wait utility for async tests
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock HTTP responses
  mockFetchResponse: (data, status = 200) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Map(),
    });
  },
};

// Mock fetch globally for HTTP client tests
global.fetch = jest.fn();

// Mock environment variables
process.env.REDIS_PROXY_URL = 'http://localhost:8080';
process.env.REDIS_TOKEN = 'test-token';
process.env.NODE_ENV = 'test';