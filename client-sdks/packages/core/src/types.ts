/**
 * Configuration options for the ServerlessRedis client
 */
export interface ServerlessRedisConfig {
  /** Base URL of the Redis proxy server */
  url: string;
  /** Authentication token (API key or JWT) */
  token: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Number of retry attempts for failed requests (default: 3) */
  retries?: number;
  /** Base delay between retries in milliseconds (default: 100) */
  retryDelay?: number;
  /** Whether to use compression (default: true) */
  compression?: boolean;
  /** Custom headers to include with each request */
  headers?: Record<string, string>;
  /** Database number to use (default: 0) */
  db?: number;
}

/**
 * Redis command request structure
 */
export interface CommandRequest {
  command: string;
  args?: unknown[];
  db?: number;
}

/**
 * Redis command response structure
 */
export interface CommandResponse {
  result?: unknown;
  error?: string;
  type: string;
  time: number;
}

/**
 * Pipeline request structure
 */
export interface PipelineRequest {
  commands: CommandRequest[];
}

/**
 * Pipeline response structure
 */
export interface PipelineResponse {
  results: CommandResponse[];
  count: number;
  time: number;
}

/**
 * Transaction request structure
 */
export interface TransactionRequest {
  commands: CommandRequest[];
}

/**
 * Transaction response structure
 */
export interface TransactionResponse {
  results: CommandResponse[];
  queued: number;
  exec: boolean;
  time: number;
}

/**
 * Health check response structure
 */
export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  connections: Record<string, number>;
  memory: {
    alloc: number;
    totalAlloc: number;
    sys: number;
    numGC: number;
    numGoroutine: number;
  };
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  message?: string;
}

/**
 * Redis data types
 */
export type RedisValue = string | number | Buffer | null;
export type RedisKey = string | Buffer;

/**
 * Pipeline command builder interface
 */
export interface PipelineCommand {
  command: string;
  args: unknown[];
}

/**
 * Request interceptor function type
 */
export type RequestInterceptor = (config: {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body: string | undefined;
}) => Promise<{
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body: string | undefined;
}>;

/**
 * Response interceptor function type
 */
export type ResponseInterceptor = (response: {
  status: number;
  headers: Record<string, string>;
  data: unknown;
}) => {
  status: number;
  headers: Record<string, string>;
  data: unknown;
} | Promise<{
  status: number;
  headers: Record<string, string>;
  data: unknown;
}>;

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Retry configuration
 */
export interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: Error) => boolean;
}