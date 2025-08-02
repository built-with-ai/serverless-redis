/**
 * Cloudflare Workers integration for Serverless Redis Client
 */
import { ServerlessRedis, type ServerlessRedisConfig } from '@builtwithai/serverless-redis-client';
/**
 * Cloudflare Workers types (declare globally if not available)
 */
declare global {
    interface KVNamespace {
        get(key: string, options?: {
            type?: 'text' | 'json' | 'arrayBuffer' | 'stream';
        }): Promise<any>;
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
    REDIS_PROXY_URL?: string;
    REDIS_TOKEN?: string;
    REDIS_API_KEY?: string;
    REDIS_TIMEOUT?: string;
    REDIS_RETRIES?: string;
    REDIS_DB?: string;
    REDIS_CACHE?: KVNamespace;
    DB?: D1Database;
    R2?: R2Bucket;
    REDIS_DO?: DurableObjectNamespace;
}
/**
 * Create a ServerlessRedis client optimized for Cloudflare Workers
 */
export declare function createServerlessRedis(config?: CloudflareRedisConfig, env?: CloudflareEnvironment): ServerlessRedis;
/**
 * Cloudflare Workers fetch handler wrapper for Redis operations
 */
export declare function withRedis<Env extends CloudflareEnvironment = CloudflareEnvironment>(handler: (redis: ServerlessRedis, request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>): (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
/**
 * Enhanced Redis client with Cloudflare Workers optimizations
 */
export declare class CloudflareRedis extends ServerlessRedis {
    private env?;
    private ctx?;
    constructor(config: CloudflareRedisConfig, env?: CloudflareEnvironment, ctx?: ExecutionContext);
    /**
     * Get a value with KV fallback caching
     */
    getWithCache(key: string, ttl?: number): Promise<string | null>;
    /**
     * Set a value and update KV cache
     */
    setWithCache(key: string, value: string, ttl?: number): Promise<string>;
    /**
     * Delete a value and clear from KV cache
     */
    delWithCache(...keys: string[]): Promise<number>;
    /**
     * Store large objects in R2 with Redis metadata
     */
    setLargeObject(key: string, data: string | ArrayBuffer | ReadableStream, metadata?: Record<string, string>): Promise<void>;
    /**
     * Retrieve large objects from R2 via Redis metadata
     */
    getLargeObject(key: string): Promise<R2ObjectBody | null>;
}
/**
 * Cloudflare Workers utilities
 */
export declare const CloudflareRedisUtils: {
    /**
     * Check if running in Cloudflare Workers environment
     */
    isCloudflareWorker(): boolean;
    /**
     * Get client IP from Cloudflare headers
     */
    getClientIP(request: Request): string;
    /**
     * Get client country from Cloudflare headers
     */
    getClientCountry(request: Request): string;
    /**
     * Get Cloudflare data center (colo) from headers
     */
    getDataCenter(request: Request): string;
    /**
     * Create a rate limiting key based on client info
     */
    createRateLimitKey(request: Request, identifier?: string): string;
    /**
     * Get optimized configuration for Cloudflare Workers
     */
    getOptimizedConfig(baseConfig?: CloudflareRedisConfig): CloudflareRedisConfig;
    /**
     * Create CORS response for Workers
     */
    corsResponse(data: any, status?: number, additionalHeaders?: Record<string, string>): Response;
    /**
     * Handle CORS preflight for Workers
     */
    handleCors(request: Request): Response | null;
};
/**
 * Rate limiting helper for Cloudflare Workers
 */
export declare class CloudflareRateLimit {
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
export default createServerlessRedis;
//# sourceMappingURL=index.d.ts.map