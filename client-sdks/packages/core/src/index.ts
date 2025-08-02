/**
 * Serverless Redis Client - Core Package
 * 
 * A TypeScript client library for the Serverless Redis Proxy,
 * providing a Redis-like API optimized for serverless environments.
 */

// Main client class
export { ServerlessRedis, Transaction } from './client';

// Pipeline operations
export { Pipeline } from './pipeline';

// HTTP utilities
export { HttpClient } from './utils';

// Type definitions
export type {
  ServerlessRedisConfig,
  CommandRequest,
  CommandResponse,
  PipelineRequest,
  PipelineResponse,
  TransactionRequest,
  TransactionResponse,
  HealthResponse,
  ErrorResponse,
  RedisValue,
  RedisKey,
  PipelineCommand,
  RequestInterceptor,
  ResponseInterceptor,
  HttpMethod,
  RetryConfig,
} from './types';

// Error classes
export {
  ServerlessRedisError,
  ConnectionError,
  AuthenticationError,
  RedisError,
  TimeoutError,
  ValidationError,
  RateLimitError,
  PipelineError,
  TransactionError,
  createErrorFromResponse,
  isRetryableError,
} from './errors';

// Utility functions
export {
  sleep,
  calculateBackoffDelay,
  validateKey,
  serializeValue,
  parseValue,
  buildUrl,
  validateConfig,
} from './utils';

// Default export for convenience
export default ServerlessRedis;