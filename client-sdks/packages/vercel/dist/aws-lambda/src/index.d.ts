/**
 * AWS Lambda integration for Serverless Redis Client
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context, Handler, APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
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
 * Create a ServerlessRedis client optimized for AWS Lambda
 */
export declare function createServerlessRedis(config?: LambdaRedisConfig): ServerlessRedis;
/**
 * Get or create a global Redis client instance
 * Optimized for Lambda container reuse
 */
export declare function getServerlessRedis(config?: LambdaRedisConfig): ServerlessRedis;
/**
 * Reset the global Redis client instance
 * Useful for testing or configuration changes
 */
export declare function resetServerlessRedis(): void;
/**
 * API Gateway Lambda handler wrapper for Redis operations (v1)
 */
export declare function withRedis<T = any>(handler: (redis: ServerlessRedis, event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult | T>): Handler<APIGatewayProxyEvent, APIGatewayProxyResult>;
/**
 * API Gateway Lambda handler wrapper for Redis operations (v2)
 */
export declare function withRedisV2<T = any>(handler: (redis: ServerlessRedis, event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2 | T>): Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2>;
/**
 * Generic Lambda handler wrapper for any event type
 */
export declare function withRedisGeneric<TEvent = any, TResult = any>(handler: (redis: ServerlessRedis, event: TEvent, context: Context) => Promise<TResult>): Handler<TEvent, TResult>;
/**
 * Middleware for Lambda functions
 */
export declare function createRedisMiddleware(config?: LambdaRedisConfig): {
    redis: ServerlessRedis;
    before: (request: any) => Promise<void>;
};
/**
 * AWS Lambda utilities
 */
export declare const LambdaRedisUtils: {
    /**
     * Check if running in AWS Lambda environment
     */
    isLambda(): boolean;
    /**
     * Get Lambda function information
     */
    getFunctionInfo(): {
        name?: string;
        version?: string;
        memorySize?: number;
        region?: string;
    };
    /**
     * Get client IP from API Gateway event
     */
    getClientIP(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string;
    /**
     * Get user agent from API Gateway event
     */
    getUserAgent(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string;
    /**
     * Create rate limiting key from Lambda event
     */
    createRateLimitKey(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, identifier?: string): string;
    /**
     * Get optimized configuration for Lambda environment
     */
    getOptimizedConfig(baseConfig?: LambdaRedisConfig): LambdaRedisConfig;
    /**
     * Create CORS response for API Gateway
     */
    corsResponse(data: any, statusCode?: number, additionalHeaders?: Record<string, string>): APIGatewayProxyResult;
    /**
     * Create CORS response for API Gateway v2
     */
    corsResponseV2(data: any, statusCode?: number, additionalHeaders?: Record<string, string>): APIGatewayProxyResultV2;
    /**
     * Handle CORS preflight for API Gateway v1
     */
    handleCors(event: APIGatewayProxyEvent): APIGatewayProxyResult | null;
    /**
     * Handle CORS preflight for API Gateway v2
     */
    handleCorsV2(event: APIGatewayProxyEventV2): APIGatewayProxyResultV2 | null;
    /**
     * Parse JSON body from API Gateway event
     */
    parseBody<T = any>(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): T | null;
    /**
     * Get query parameters from API Gateway event
     */
    getQueryParams(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string>;
    /**
     * Get path parameters from API Gateway event
     */
    getPathParams(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string>;
};
/**
 * Rate limiting helper for Lambda functions
 */
export declare class LambdaRateLimit {
    private redis;
    private window;
    private limit;
    constructor(redis: ServerlessRedis, limit: number, windowSeconds: number);
    check(key: string): Promise<{
        allowed: boolean;
        remaining: number;
        resetIn: number;
    }>;
}
export { ServerlessRedis, Pipeline, Transaction, type ServerlessRedisConfig, type RedisValue, type RedisKey, type HealthResponse, ServerlessRedisError, ConnectionError, AuthenticationError, RedisError, TimeoutError, ValidationError, } from '@builtwithai/serverless-redis-client';
export type { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context, Handler, } from 'aws-lambda';
export default createServerlessRedis;
//# sourceMappingURL=index.d.ts.map