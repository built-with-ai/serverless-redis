/**
 * Next.js integration for Serverless Redis Client
 */
import { ServerlessRedis, type ServerlessRedisConfig } from '@builtwithai/serverless-redis-client';
/**
 * Next.js specific configuration
 */
export interface NextRedisConfig extends Omit<ServerlessRedisConfig, 'url' | 'token'> {
    /** Base URL of the Redis proxy server */
    url?: string;
    /** Authentication token (API key or JWT) */
    token?: string;
}
/**
 * Create a ServerlessRedis client with Next.js specific defaults
 */
export declare function createServerlessRedis(config?: NextRedisConfig): ServerlessRedis;
/**
 * Get or create a global Redis client instance
 * Useful for Next.js applications to reuse connections
 */
export declare function getServerlessRedis(config?: NextRedisConfig): ServerlessRedis;
/**
 * Reset the global Redis client instance
 * Useful for testing or configuration changes
 */
export declare function resetServerlessRedis(): void;
/**
 * Next.js API route helper for Redis operations
 */
export declare function withRedis<T = any>(handler: (redis: ServerlessRedis, req: any, res: any) => Promise<T>): (req: any, res: any) => Promise<void>;
/**
 * Next.js middleware for Redis operations
 */
export declare function createRedisMiddleware(config?: NextRedisConfig): {
    redis: ServerlessRedis;
    middleware: (req: any, res: any, next: () => void) => void;
};
/**
 * React hook for using Redis in Next.js client components
 * Note: This creates a client-side Redis instance that should
 * only be used with proper CORS configuration
 */
export declare function useServerlessRedis(config?: NextRedisConfig): ServerlessRedis;
/**
 * Next.js specific utilities
 */
export declare const NextRedisUtils: {
    /**
     * Check if running in Next.js environment
     */
    isNextJS(): boolean;
    /**
     * Check if running in Edge Runtime
     */
    isEdgeRuntime(): boolean;
    /**
     * Check if running in Node.js runtime
     */
    isNodeRuntime(): boolean;
    /**
     * Get optimized configuration for current runtime
     */
    getOptimizedConfig(baseConfig?: NextRedisConfig): NextRedisConfig;
};
export { ServerlessRedis, Pipeline, Transaction, type ServerlessRedisConfig, type RedisValue, type RedisKey, type HealthResponse, ServerlessRedisError, ConnectionError, AuthenticationError, RedisError, TimeoutError, ValidationError, } from '@builtwithai/serverless-redis-client';
export default createServerlessRedis;
//# sourceMappingURL=index.d.ts.map