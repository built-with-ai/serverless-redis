import { ServerlessRedis } from '@builtwithai/serverless-redis-client';
export { AuthenticationError, ConnectionError, Pipeline, RedisError, ServerlessRedis, ServerlessRedisError, TimeoutError, Transaction, ValidationError } from '@builtwithai/serverless-redis-client';

/**
 * Vercel Edge Functions integration for Serverless Redis Client
 */
/**
 * Create a ServerlessRedis client optimized for Vercel Edge Functions
 */
function createServerlessRedis(config = {}) {
    const env = process.env;
    // Edge Functions have stricter timeout limits
    const isEdgeFunction = typeof EdgeRuntime !== 'undefined';
    // Auto-detect configuration from environment variables
    const finalConfig = {
        url: config.url || env.REDIS_PROXY_URL || '',
        token: config.token || env.REDIS_TOKEN || env.REDIS_API_KEY || '',
        timeout: config.timeout || (env.REDIS_TIMEOUT ? parseInt(env.REDIS_TIMEOUT) : (isEdgeFunction ? 3000 : 5000)),
        retries: config.retries || (env.REDIS_RETRIES ? parseInt(env.REDIS_RETRIES) : (isEdgeFunction ? 1 : 3)),
        db: config.db || (env.REDIS_DB ? parseInt(env.REDIS_DB) : 0),
        compression: config.compression !== false, // Enable compression by default for edge
        ...config,
    };
    if (!finalConfig.url) {
        throw new Error('Redis proxy URL is required. Set REDIS_PROXY_URL environment variable or pass url in config.');
    }
    if (!finalConfig.token) {
        throw new Error('Redis token is required. Set REDIS_TOKEN or REDIS_API_KEY environment variable or pass token in config.');
    }
    return new ServerlessRedis(finalConfig);
}
/**
 * Global Redis client instance for Vercel applications
 */
let globalRedis;
/**
 * Get or create a global Redis client instance
 * Optimized for Vercel's execution model
 */
function getServerlessRedis(config) {
    if (!globalRedis) {
        globalRedis = createServerlessRedis(config);
    }
    return globalRedis;
}
/**
 * Reset the global Redis client instance
 * Useful for testing or configuration changes
 */
function resetServerlessRedis() {
    globalRedis = undefined;
}
/**
 * Vercel Edge Function handler wrapper for Redis operations
 */
function withRedis(handler) {
    return async (request) => {
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
 * Middleware for Vercel Edge Functions
 */
function createRedisMiddleware(config) {
    const redis = createServerlessRedis(config);
    return {
        redis,
        middleware: (request) => {
            // Add redis instance to request object
            request.redis = redis;
            return request;
        },
    };
}
/**
 * Vercel-specific utilities
 */
const VercelRedisUtils = {
    /**
     * Check if running in Vercel Edge Runtime
     */
    isEdgeRuntime() {
        return typeof EdgeRuntime !== 'undefined';
    },
    /**
     * Check if running in Vercel Node.js runtime
     */
    isNodeRuntime() {
        return typeof process !== 'undefined' &&
            typeof EdgeRuntime === 'undefined';
    },
    /**
     * Check if running in production environment
     */
    isProduction() {
        return process.env.VERCEL_ENV === 'production';
    },
    /**
     * Check if running in preview environment
     */
    isPreview() {
        return process.env.VERCEL_ENV === 'preview';
    },
    /**
     * Check if running in development environment
     */
    isDevelopment() {
        return process.env.VERCEL_ENV === 'development' ||
            process.env.NODE_ENV === 'development';
    },
    /**
     * Get the current Vercel URL
     */
    getVercelUrl() {
        return process.env.VERCEL_URL;
    },
    /**
     * Get optimized configuration for current Vercel environment
     */
    getOptimizedConfig(baseConfig = {}) {
        const config = { ...baseConfig };
        if (this.isEdgeRuntime()) {
            // Edge Runtime optimizations
            config.timeout = config.timeout || 3000; // Shorter timeout for edge
            config.retries = config.retries || 1; // Fewer retries for edge
            config.compression = config.compression !== false; // Enable compression
        }
        else {
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
    createConfigFromEnvironment() {
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
function corsResponse(data, status = 200, additionalHeaders = {}) {
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
function handleCors(request) {
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

export { VercelRedisUtils, corsResponse, createRedisMiddleware, createServerlessRedis, createServerlessRedis as default, getServerlessRedis, handleCors, resetServerlessRedis, withRedis };
//# sourceMappingURL=index.esm.js.map
