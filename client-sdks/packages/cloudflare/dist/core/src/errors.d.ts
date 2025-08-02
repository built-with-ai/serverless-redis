/**
 * Base error class for all ServerlessRedis errors
 */
export declare class ServerlessRedisError extends Error {
    readonly code: string;
    readonly statusCode?: number;
    constructor(message: string, code?: string, statusCode?: number);
}
/**
 * Connection error - network or HTTP-level issues
 */
export declare class ConnectionError extends ServerlessRedisError {
    constructor(message: string, statusCode?: number);
}
/**
 * Authentication error - invalid token or unauthorized
 */
export declare class AuthenticationError extends ServerlessRedisError {
    constructor(message?: string);
}
/**
 * Redis command error - Redis-level errors
 */
export declare class RedisError extends ServerlessRedisError {
    readonly command?: string;
    constructor(message: string, command?: string);
}
/**
 * Timeout error - request took too long
 */
export declare class TimeoutError extends ServerlessRedisError {
    readonly timeout: number;
    constructor(timeout: number);
}
/**
 * Validation error - invalid parameters or configuration
 */
export declare class ValidationError extends ServerlessRedisError {
    constructor(message: string);
}
/**
 * Rate limit error - too many requests
 */
export declare class RateLimitError extends ServerlessRedisError {
    readonly retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
}
/**
 * Pipeline error - error during pipeline execution
 */
export declare class PipelineError extends ServerlessRedisError {
    readonly results: unknown[];
    readonly failedIndex: number;
    constructor(message: string, results: unknown[], failedIndex: number);
}
/**
 * Transaction error - error during transaction execution
 */
export declare class TransactionError extends ServerlessRedisError {
    constructor(message: string);
}
/**
 * Utility function to create appropriate error from HTTP response
 */
export declare function createErrorFromResponse(status: number, statusText: string, data?: {
    error?: string;
    message?: string;
    code?: string;
}): ServerlessRedisError;
/**
 * Utility function to determine if an error is retryable
 */
export declare function isRetryableError(error: Error): boolean;
//# sourceMappingURL=errors.d.ts.map