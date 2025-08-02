/**
 * Cloudflare Workers integration for Serverless Redis Client
 */

import { ServerlessRedis, type ServerlessRedisConfig } from '@builtwithai/serverless-redis-client';

/**
 * Cloudflare Workers types (declare globally if not available)
 */
declare global {
  interface KVNamespace {
    get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>;
    put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: any): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: any): Promise<any>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec<T = unknown>(query: string): Promise<D1Result<T>>;
  }

  interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T>;
    run<T = unknown>(): Promise<D1Result<T>>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }

  interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta: any;
  }

  interface R2Bucket {
    get(key: string, options?: any): Promise<R2Object | null>;
    put(key: string, value: any, options?: any): Promise<R2Object>;
    delete(key: string | string[]): Promise<void>;
    list(options?: any): Promise<R2Objects>;
  }

  interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    httpEtag: string;
    uploaded: Date;
    httpMetadata?: any;
    customMetadata?: Record<string, string>;
    range?: any;
    body: R2ObjectBody;
  }

  interface R2ObjectBody extends ReadableStream {
    readonly body: ReadableStream;
    readonly bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json<T>(): Promise<T>;
    blob(): Promise<Blob>;
  }

  interface R2Objects {
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
  }

  interface DurableObjectNamespace {
    get(id: any): DurableObject;
    idFromName(name: string): any;
    idFromString(id: string): any;
    newUniqueId(): any;
  }

  interface DurableObject {
    fetch(request: Request): Promise<Response>;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  }
}

/**
 * Cloudflare Workers specific configuration
 */
export interface CloudflareRedisConfig extends Omit<ServerlessRedisConfig, 'url' | 'token'> {
  /** Base URL of the Redis proxy server */
  url?: string;
  /** Authentication token (API key or JWT) */
  token?: string;
}

/**
 * Cloudflare Workers environment bindings
 */
export interface CloudflareEnvironment {
  // Environment variables
  REDIS_PROXY_URL?: string;
  REDIS_TOKEN?: string;
  REDIS_API_KEY?: string;
  REDIS_TIMEOUT?: string;
  REDIS_RETRIES?: string;
  REDIS_DB?: string;
  
  // KV namespaces (optional for caching)
  REDIS_CACHE?: KVNamespace;
  
  // D1 database (optional for persistent storage)
  DB?: D1Database;
  
  // R2 bucket (optional for large object storage)
  R2?: R2Bucket;
  
  // Durable Objects (optional for stateful operations)
  REDIS_DO?: DurableObjectNamespace;
}

/**
 * Create a ServerlessRedis client optimized for Cloudflare Workers
 */
export function createServerlessRedis(
  config: CloudflareRedisConfig = {},
  env?: CloudflareEnvironment
): ServerlessRedis {
  // Cloudflare Workers have very strict timeout limits
  const isWorker = typeof caches !== 'undefined' && typeof Request !== 'undefined';
  
  // Auto-detect configuration from environment
  const finalConfig: ServerlessRedisConfig = {
    url: config.url || env?.REDIS_PROXY_URL || '',
    token: config.token || env?.REDIS_TOKEN || env?.REDIS_API_KEY || '',
    timeout: config.timeout || (env?.REDIS_TIMEOUT ? parseInt(env.REDIS_TIMEOUT) : 2000), // Very short timeout for Workers
    retries: config.retries || (env?.REDIS_RETRIES ? parseInt(env.REDIS_RETRIES) : 1), // Single retry for Workers
    db: config.db || (env?.REDIS_DB ? parseInt(env.REDIS_DB) : 0),
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

  // Add Cloudflare-specific headers
  if (!finalConfig.headers) {
    finalConfig.headers = {};
  }
  finalConfig.headers['X-Worker-Runtime'] = 'cloudflare';

  return new ServerlessRedis(finalConfig);
}

/**
 * Cloudflare Workers fetch handler wrapper for Redis operations
 */
export function withRedis<Env extends CloudflareEnvironment = CloudflareEnvironment>(
  handler: (redis: ServerlessRedis, request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
) {
  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    try {
      const redis = createServerlessRedis({}, env);
      return await handler(redis, request, env, ctx);
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
 * Enhanced Redis client with Cloudflare Workers optimizations
 */
export class CloudflareRedis extends ServerlessRedis {
  private env?: CloudflareEnvironment;
  private ctx?: ExecutionContext;

  constructor(config: CloudflareRedisConfig, env?: CloudflareEnvironment, ctx?: ExecutionContext) {
    super(createServerlessRedis(config, env).getConfig());
    this.env = env;
    this.ctx = ctx;
  }

  /**
   * Get a value with KV fallback caching
   */
  async getWithCache(key: string, ttl: number = 300): Promise<string | null> {
    // Try KV cache first if available
    if (this.env?.REDIS_CACHE) {
      const cached = await this.env.REDIS_CACHE.get(`redis:${key}`);
      if (cached !== null) {
        return cached;
      }
    }

    // Fallback to Redis
    const value = await this.get(key);
    
    // Cache in KV if value exists and KV is available
    if (value !== null && this.env?.REDIS_CACHE && this.ctx) {
      this.ctx.waitUntil(
        this.env.REDIS_CACHE.put(`redis:${key}`, value, { expirationTtl: ttl })
      );
    }

    return value;
  }

  /**
   * Set a value and update KV cache
   */
  async setWithCache(key: string, value: string, ttl?: number): Promise<string> {
    // Set in Redis first
    const result = ttl 
      ? await this.set(key, value, 'EX', ttl)
      : await this.set(key, value);

    // Update KV cache if available
    if (this.env?.REDIS_CACHE && this.ctx) {
      this.ctx.waitUntil(
        this.env.REDIS_CACHE.put(`redis:${key}`, value, { 
          expirationTtl: ttl || 300 
        })
      );
    }

    return result;
  }

  /**
   * Delete a value and clear from KV cache
   */
  async delWithCache(...keys: string[]): Promise<number> {
    // Delete from Redis first
    const result = await this.del(...keys);

    // Clear from KV cache if available
    if (this.env?.REDIS_CACHE && this.ctx) {
      this.ctx.waitUntil(
        Promise.all(
          keys.map(key => this.env!.REDIS_CACHE!.delete(`redis:${key}`))
        )
      );
    }

    return result;
  }

  /**
   * Store large objects in R2 with Redis metadata
   */
  async setLargeObject(key: string, data: string | ArrayBuffer | ReadableStream, metadata?: Record<string, string>): Promise<void> {
    if (!this.env?.R2) {
      throw new Error('R2 bucket not configured');
    }

    const objectKey = `redis-large:${key}`;
    
    // Store in R2
    await this.env.R2.put(objectKey, data, { 
      customMetadata: metadata 
    });

    // Store reference in Redis
    await this.set(key, JSON.stringify({
      type: 'r2-object',
      key: objectKey,
      size: data instanceof ArrayBuffer ? data.byteLength : undefined,
      metadata,
      createdAt: new Date().toISOString(),
    }));
  }

  /**
   * Retrieve large objects from R2 via Redis metadata
   */
  async getLargeObject(key: string): Promise<R2ObjectBody | null> {
    if (!this.env?.R2) {
      throw new Error('R2 bucket not configured');
    }

    // Get reference from Redis
    const ref = await this.get(key);
    if (!ref) return null;

    try {
      const metadata = JSON.parse(ref);
      if (metadata.type !== 'r2-object') {
        return null; // Not a large object
      }

      // Retrieve from R2
      const r2Object = await this.env.R2.get(metadata.key);
      return r2Object?.body || null;
    } catch {
      return null;
    }
  }
}

/**
 * Cloudflare Workers utilities
 */
export const CloudflareRedisUtils = {
  /**
   * Check if running in Cloudflare Workers environment
   */
  isCloudflareWorker(): boolean {
    return typeof caches !== 'undefined' && 
           typeof Request !== 'undefined' && 
           typeof addEventListener !== 'undefined';
  },

  /**
   * Get client IP from Cloudflare headers
   */
  getClientIP(request: Request): string {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           'unknown';
  },

  /**
   * Get client country from Cloudflare headers
   */
  getClientCountry(request: Request): string {
    return request.headers.get('CF-IPCountry') || 'unknown';
  },

  /**
   * Get Cloudflare data center (colo) from headers
   */
  getDataCenter(request: Request): string {
    return request.headers.get('CF-Ray')?.split('-')[1] || 'unknown';
  },

  /**
   * Create a rate limiting key based on client info
   */
  createRateLimitKey(request: Request, identifier?: string): string {
    const ip = this.getClientIP(request);
    const country = this.getClientCountry(request);
    return identifier ? `rate:${identifier}:${ip}` : `rate:${ip}:${country}`;
  },

  /**
   * Get optimized configuration for Cloudflare Workers
   */
  getOptimizedConfig(baseConfig: CloudflareRedisConfig = {}): CloudflareRedisConfig {
    return {
      timeout: 2000,       // Very short timeout for Workers
      retries: 1,          // Single retry
      compression: true,   // Enable compression
      ...baseConfig,
      headers: {
        'X-Worker-Runtime': 'cloudflare',
        ...baseConfig.headers,
      },
    };
  },

  /**
   * Create CORS response for Workers
   */
  corsResponse(data: any, status = 200, additionalHeaders: Record<string, string> = {}): Response {
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
  },

  /**
   * Handle CORS preflight for Workers
   */
  handleCors(request: Request): Response | null {
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
  },
};

/**
 * Rate limiting helper for Cloudflare Workers
 */
export class CloudflareRateLimit {
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

// Default export
export default createServerlessRedis;