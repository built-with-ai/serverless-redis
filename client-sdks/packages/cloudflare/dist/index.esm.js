import { ServerlessRedis } from '@builtwithai/serverless-redis-client';
export { AuthenticationError, ConnectionError, Pipeline, RedisError, ServerlessRedis, ServerlessRedisError, TimeoutError, Transaction, ValidationError } from '@builtwithai/serverless-redis-client';

/**
 * Cloudflare Workers integration for Serverless Redis Client
 */
/**
 * Create a ServerlessRedis client optimized for Cloudflare Workers
 */
function createServerlessRedis(config = {}, env) {
    // Auto-detect configuration from environment
    const finalConfig = {
        url: config.url || env?.REDIS_PROXY_URL || '',
        token: config.token || env?.REDIS_TOKEN || env?.REDIS_API_KEY || '',
        timeout: config.timeout || (env?.REDIS_TIMEOUT ? parseInt(env.REDIS_TIMEOUT) : 2000), // Very short timeout for Workers
        retries: config.retries || (env?.REDIS_RETRIES ? parseInt(env.REDIS_RETRIES) : 1), // Single retry for Workers
        db: config.db || (env?.REDIS_DB ? parseInt(env.REDIS_DB) : 0),
        compression: config.compression !== false, // Enable compression by default
        ...config,
    };
    if (!finalConfig.url) {
        throw new Error('Redis proxy URL is required. Set REDIS_PROXY_URL environment variable or pass url in config.');
    }
    if (!finalConfig.token) {
        throw new Error('Redis token is required. Set REDIS_TOKEN or REDIS_API_KEY environment variable or pass token in config.');
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
function withRedis(handler) {
    return async (request, env, ctx) => {
        try {
            const redis = createServerlessRedis({}, env);
            return await handler(redis, request, env, ctx);
        }
        catch (error) {
            console.error('Redis operation failed:', error);
            return new Response(JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }
    };
}
/**
 * Enhanced Redis client with Cloudflare Workers optimizations
 */
class CloudflareRedis extends ServerlessRedis {
    constructor(config, env, ctx) {
        super(createServerlessRedis(config, env).getConfig());
        this.env = env;
        this.ctx = ctx;
    }
    /**
     * Get a value with KV fallback caching
     */
    async getWithCache(key, ttl = 300) {
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
            this.ctx.waitUntil(this.env.REDIS_CACHE.put(`redis:${key}`, value, { expirationTtl: ttl }));
        }
        return value;
    }
    /**
     * Set a value and update KV cache
     */
    async setWithCache(key, value, ttl) {
        // Set in Redis first
        const result = ttl
            ? await this.set(key, value, 'EX', ttl)
            : await this.set(key, value);
        // Update KV cache if available
        if (this.env?.REDIS_CACHE && this.ctx) {
            this.ctx.waitUntil(this.env.REDIS_CACHE.put(`redis:${key}`, value, {
                expirationTtl: ttl || 300
            }));
        }
        return result;
    }
    /**
     * Delete a value and clear from KV cache
     */
    async delWithCache(...keys) {
        // Delete from Redis first
        const result = await this.del(...keys);
        // Clear from KV cache if available
        if (this.env?.REDIS_CACHE && this.ctx) {
            this.ctx.waitUntil(Promise.all(keys.map(key => this.env.REDIS_CACHE.delete(`redis:${key}`))));
        }
        return result;
    }
    /**
     * Store large objects in R2 with Redis metadata
     */
    async setLargeObject(key, data, metadata) {
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
    async getLargeObject(key) {
        if (!this.env?.R2) {
            throw new Error('R2 bucket not configured');
        }
        // Get reference from Redis
        const ref = await this.get(key);
        if (!ref)
            return null;
        try {
            const metadata = JSON.parse(ref);
            if (metadata.type !== 'r2-object') {
                return null; // Not a large object
            }
            // Retrieve from R2
            const r2Object = await this.env.R2.get(metadata.key);
            return r2Object?.body || null;
        }
        catch {
            return null;
        }
    }
}
/**
 * Cloudflare Workers utilities
 */
const CloudflareRedisUtils = {
    /**
     * Check if running in Cloudflare Workers environment
     */
    isCloudflareWorker() {
        return typeof caches !== 'undefined' &&
            typeof Request !== 'undefined' &&
            typeof addEventListener !== 'undefined';
    },
    /**
     * Get client IP from Cloudflare headers
     */
    getClientIP(request) {
        return request.headers.get('CF-Connecting-IP') ||
            request.headers.get('X-Forwarded-For') ||
            'unknown';
    },
    /**
     * Get client country from Cloudflare headers
     */
    getClientCountry(request) {
        return request.headers.get('CF-IPCountry') || 'unknown';
    },
    /**
     * Get Cloudflare data center (colo) from headers
     */
    getDataCenter(request) {
        return request.headers.get('CF-Ray')?.split('-')[1] || 'unknown';
    },
    /**
     * Create a rate limiting key based on client info
     */
    createRateLimitKey(request, identifier) {
        const ip = this.getClientIP(request);
        const country = this.getClientCountry(request);
        return identifier ? `rate:${identifier}:${ip}` : `rate:${ip}:${country}`;
    },
    /**
     * Get optimized configuration for Cloudflare Workers
     */
    getOptimizedConfig(baseConfig = {}) {
        return {
            timeout: 2000, // Very short timeout for Workers
            retries: 1, // Single retry
            compression: true, // Enable compression
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
    corsResponse(data, status = 200, additionalHeaders = {}) {
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
    handleCors(request) {
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
class CloudflareRateLimit {
    constructor(redis, limit, windowSeconds) {
        this.redis = redis;
        this.limit = limit;
        this.window = windowSeconds;
    }
    async check(key) {
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

export { CloudflareRateLimit, CloudflareRedis, CloudflareRedisUtils, createServerlessRedis, createServerlessRedis as default, withRedis };
//# sourceMappingURL=index.esm.js.map
