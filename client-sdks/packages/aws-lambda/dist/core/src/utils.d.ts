import { ServerlessRedisConfig, HttpMethod, RequestInterceptor, ResponseInterceptor } from './types';
/**
 * Sleep utility for retry delays
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Calculate exponential backoff delay
 */
export declare function calculateBackoffDelay(attempt: number, baseDelay: number): number;
/**
 * Validate Redis key
 */
export declare function validateKey(key: unknown): string;
/**
 * Serialize Redis value for transmission
 */
export declare function serializeValue(value: unknown): string;
/**
 * Parse Redis response value
 */
export declare function parseValue(value: unknown, type?: string): unknown;
/**
 * HTTP client with retry logic and interceptors
 */
export declare class HttpClient {
    private config;
    private retryConfig;
    private requestInterceptors;
    private responseInterceptors;
    constructor(config: ServerlessRedisConfig);
    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor: RequestInterceptor): void;
    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor: ResponseInterceptor): void;
    /**
     * Make HTTP request with retry logic
     */
    request<T = unknown>(method: HttpMethod, path: string, data?: unknown): Promise<T>;
    /**
     * Make single HTTP request
     */
    private makeRequest;
}
/**
 * Build URL with query parameters
 */
export declare function buildUrl(base: string, params?: Record<string, string>): string;
/**
 * Validate configuration
 */
export declare function validateConfig(config: ServerlessRedisConfig): void;
//# sourceMappingURL=utils.d.ts.map