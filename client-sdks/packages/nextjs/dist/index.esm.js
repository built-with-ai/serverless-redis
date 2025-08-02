import { ServerlessRedis } from '@builtwithai/serverless-redis-client';
export { AuthenticationError, ConnectionError, Pipeline, RedisError, ServerlessRedis, ServerlessRedisError, TimeoutError, Transaction, ValidationError } from '@builtwithai/serverless-redis-client';

/**
 * Next.js integration for Serverless Redis Client
 */
/**
 * Create a ServerlessRedis client with Next.js specific defaults
 */
function createServerlessRedis(config = {}) {
    const env = process.env;
    // Auto-detect configuration from environment variables
    const finalConfig = {
        url: config.url || env.REDIS_PROXY_URL || '',
        token: config.token || env.REDIS_TOKEN || env.REDIS_API_KEY || '',
        timeout: config.timeout || (env.REDIS_TIMEOUT ? parseInt(env.REDIS_TIMEOUT) : 5000),
        retries: config.retries || (env.REDIS_RETRIES ? parseInt(env.REDIS_RETRIES) : 3),
        db: config.db || (env.REDIS_DB ? parseInt(env.REDIS_DB) : 0),
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
 * Global Redis client instance for Next.js applications
 */
let globalRedis;
/**
 * Get or create a global Redis client instance
 * Useful for Next.js applications to reuse connections
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
 * Next.js API route helper for Redis operations
 */
function withRedis(handler) {
    return async (req, res) => {
        try {
            const redis = getServerlessRedis();
            const result = await handler(redis, req, res);
            if (result !== undefined && !res.headersSent) {
                res.json(result);
            }
        }
        catch (error) {
            console.error('Redis operation failed:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal server error',
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
    };
}
/**
 * Next.js middleware for Redis operations
 */
function createRedisMiddleware(config) {
    const redis = createServerlessRedis(config);
    return {
        redis,
        middleware: (req, res, next) => {
            // Add redis instance to request object
            req.redis = redis;
            next();
        },
    };
}
/**
 * React hook for using Redis in Next.js client components
 * Note: This creates a client-side Redis instance that should
 * only be used with proper CORS configuration
 */
function useServerlessRedis(config) {
    // In a real implementation, you might want to use React state
    // and handle client-side caching, but for now, create a simple instance
    return createServerlessRedis(config);
}
/**
 * Next.js specific utilities
 */
const NextRedisUtils = {
    /**
     * Check if running in Next.js environment
     */
    isNextJS() {
        return typeof process !== 'undefined' &&
            typeof process.env !== 'undefined' &&
            (process.env.NEXT_RUNTIME !== undefined || process.env.__NEXT_PRIVATE_PREBUNDLED_REACT !== undefined);
    },
    /**
     * Check if running in Edge Runtime
     */
    isEdgeRuntime() {
        return typeof process !== 'undefined' &&
            process.env.NEXT_RUNTIME === 'edge';
    },
    /**
     * Check if running in Node.js runtime
     */
    isNodeRuntime() {
        return typeof process !== 'undefined' &&
            process.env.NEXT_RUNTIME === 'nodejs';
    },
    /**
     * Get optimized configuration for current runtime
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
        return config;
    },
};

export { NextRedisUtils, createRedisMiddleware, createServerlessRedis, createServerlessRedis as default, getServerlessRedis, resetServerlessRedis, useServerlessRedis, withRedis };
//# sourceMappingURL=index.esm.js.map
