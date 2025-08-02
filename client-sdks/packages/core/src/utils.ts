import {
  ServerlessRedisConfig,
  RetryConfig,
  HttpMethod,
  RequestInterceptor,
  ResponseInterceptor,
} from './types';
import {
  ServerlessRedisError,
  ConnectionError,
  TimeoutError,
  createErrorFromResponse,
  isRetryableError,
} from './errors';

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  return Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, 30000);
}

/**
 * Validate Redis key
 */
export function validateKey(key: unknown): string {
  if (typeof key !== 'string' && !Buffer.isBuffer(key)) {
    throw new Error('Redis key must be a string or Buffer');
  }
  return key.toString();
}

/**
 * Serialize Redis value for transmission
 */
export function serializeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Parse Redis response value
 */
export function parseValue(value: unknown, type?: string): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    // Try to parse as JSON if it looks like JSON
    if (type === 'json' || (value.startsWith('{') || value.startsWith('['))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    
    // Try to parse as number if it looks like a number
    if (type === 'number' || /^-?\d+(\.\d+)?$/.test(value)) {
      const num = Number(value);
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  
  return value;
}

/**
 * HTTP client with retry logic and interceptors
 */
export class HttpClient {
  private config: ServerlessRedisConfig;
  private retryConfig: RetryConfig;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(config: ServerlessRedisConfig) {
    this.config = config;
    this.retryConfig = {
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 100,
      retryCondition: isRetryableError,
    };
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Make HTTP request with retry logic
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    data?: unknown
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryConfig.retries; attempt++) {
      try {
        return await this.makeRequest<T>(method, path, data);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on last attempt
        if (attempt === this.retryConfig.retries) {
          break;
        }

        // Check if error is retryable
        if (!this.retryConfig.retryCondition?.(lastError)) {
          break;
        }

        // Calculate delay and wait
        const delay = calculateBackoffDelay(attempt, this.retryConfig.retryDelay);
        await sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Make single HTTP request
   */
  private async makeRequest<T = unknown>(
    method: HttpMethod,
    path: string,
    data?: unknown
  ): Promise<T> {
    const url = `${this.config.url.replace(/\/$/, '')}${path}`;
    const timeout = this.config.timeout ?? 5000;

    // Prepare request config
    let requestConfig = {
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.config.token,
        'User-Agent': 'serverless-redis-client/1.0.0',
        ...this.config.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    };

    // Apply compression header
    if (this.config.compression !== false) {
      requestConfig.headers['Accept-Encoding'] = 'gzip, deflate';
    }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      requestConfig = await interceptor(requestConfig);
    }

    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Make the request
      const response = await fetch(requestConfig.url, {
        method: requestConfig.method,
        headers: requestConfig.headers,
        body: requestConfig.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      let responseData: unknown;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Prepare response object
      let responseObj = {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
      };

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        responseObj = await interceptor(responseObj);
      }

      // Handle HTTP errors
      if (!response.ok) {
        throw createErrorFromResponse(
          responseObj.status,
          response.statusText,
          responseObj.data as { error?: string; message?: string; code?: string }
        );
      }

      return responseObj.data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(timeout);
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ConnectionError(`Network error: ${error.message}`);
      }

      if (error instanceof ServerlessRedisError) {
        throw error;
      }

      throw new ConnectionError(`Request failed: ${error}`);
    }
  }
}

/**
 * Build URL with query parameters
 */
export function buildUrl(base: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) {
    return base;
  }

  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

/**
 * Validate configuration
 */
export function validateConfig(config: ServerlessRedisConfig): void {
  if (!config.url) {
    throw new Error('URL is required');
  }

  if (!config.token) {
    throw new Error('Token is required');
  }

  try {
    new URL(config.url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (config.timeout && (config.timeout < 0 || config.timeout > 300000)) {
    throw new Error('Timeout must be between 0 and 300000ms');
  }

  if (config.retries && (config.retries < 0 || config.retries > 10)) {
    throw new Error('Retries must be between 0 and 10');
  }

  if (config.retryDelay && (config.retryDelay < 0 || config.retryDelay > 10000)) {
    throw new Error('Retry delay must be between 0 and 10000ms');
  }

  if (config.db && (config.db < 0 || config.db > 15)) {
    throw new Error('Database must be between 0 and 15');
  }
}