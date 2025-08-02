/**
 * Vercel Edge Functions integration for Serverless Redis Client
 */

import { ServerlessRedis, type ServerlessRedisConfig } from '@builtwithai/serverless-redis-client';

/**
 * Vercel Edge Runtime types (declare globally if not available)
 */
declare global {
  const EdgeRuntime: string | undefined;
}

/**
 * Vercel Edge Functions specific configuration
 */
export interface VercelRedisConfig extends Omit<ServerlessRedisConfig, 'url' | 'token'> {
  /** Base URL of the Redis proxy server */
  url?: string;
  /** Authentication token (API key or JWT) */
  token?: string;
}

/**
 * Environment variable configuration for Vercel
 */
interface VercelEnvironmentConfig {
  REDIS_PROXY_URL?: string;
  REDIS_TOKEN?: string;
  REDIS_API_KEY?: string;
  REDIS_TIMEOUT?: string;
  REDIS_RETRIES?: string;
  REDIS_DB?: string;
  // Vercel specific environment variables
  VERCEL_URL?: string;
  VERCEL_ENV?: string;
}

/**
 * Create a ServerlessRedis client optimized for Vercel Edge Functions
 */
export function createServerlessRedis(config: VercelRedisConfig = {}): ServerlessRedis {
  const env = process.env as VercelEnvironmentConfig;
  
  // Edge Functions have stricter timeout limits
  const isEdgeFunction = typeof EdgeRuntime !== 'undefined';
  
  // Auto-detect configuration from environment variables
  const finalConfig: ServerlessRedisConfig = {
    url: config.url || env.REDIS_PROXY_URL || '',
    token: config.token || env.REDIS_TOKEN || env.REDIS_API_KEY || '',
    timeout: config.timeout || (env.REDIS_TIMEOUT ? parseInt(env.REDIS_TIMEOUT) : (isEdgeFunction ? 3000 : 5000)),
    retries: config.retries || (env.REDIS_RETRIES ? parseInt(env.REDIS_RETRIES) : (isEdgeFunction ? 1 : 3)),
    db: config.db || (env.REDIS_DB ? parseInt(env.REDIS_DB) : 0),
    compression: config.compression !== false, // Enable compression by default for edge
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

  return new ServerlessRedis(finalConfig);
}

/**
 * Global Redis client instance for Vercel applications
 */
let globalRedis: ServerlessRedis | undefined;

/**
 * Get or create a global Redis client instance
 * Optimized for Vercel's execution model
 */
export function getServerlessRedis(config?: VercelRedisConfig): ServerlessRedis {
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
 * Vercel Edge Function handler wrapper for Redis operations
 */
export function withRedis<T = any>(
  handler: (redis: ServerlessRedis, request: Request) => Promise<Response | T>
) {
  return async (request: Request): Promise<Response> => {
    try {
      const redis = getServerlessRedis();
      const result = await handler(redis, request);
      
      // If handler returns a Response, return it directly
      if (result instanceof Response) {
        return result;
      }
      
      // Otherwise, JSON encode the result
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Redis operation failed:', error);
      
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  };
}

/**
 * Middleware for Vercel Edge Functions
 */
export function createRedisMiddleware(config?: VercelRedisConfig) {
  const redis = createServerlessRedis(config);
  
  return {
    redis,
    middleware: (request: Request & { redis?: ServerlessRedis }) => {
      // Add redis instance to request object
      request.redis = redis;
      return request;
    },
  };
}

/**
 * Vercel-specific utilities
 */
export const VercelRedisUtils = {
  /**
   * Check if running in Vercel Edge Runtime
   */
  isEdgeRuntime(): boolean {
    return typeof EdgeRuntime !== 'undefined';
  },

  /**
   * Check if running in Vercel Node.js runtime
   */
  isNodeRuntime(): boolean {
    return typeof process !== 'undefined' && 
           typeof EdgeRuntime === 'undefined';
  },

  /**
   * Check if running in production environment
   */
  isProduction(): boolean {
    return process.env.VERCEL_ENV === 'production';
  },

  /**
   * Check if running in preview environment
   */
  isPreview(): boolean {
    return process.env.VERCEL_ENV === 'preview';
  },

  /**
   * Check if running in development environment
   */
  isDevelopment(): boolean {
    return process.env.VERCEL_ENV === 'development' || 
           process.env.NODE_ENV === 'development';
  },

  /**
   * Get the current Vercel URL
   */
  getVercelUrl(): string | undefined {
    return process.env.VERCEL_URL;
  },

  /**
   * Get optimized configuration for current Vercel environment
   */
  getOptimizedConfig(baseConfig: VercelRedisConfig = {}): VercelRedisConfig {
    const config = { ...baseConfig };

    if (this.isEdgeRuntime()) {
      // Edge Runtime optimizations
      config.timeout = config.timeout || 3000; // Shorter timeout for edge
      config.retries = config.retries || 1;    // Fewer retries for edge
      config.compression = config.compression !== false; // Enable compression
    } else {
      // Node.js Runtime optimizations
      config.timeout = config.timeout || 5000;
      config.retries = config.retries || 3;
      config.compression = config.compression !== false;
    }

    // Add environment-specific headers
    if (!config.headers) {
      config.headers = {};
    }
    
    config.headers['X-Vercel-Runtime'] = this.isEdgeRuntime() ? 'edge' : 'nodejs';
    
    if (process.env.VERCEL_ENV) {
      config.headers['X-Vercel-Env'] = process.env.VERCEL_ENV;
    }

    return config;
  },

  /**
   * Create a Redis configuration from Vercel environment
   */
  createConfigFromEnvironment(): VercelRedisConfig {
    return this.getOptimizedConfig({
      url: process.env.REDIS_PROXY_URL,
      token: process.env.REDIS_TOKEN || process.env.REDIS_API_KEY,
      timeout: process.env.REDIS_TIMEOUT ? parseInt(process.env.REDIS_TIMEOUT) : undefined,
      retries: process.env.REDIS_RETRIES ? parseInt(process.env.REDIS_RETRIES) : undefined,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : undefined,
    });
  },
};

/**
 * Helper for creating CORS-enabled responses
 */
export function corsResponse(data: any, status = 200, additionalHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...additionalHeaders,
    },
  });
}

/**
 * Helper for handling CORS preflight requests
 */
export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
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

// Default export
export default createServerlessRedis;