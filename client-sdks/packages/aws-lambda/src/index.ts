/**
 * AWS Lambda integration for Serverless Redis Client
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { ServerlessRedis, type ServerlessRedisConfig } from '@builtwithai/serverless-redis-client';

/**
 * AWS Lambda specific configuration
 */
export interface LambdaRedisConfig extends Omit<ServerlessRedisConfig, 'url' | 'token'> {
  /** Base URL of the Redis proxy server */
  url?: string;
  /** Authentication token (API key or JWT) */
  token?: string;
}

/**
 * Lambda environment variables
 */
interface LambdaEnvironment {
  REDIS_PROXY_URL?: string;
  REDIS_TOKEN?: string;
  REDIS_API_KEY?: string;
  REDIS_TIMEOUT?: string;
  REDIS_RETRIES?: string;
  REDIS_DB?: string;
  
  // AWS-specific environment variables
  AWS_REGION?: string;
  AWS_LAMBDA_FUNCTION_NAME?: string;
  AWS_LAMBDA_FUNCTION_VERSION?: string;
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE?: string;
  AWS_LAMBDA_RUNTIME_API?: string;
}

/**
 * Create a ServerlessRedis client optimized for AWS Lambda
 */
export function createServerlessRedis(config: LambdaRedisConfig = {}): ServerlessRedis {
  const env = process.env as LambdaEnvironment;
  
  // Detect if running in Lambda environment
  const isLambda = !!env.AWS_LAMBDA_RUNTIME_API;
  
  // Auto-detect configuration from environment variables
  const finalConfig: ServerlessRedisConfig = {
    url: config.url || env.REDIS_PROXY_URL || '',
    token: config.token || env.REDIS_TOKEN || env.REDIS_API_KEY || '',
    timeout: config.timeout || (env.REDIS_TIMEOUT ? parseInt(env.REDIS_TIMEOUT) : 10000), // 10s timeout for Lambda
    retries: config.retries || (env.REDIS_RETRIES ? parseInt(env.REDIS_RETRIES) : 3),
    db: config.db || (env.REDIS_DB ? parseInt(env.REDIS_DB) : 0),
    compression: config.compression !== false, // Enable compression by default
    ...config,
  };

  if (!finalConfig.url) {
    throw new Error(
      'Redis proxy URL is required. Set REDIS_PROXY_URL environment variable or pass url in config.'
    );
  }

  if (!finalConfig.token) {
    throw new Error(
      'Redis token is required. Set REDIS_TOKEN or REDIS_API_KEY environment variable or pass token in config.'
    );
  }

  // Add Lambda-specific headers
  if (!finalConfig.headers) {
    finalConfig.headers = {};
  }
  finalConfig.headers['X-Lambda-Runtime'] = 'aws-lambda';
  
  if (env.AWS_REGION) {
    finalConfig.headers['X-AWS-Region'] = env.AWS_REGION;
  }
  
  if (env.AWS_LAMBDA_FUNCTION_NAME) {
    finalConfig.headers['X-Lambda-Function'] = env.AWS_LAMBDA_FUNCTION_NAME;
  }

  return new ServerlessRedis(finalConfig);
}

/**
 * Global Redis client instance for Lambda functions
 */
let globalRedis: ServerlessRedis | undefined;

/**
 * Get or create a global Redis client instance
 * Optimized for Lambda container reuse
 */
export function getServerlessRedis(config?: LambdaRedisConfig): ServerlessRedis {
  if (!globalRedis) {
    globalRedis = createServerlessRedis(config);
  }
  return globalRedis;
}

/**
 * Reset the global Redis client instance
 * Useful for testing or configuration changes
 */
export function resetServerlessRedis(): void {
  globalRedis = undefined;
}

/**
 * API Gateway Lambda handler wrapper for Redis operations (v1)
 */
export function withRedis<T = any>(
  handler: (redis: ServerlessRedis, event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult | T>
): Handler<APIGatewayProxyEvent, APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
      const redis = getServerlessRedis();
      const result = await handler(redis, event, context);
      
      // If handler returns an APIGatewayProxyResult, return it directly
      if (result && typeof result === 'object' && 'statusCode' in result) {
        return result as APIGatewayProxyResult;
      }
      
      // Otherwise, JSON encode the result
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify(result),
      };
    } catch (error) {
      console.error('Redis operation failed:', error);
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  };
}

/**
 * API Gateway Lambda handler wrapper for Redis operations (v2)
 */
export function withRedisV2<T = any>(
  handler: (redis: ServerlessRedis, event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2 | T>
): Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2> {
  return async (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
    try {
      const redis = getServerlessRedis();
      const result = await handler(redis, event, context);
      
      // If handler returns an APIGatewayProxyResultV2, return it directly
      if (result && typeof result === 'object' && 'statusCode' in result) {
        return result as APIGatewayProxyResultV2;
      }
      
      // Otherwise, JSON encode the result
      return {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify(result),
      };
    } catch (error) {
      console.error('Redis operation failed:', error);
      
      return {
        statusCode: 500,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  };
}

/**
 * Generic Lambda handler wrapper for any event type
 */
export function withRedisGeneric<TEvent = any, TResult = any>(
  handler: (redis: ServerlessRedis, event: TEvent, context: Context) => Promise<TResult>
): Handler<TEvent, TResult> {
  return async (event: TEvent, context: Context): Promise<TResult> => {
    const redis = getServerlessRedis();
    return await handler(redis, event, context);
  };
}

/**
 * Middleware for Lambda functions
 */
export function createRedisMiddleware(config?: LambdaRedisConfig) {
  const redis = createServerlessRedis(config);
  
  return {
    redis,
    // Middy.js compatible middleware
    before: async (request: any) => {
      request.redis = redis;
    },
  };
}

/**
 * AWS Lambda utilities
 */
export const LambdaRedisUtils = {
  /**
   * Check if running in AWS Lambda environment
   */
  isLambda(): boolean {
    return !!process.env.AWS_LAMBDA_RUNTIME_API;
  },

  /**
   * Get Lambda function information
   */
  getFunctionInfo(): {
    name?: string;
    version?: string;
    memorySize?: number;
    region?: string;
  } {
    return {
      name: process.env.AWS_LAMBDA_FUNCTION_NAME,
      version: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE 
        ? parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE)
        : undefined,
      region: process.env.AWS_REGION,
    };
  },

  /**
   * Get client IP from API Gateway event
   */
  getClientIP(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string {
    // Try v2 format first
    if ('requestContext' in event && 'http' in event.requestContext) {
      return event.requestContext.http.sourceIp || 'unknown';
    }
    
    // Fallback to v1 format
    if ('requestContext' in event && 'identity' in event.requestContext) {
      return event.requestContext.identity.sourceIp || 'unknown';
    }
    
    return 'unknown';
  },

  /**
   * Get user agent from API Gateway event
   */
  getUserAgent(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string {
    const headers = event.headers || {};
    return headers['User-Agent'] || headers['user-agent'] || 'unknown';
  },

  /**
   * Create rate limiting key from Lambda event
   */
  createRateLimitKey(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, identifier?: string): string {
    const ip = this.getClientIP(event);
    return identifier ? `rate:${identifier}:${ip}` : `rate:${ip}`;
  },

  /**
   * Get optimized configuration for Lambda environment
   */
  getOptimizedConfig(baseConfig: LambdaRedisConfig = {}): LambdaRedisConfig {
    const memorySize = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE 
      ? parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE)
      : 128;
    
    // Adjust timeouts based on Lambda memory allocation
    let timeout = 10000; // Default 10s
    if (memorySize <= 512) {
      timeout = 8000; // 8s for smaller functions
    } else if (memorySize >= 1024) {
      timeout = 15000; // 15s for larger functions
    }
    
    return {
      timeout,
      retries: 3,
      compression: true,
      ...baseConfig,
      headers: {
        'X-Lambda-Runtime': 'aws-lambda',
        'X-AWS-Region': process.env.AWS_REGION || 'unknown',
        'X-Lambda-Function': process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
        ...baseConfig.headers,
      },
    };
  },

  /**
   * Create CORS response for API Gateway
   */
  corsResponse(data: any, statusCode = 200, additionalHeaders: Record<string, string> = {}): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        ...additionalHeaders,
      },
      body: JSON.stringify(data),
    };
  },

  /**
   * Create CORS response for API Gateway v2
   */
  corsResponseV2(data: any, statusCode = 200, additionalHeaders: Record<string, string> = {}): APIGatewayProxyResultV2 {
    return {
      statusCode,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization',
        ...additionalHeaders,
      },
      body: JSON.stringify(data),
    };
  },

  /**
   * Handle CORS preflight for API Gateway v1
   */
  handleCors(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
        body: '',
      };
    }
    return null;
  },

  /**
   * Handle CORS preflight for API Gateway v2
   */
  handleCorsV2(event: APIGatewayProxyEventV2): APIGatewayProxyResultV2 | null {
    if (event.requestContext.http.method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Authorization',
          'access-control-max-age': '86400',
        },
        body: '',
      };
    }
    return null;
  },

  /**
   * Parse JSON body from API Gateway event
   */
  parseBody<T = any>(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): T | null {
    if (!event.body) return null;
    
    try {
      return event.isBase64Encoded
        ? JSON.parse(Buffer.from(event.body, 'base64').toString())
        : JSON.parse(event.body);
    } catch {
      return null;
    }
  },

  /**
   * Get query parameters from API Gateway event
   */
  getQueryParams(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string> {
    // API Gateway v2 format
    if ('queryStringParameters' in event && event.queryStringParameters) {
      return event.queryStringParameters;
    }
    
    // API Gateway v1 format
    return (event as APIGatewayProxyEvent).queryStringParameters || {};
  },

  /**
   * Get path parameters from API Gateway event
   */
  getPathParams(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string> {
    return event.pathParameters || {};
  },
};

/**
 * Rate limiting helper for Lambda functions
 */
export class LambdaRateLimit {
  private redis: ServerlessRedis;
  private window: number;
  private limit: number;

  constructor(redis: ServerlessRedis, limit: number, windowSeconds: number) {
    this.redis = redis;
    this.limit = limit;
    this.window = windowSeconds;
  }

  async check(key: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, this.window);
    }

    const remaining = Math.max(0, this.limit - current);
    const resetIn = await this.redis.ttl(key);

    return {
      allowed: current <= this.limit,
      remaining,
      resetIn: resetIn > 0 ? resetIn : this.window,
    };
  }
}

// Re-export core types and classes for convenience
export {
  ServerlessRedis,
  Pipeline,
  Transaction,
  type ServerlessRedisConfig,
  type RedisValue,
  type RedisKey,
  type HealthResponse,
  ServerlessRedisError,
  ConnectionError,
  AuthenticationError,
  RedisError,
  TimeoutError,
  ValidationError,
} from '@builtwithai/serverless-redis-client';

// Re-export AWS Lambda types for convenience
export type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
  Handler,
} from 'aws-lambda';

// Default export
export default createServerlessRedis;