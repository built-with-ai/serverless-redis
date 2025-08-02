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
 * Create a ServerlessRedis client optimized for Vercel Edge Functions
 */
export declare function createServerlessRedis(config?: VercelRedisConfig): ServerlessRedis;
/**
 * Get or create a global Redis client instance
 * Optimized for Vercel's execution model
 */
export declare function getServerlessRedis(config?: VercelRedisConfig): ServerlessRedis;
/**
 * Reset the global Redis client instance
 * Useful for testing or configuration changes
 */
export declare function resetServerlessRedis(): void;
/**
 * Vercel Edge Function handler wrapper for Redis operations
 */
export declare function withRedis<T = any>(handler: (redis: ServerlessRedis, request: Request) => Promise<Response | T>): (request: Request) => Promise<Response>;
/**
 * Middleware for Vercel Edge Functions
 */
export declare function createRedisMiddleware(config?: VercelRedisConfig): {
    redis: ServerlessRedis;
    middleware: (request: Request & {
        redis?: ServerlessRedis;
    }) => Request & {
        redis?: ServerlessRedis;
    };
};
/**
 * Vercel-specific utilities
 */
export declare const VercelRedisUtils: {
    /**
     * Check if running in Vercel Edge Runtime
     */
    isEdgeRuntime(): boolean;
    /**
     * Check if running in Vercel Node.js runtime
     */
    isNodeRuntime(): boolean;
    /**
     * Check if running in production environment
     */
    isProduction(): boolean;
    /**
     * Check if running in preview environment
     */
    isPreview(): boolean;
    /**
     * Check if running in development environment
     */
    isDevelopment(): boolean;
    /**
     * Get the current Vercel URL
     */
    getVercelUrl(): string | undefined;
    /**
     * Get optimized configuration for current Vercel environment
     */
    getOptimizedConfig(baseConfig?: VercelRedisConfig): VercelRedisConfig;
    /**
     * Create a Redis configuration from Vercel environment
     */
    createConfigFromEnvironment(): VercelRedisConfig;
};
/**
 * Helper for creating CORS-enabled responses
 */
export declare function corsResponse(data: any, status?: number, additionalHeaders?: Record<string, string>): Response;
/**
 * Helper for handling CORS preflight requests
 */
export declare function handleCors(request: Request): Response | null;
export { ServerlessRedis, Pipeline, Transaction, type ServerlessRedisConfig, type RedisValue, type RedisKey, type HealthResponse, ServerlessRedisError, ConnectionError, AuthenticationError, RedisError, TimeoutError, ValidationError, } from '@builtwithai/serverless-redis-client';
export default createServerlessRedis;
//# sourceMappingURL=index.d.ts.map