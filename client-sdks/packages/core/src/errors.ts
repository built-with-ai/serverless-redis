/**
 * Base error class for all ServerlessRedis errors
 */
export class ServerlessRedisError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(message: string, code: string = 'SERVERLESS_REDIS_ERROR', statusCode?: number) {
    super(message);
    this.name = 'ServerlessRedisError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ServerlessRedisError.prototype);
  }
}

/**
 * Connection error - network or HTTP-level issues
 */
export class ConnectionError extends ServerlessRedisError {
  constructor(message: string, statusCode?: number) {
    super(message, 'CONNECTION_ERROR', statusCode);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Authentication error - invalid token or unauthorized
 */
export class AuthenticationError extends ServerlessRedisError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Redis command error - Redis-level errors
 */
export class RedisError extends ServerlessRedisError {
  public readonly command?: string;

  constructor(message: string, command?: string) {
    super(message, 'REDIS_ERROR');
    this.name = 'RedisError';
    this.command = command;
    Object.setPrototypeOf(this, RedisError.prototype);
  }
}

/**
 * Timeout error - request took too long
 */
export class TimeoutError extends ServerlessRedisError {
  public readonly timeout: number;

  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.timeout = timeout;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Validation error - invalid parameters or configuration
 */
export class ValidationError extends ServerlessRedisError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends ServerlessRedisError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Pipeline error - error during pipeline execution
 */
export class PipelineError extends ServerlessRedisError {
  public readonly results: unknown[];
  public readonly failedIndex: number;

  constructor(message: string, results: unknown[], failedIndex: number) {
    super(message, 'PIPELINE_ERROR');
    this.name = 'PipelineError';
    this.results = results;
    this.failedIndex = failedIndex;
    Object.setPrototypeOf(this, PipelineError.prototype);
  }
}

/**
 * Transaction error - error during transaction execution
 */
export class TransactionError extends ServerlessRedisError {
  constructor(message: string) {
    super(message, 'TRANSACTION_ERROR');
    this.name = 'TransactionError';
    Object.setPrototypeOf(this, TransactionError.prototype);
  }
}

/**
 * Utility function to create appropriate error from HTTP response
 */
export function createErrorFromResponse(
  status: number,
  statusText: string,
  data?: { error?: string; message?: string; code?: string }
): ServerlessRedisError {
  const message = data?.error || data?.message || statusText || 'Unknown error';
  const code = data?.code;

  switch (status) {
    case 401:
      return new AuthenticationError(message);
    case 429:
      return new RateLimitError(message);
    case 408:
      return new TimeoutError(5000); // Default timeout
    case 400:
      return new ValidationError(message);
    default:
      if (status >= 500) {
        return new ConnectionError(message, status);
      }
      return new ServerlessRedisError(message, code, status);
  }
}

/**
 * Utility function to determine if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof ConnectionError) {
    // Retry on 5xx errors and network errors
    return !error.statusCode || error.statusCode >= 500;
  }
  
  if (error instanceof TimeoutError) {
    return true;
  }
  
  if (error instanceof RateLimitError) {
    return true; // Can retry with backoff
  }
  
  // Don't retry auth errors, validation errors, or Redis command errors
  return false;
}