import { ServerlessRedis } from '@builtwithai/serverless-redis-client';
export { AuthenticationError, ConnectionError, Pipeline, RedisError, ServerlessRedis, ServerlessRedisError, TimeoutError, Transaction, ValidationError } from '@builtwithai/serverless-redis-client';

/**
 * AWS Lambda integration for Serverless Redis Client
 */
/**
 * Create a ServerlessRedis client optimized for AWS Lambda
 */
function createServerlessRedis(config = {}) {
    const env = process.env;
    // Detect if running in Lambda environment
    !!env.AWS_LAMBDA_RUNTIME_API;
    // Auto-detect configuration from environment variables
    const finalConfig = {
        url: config.url || env.REDIS_PROXY_URL || '',
        token: config.token || env.REDIS_TOKEN || env.REDIS_API_KEY || '',
        timeout: config.timeout || (env.REDIS_TIMEOUT ? parseInt(env.REDIS_TIMEOUT) : 10000), // 10s timeout for Lambda
        retries: config.retries || (env.REDIS_RETRIES ? parseInt(env.REDIS_RETRIES) : 3),
        db: config.db || (env.REDIS_DB ? parseInt(env.REDIS_DB) : 0),
        compression: config.compression !== false, // Enable compression by default
        ...config,
    };
    if (!finalConfig.url) {
        throw new Error('Redis proxy URL is required. Set REDIS_PROXY_URL environment variable or pass url in config.');
    }
    if (!finalConfig.token) {
        throw new Error('Redis token is required. Set REDIS_TOKEN or REDIS_API_KEY environment variable or pass token in config.');
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
let globalRedis;
/**
 * Get or create a global Redis client instance
 * Optimized for Lambda container reuse
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
 * API Gateway Lambda handler wrapper for Redis operations (v1)
 */
function withRedis(handler) {
    return async (event, context) => {
        try {
            const redis = getServerlessRedis();
            const result = await handler(redis, event, context);
            // If handler returns an APIGatewayProxyResult, return it directly
            if (result && typeof result === 'object' && 'statusCode' in result) {
                return result;
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
        }
        catch (error) {
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
function withRedisV2(handler) {
    return async (event, context) => {
        try {
            const redis = getServerlessRedis();
            const result = await handler(redis, event, context);
            // If handler returns an APIGatewayProxyResultV2, return it directly
            if (result && typeof result === 'object' && 'statusCode' in result) {
                return result;
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
        }
        catch (error) {
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
function withRedisGeneric(handler) {
    return async (event, context) => {
        const redis = getServerlessRedis();
        return await handler(redis, event, context);
    };
}
/**
 * Middleware for Lambda functions
 */
function createRedisMiddleware(config) {
    const redis = createServerlessRedis(config);
    return {
        redis,
        // Middy.js compatible middleware
        before: async (request) => {
            request.redis = redis;
        },
    };
}
/**
 * AWS Lambda utilities
 */
const LambdaRedisUtils = {
    /**
     * Check if running in AWS Lambda environment
     */
    isLambda() {
        return !!process.env.AWS_LAMBDA_RUNTIME_API;
    },
    /**
     * Get Lambda function information
     */
    getFunctionInfo() {
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
    getClientIP(event) {
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
    getUserAgent(event) {
        const headers = event.headers || {};
        return headers['User-Agent'] || headers['user-agent'] || 'unknown';
    },
    /**
     * Create rate limiting key from Lambda event
     */
    createRateLimitKey(event, identifier) {
        const ip = this.getClientIP(event);
        return identifier ? `rate:${identifier}:${ip}` : `rate:${ip}`;
    },
    /**
     * Get optimized configuration for Lambda environment
     */
    getOptimizedConfig(baseConfig = {}) {
        const memorySize = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
            ? parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE)
            : 128;
        // Adjust timeouts based on Lambda memory allocation
        let timeout = 10000; // Default 10s
        if (memorySize <= 512) {
            timeout = 8000; // 8s for smaller functions
        }
        else if (memorySize >= 1024) {
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
    corsResponse(data, statusCode = 200, additionalHeaders = {}) {
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
    corsResponseV2(data, statusCode = 200, additionalHeaders = {}) {
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
    handleCors(event) {
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
    handleCorsV2(event) {
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
    parseBody(event) {
        if (!event.body)
            return null;
        try {
            return event.isBase64Encoded
                ? JSON.parse(Buffer.from(event.body, 'base64').toString())
                : JSON.parse(event.body);
        }
        catch {
            return null;
        }
    },
    /**
     * Get query parameters from API Gateway event
     */
    getQueryParams(event) {
        // API Gateway v2 format
        if ('queryStringParameters' in event && event.queryStringParameters) {
            const params = {};
            Object.entries(event.queryStringParameters).forEach(([key, value]) => {
                if (value !== undefined) {
                    params[key] = value;
                }
            });
            return params;
        }
        // API Gateway v1 format
        const v1Params = event.queryStringParameters || {};
        const params = {};
        Object.entries(v1Params).forEach(([key, value]) => {
            if (value !== undefined) {
                params[key] = value;
            }
        });
        return params;
    },
    /**
     * Get path parameters from API Gateway event
     */
    getPathParams(event) {
        const pathParams = event.pathParameters || {};
        const params = {};
        Object.entries(pathParams).forEach(([key, value]) => {
            if (value !== undefined) {
                params[key] = value;
            }
        });
        return params;
    },
};
/**
 * Rate limiting helper for Lambda functions
 */
class LambdaRateLimit {
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

export { LambdaRateLimit, LambdaRedisUtils, createRedisMiddleware, createServerlessRedis, createServerlessRedis as default, getServerlessRedis, resetServerlessRedis, withRedis, withRedisGeneric, withRedisV2 };
//# sourceMappingURL=index.esm.js.map
