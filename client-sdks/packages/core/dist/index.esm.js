/**
 * Base error class for all ServerlessRedis errors
 */
class ServerlessRedisError extends Error {
    constructor(message, code = 'SERVERLESS_REDIS_ERROR', statusCode) {
        super(message);
        this.name = 'ServerlessRedisError';
        this.code = code;
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, ServerlessRedisError.prototype);
    }
}
/**
 * Connection error - network or HTTP-level issues
 */
class ConnectionError extends ServerlessRedisError {
    constructor(message, statusCode) {
        super(message, 'CONNECTION_ERROR', statusCode);
        this.name = 'ConnectionError';
        Object.setPrototypeOf(this, ConnectionError.prototype);
    }
}
/**
 * Authentication error - invalid token or unauthorized
 */
class AuthenticationError extends ServerlessRedisError {
    constructor(message = 'Authentication failed') {
        super(message, 'AUTHENTICATION_ERROR', 401);
        this.name = 'AuthenticationError';
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
/**
 * Redis command error - Redis-level errors
 */
class RedisError extends ServerlessRedisError {
    constructor(message, command) {
        super(message, 'REDIS_ERROR');
        this.name = 'RedisError';
        this.command = command;
        Object.setPrototypeOf(this, RedisError.prototype);
    }
}
/**
 * Timeout error - request took too long
 */
class TimeoutError extends ServerlessRedisError {
    constructor(timeout) {
        super(`Request timed out after ${timeout}ms`, 'TIMEOUT_ERROR');
        this.name = 'TimeoutError';
        this.timeout = timeout;
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}
/**
 * Validation error - invalid parameters or configuration
 */
class ValidationError extends ServerlessRedisError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
/**
 * Rate limit error - too many requests
 */
class RateLimitError extends ServerlessRedisError {
    constructor(message = 'Rate limit exceeded', retryAfter) {
        super(message, 'RATE_LIMIT_ERROR', 429);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
/**
 * Pipeline error - error during pipeline execution
 */
class PipelineError extends ServerlessRedisError {
    constructor(message, results, failedIndex) {
        super(message, 'PIPELINE_ERROR');
        this.name = 'PipelineError';
        this.results = results;
        this.failedIndex = failedIndex;
        Object.setPrototypeOf(this, PipelineError.prototype);
    }
}
/**
 * Transaction error - error during transaction execution
 */
class TransactionError extends ServerlessRedisError {
    constructor(message) {
        super(message, 'TRANSACTION_ERROR');
        this.name = 'TransactionError';
        Object.setPrototypeOf(this, TransactionError.prototype);
    }
}
/**
 * Utility function to create appropriate error from HTTP response
 */
function createErrorFromResponse(status, statusText, data) {
    const message = data?.error || data?.message || statusText || 'Unknown error';
    const code = data?.code;
    switch (status) {
        case 401:
            return new AuthenticationError(message);
        case 429:
            return new RateLimitError(message);
        case 408:
            return new TimeoutError(5000); // Default timeout
        case 400:
            return new ValidationError(message);
        default:
            if (status >= 500) {
                return new ConnectionError(message, status);
            }
            return new ServerlessRedisError(message, code, status);
    }
}
/**
 * Utility function to determine if an error is retryable
 */
function isRetryableError(error) {
    if (error instanceof ConnectionError) {
        // Retry on 5xx errors and network errors
        return !error.statusCode || error.statusCode >= 500;
    }
    if (error instanceof TimeoutError) {
        return true;
    }
    if (error instanceof RateLimitError) {
        return true; // Can retry with backoff
    }
    // Don't retry auth errors, validation errors, or Redis command errors
    return false;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt, baseDelay) {
    return Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, 30000);
}
/**
 * Validate Redis key
 */
function validateKey(key) {
    if (typeof key !== 'string' && !Buffer.isBuffer(key)) {
        throw new Error('Redis key must be a string or Buffer');
    }
    return key.toString();
}
/**
 * Serialize Redis value for transmission
 */
function serializeValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (Buffer.isBuffer(value)) {
        return value.toString();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value.toString();
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}
/**
 * Parse Redis response value
 */
function parseValue(value, type) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        // Try to parse as JSON if it looks like JSON
        if (type === 'json' || (value.startsWith('{') || value.startsWith('['))) {
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        }
        // Try to parse as number if it looks like a number
        if (type === 'number' || /^-?\d+(\.\d+)?$/.test(value)) {
            const num = Number(value);
            if (!isNaN(num)) {
                return num;
            }
        }
    }
    return value;
}
/**
 * HTTP client with retry logic and interceptors
 */
class HttpClient {
    constructor(config) {
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.config = config;
        this.retryConfig = {
            retries: config.retries ?? 3,
            retryDelay: config.retryDelay ?? 100,
            retryCondition: isRetryableError,
        };
    }
    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }
    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
    /**
     * Make HTTP request with retry logic
     */
    async request(method, path, data) {
        let lastError;
        for (let attempt = 0; attempt <= this.retryConfig.retries; attempt++) {
            try {
                return await this.makeRequest(method, path, data);
            }
            catch (error) {
                lastError = error;
                // Don't retry on last attempt
                if (attempt === this.retryConfig.retries) {
                    break;
                }
                // Check if error is retryable
                if (!this.retryConfig.retryCondition?.(lastError)) {
                    break;
                }
                // Calculate delay and wait
                const delay = calculateBackoffDelay(attempt, this.retryConfig.retryDelay);
                await sleep(delay);
            }
        }
        throw lastError;
    }
    /**
     * Make single HTTP request
     */
    async makeRequest(method, path, data) {
        const url = `${this.config.url.replace(/\/$/, '')}${path}`;
        const timeout = this.config.timeout ?? 5000;
        // Prepare request config
        let requestConfig = {
            url,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.config.token,
                'User-Agent': 'serverless-redis-client/1.0.0',
                ...this.config.headers,
            },
            body: data ? JSON.stringify(data) : undefined,
        };
        // Apply compression header
        if (this.config.compression !== false) {
            requestConfig.headers['Accept-Encoding'] = 'gzip, deflate';
        }
        // Apply request interceptors
        for (const interceptor of this.requestInterceptors) {
            requestConfig = await interceptor(requestConfig);
        }
        // Create timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            // Make the request
            const response = await fetch(requestConfig.url, {
                method: requestConfig.method,
                headers: requestConfig.headers,
                body: requestConfig.body,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            // Parse response
            let responseData;
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                responseData = await response.json();
            }
            else {
                responseData = await response.text();
            }
            // Prepare response object
            const headerEntries = [];
            response.headers.forEach((value, key) => {
                headerEntries.push([key, value]);
            });
            let responseObj = {
                status: response.status,
                headers: Object.fromEntries(headerEntries),
                data: responseData,
            };
            // Apply response interceptors
            for (const interceptor of this.responseInterceptors) {
                responseObj = await interceptor(responseObj);
            }
            // Handle HTTP errors
            if (!response.ok) {
                throw createErrorFromResponse(responseObj.status, response.statusText, responseObj.data);
            }
            return responseObj.data;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new TimeoutError(timeout);
            }
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new ConnectionError(`Network error: ${error.message}`);
            }
            if (error instanceof ServerlessRedisError) {
                throw error;
            }
            throw new ConnectionError(`Request failed: ${error}`);
        }
    }
}
/**
 * Build URL with query parameters
 */
function buildUrl(base, params) {
    if (!params || Object.keys(params).length === 0) {
        return base;
    }
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    return url.toString();
}
/**
 * Validate configuration
 */
function validateConfig(config) {
    if (!config.url) {
        throw new Error('URL is required');
    }
    if (!config.token) {
        throw new Error('Token is required');
    }
    try {
        new URL(config.url);
    }
    catch {
        throw new Error('Invalid URL format');
    }
    if (config.timeout && (config.timeout < 0 || config.timeout > 300000)) {
        throw new Error('Timeout must be between 0 and 300000ms');
    }
    if (config.retries && (config.retries < 0 || config.retries > 10)) {
        throw new Error('Retries must be between 0 and 10');
    }
    if (config.retryDelay && (config.retryDelay < 0 || config.retryDelay > 10000)) {
        throw new Error('Retry delay must be between 0 and 10000ms');
    }
    if (config.db && (config.db < 0 || config.db > 15)) {
        throw new Error('Database must be between 0 and 15');
    }
}

/**
 * Pipeline builder for batching Redis commands
 */
class Pipeline {
    constructor(httpClient, db) {
        this.commands = [];
        this.httpClient = httpClient;
        this.db = db;
    }
    /**
     * Get the number of commands in the pipeline
     */
    get length() {
        return this.commands.length;
    }
    /**
     * Clear all commands from the pipeline
     */
    clear() {
        this.commands = [];
        return this;
    }
    /**
     * Add a raw command to the pipeline
     */
    command(command, ...args) {
        this.commands.push({
            command: command.toUpperCase(),
            args,
            db: this.db,
        });
        return this;
    }
    // String operations
    set(key, value, ...args) {
        return this.command('SET', key, value, ...args);
    }
    get(key) {
        return this.command('GET', key);
    }
    mget(...keys) {
        return this.command('MGET', ...keys);
    }
    mset(...keyValues) {
        return this.command('MSET', ...keyValues);
    }
    del(...keys) {
        return this.command('DEL', ...keys);
    }
    exists(...keys) {
        return this.command('EXISTS', ...keys);
    }
    expire(key, seconds) {
        return this.command('EXPIRE', key, seconds);
    }
    ttl(key) {
        return this.command('TTL', key);
    }
    // Numeric operations
    incr(key) {
        return this.command('INCR', key);
    }
    incrby(key, increment) {
        return this.command('INCRBY', key, increment);
    }
    decr(key) {
        return this.command('DECR', key);
    }
    decrby(key, decrement) {
        return this.command('DECRBY', key, decrement);
    }
    // Hash operations
    hset(key, ...fieldValues) {
        return this.command('HSET', key, ...fieldValues);
    }
    hget(key, field) {
        return this.command('HGET', key, field);
    }
    hmget(key, ...fields) {
        return this.command('HMGET', key, ...fields);
    }
    hgetall(key) {
        return this.command('HGETALL', key);
    }
    hdel(key, ...fields) {
        return this.command('HDEL', key, ...fields);
    }
    hexists(key, field) {
        return this.command('HEXISTS', key, field);
    }
    hlen(key) {
        return this.command('HLEN', key);
    }
    hkeys(key) {
        return this.command('HKEYS', key);
    }
    hvals(key) {
        return this.command('HVALS', key);
    }
    // List operations
    lpush(key, ...values) {
        return this.command('LPUSH', key, ...values);
    }
    rpush(key, ...values) {
        return this.command('RPUSH', key, ...values);
    }
    lpop(key, count) {
        return count !== undefined
            ? this.command('LPOP', key, count)
            : this.command('LPOP', key);
    }
    rpop(key, count) {
        return count !== undefined
            ? this.command('RPOP', key, count)
            : this.command('RPOP', key);
    }
    llen(key) {
        return this.command('LLEN', key);
    }
    lrange(key, start, stop) {
        return this.command('LRANGE', key, start, stop);
    }
    // Set operations
    sadd(key, ...members) {
        return this.command('SADD', key, ...members);
    }
    srem(key, ...members) {
        return this.command('SREM', key, ...members);
    }
    smembers(key) {
        return this.command('SMEMBERS', key);
    }
    scard(key) {
        return this.command('SCARD', key);
    }
    sismember(key, member) {
        return this.command('SISMEMBER', key, member);
    }
    // Sorted set operations
    zadd(key, ...scoreMembers) {
        return this.command('ZADD', key, ...scoreMembers);
    }
    zrem(key, ...members) {
        return this.command('ZREM', key, ...members);
    }
    zrange(key, start, stop, withScores) {
        return withScores
            ? this.command('ZRANGE', key, start, stop, 'WITHSCORES')
            : this.command('ZRANGE', key, start, stop);
    }
    zcard(key) {
        return this.command('ZCARD', key);
    }
    zscore(key, member) {
        return this.command('ZSCORE', key, member);
    }
    /**
     * Execute the pipeline
     */
    async exec() {
        if (this.commands.length === 0) {
            return [];
        }
        const request = {
            commands: [...this.commands],
        };
        try {
            const response = await this.httpClient.request('POST', '/v1/pipeline', request);
            // Clear commands after successful execution
            this.clear();
            // Extract results and check for errors
            const results = [];
            for (let i = 0; i < response.results.length; i++) {
                const result = response.results[i];
                if (result.error) {
                    throw new PipelineError(`Command ${i} failed: ${result.error}`, results, i);
                }
                results.push(result.result);
            }
            return results;
        }
        catch (error) {
            // Don't clear commands on error so they can be retried
            throw error;
        }
    }
    /**
     * Execute the pipeline and return detailed results
     */
    async execWithDetails() {
        if (this.commands.length === 0) {
            return {
                results: [],
                count: 0,
                time: 0,
            };
        }
        const request = {
            commands: [...this.commands],
        };
        const response = await this.httpClient.request('POST', '/v1/pipeline', request);
        // Clear commands after successful execution
        this.clear();
        return response;
    }
    /**
     * Get a copy of the current commands
     */
    getCommands() {
        return [...this.commands];
    }
    /**
     * Create a copy of this pipeline
     */
    clone() {
        const newPipeline = new Pipeline(this.httpClient, this.db);
        newPipeline.commands = [...this.commands];
        return newPipeline;
    }
}

/**
 * Main ServerlessRedis client class
 */
class ServerlessRedis {
    constructor(config) {
        validateConfig(config);
        this.config = { ...config };
        this.httpClient = new HttpClient(this.config);
    }
    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
        this.httpClient.addRequestInterceptor(interceptor);
    }
    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
        this.httpClient.addResponseInterceptor(interceptor);
    }
    /**
     * Execute a raw Redis command
     */
    async command(command, ...args) {
        const request = {
            command: command.toUpperCase(),
            args,
            db: this.config.db,
        };
        const response = await this.httpClient.request('POST', '/v1/command', request);
        if (response.error) {
            throw new RedisError(response.error, command);
        }
        return parseValue(response.result, response.type);
    }
    // String operations
    async set(key, value, ...options) {
        const result = await this.command('SET', key, serializeValue(value), ...options);
        return result;
    }
    async get(key) {
        const result = await this.command('GET', key);
        return result;
    }
    async mget(...keys) {
        const result = await this.command('MGET', ...keys);
        return result;
    }
    async mset(...keyValues) {
        if (keyValues.length % 2 !== 0) {
            throw new ValidationError('MSET requires an even number of arguments');
        }
        const serialized = keyValues.map((kv, i) => i % 2 === 1 ? serializeValue(kv) : kv);
        const result = await this.command('MSET', ...serialized);
        return result;
    }
    async del(...keys) {
        const result = await this.command('DEL', ...keys);
        return result;
    }
    async exists(...keys) {
        const result = await this.command('EXISTS', ...keys);
        return result;
    }
    async expire(key, seconds) {
        const result = await this.command('EXPIRE', key, seconds);
        return result;
    }
    async ttl(key) {
        const result = await this.command('TTL', key);
        return result;
    }
    // Numeric operations
    async incr(key) {
        const result = await this.command('INCR', key);
        return result;
    }
    async incrby(key, increment) {
        const result = await this.command('INCRBY', key, increment);
        return result;
    }
    async decr(key) {
        const result = await this.command('DECR', key);
        return result;
    }
    async decrby(key, decrement) {
        const result = await this.command('DECRBY', key, decrement);
        return result;
    }
    // Hash operations
    async hset(key, ...fieldValues) {
        if (fieldValues.length % 2 !== 0) {
            throw new ValidationError('HSET requires an even number of field-value arguments');
        }
        const serialized = fieldValues.map((fv, i) => i % 2 === 1 ? serializeValue(fv) : fv);
        const result = await this.command('HSET', key, ...serialized);
        return result;
    }
    async hget(key, field) {
        const result = await this.command('HGET', key, field);
        return result;
    }
    async hmget(key, ...fields) {
        const result = await this.command('HMGET', key, ...fields);
        return result;
    }
    async hgetall(key) {
        const result = await this.command('HGETALL', key);
        return result;
    }
    async hdel(key, ...fields) {
        const result = await this.command('HDEL', key, ...fields);
        return result;
    }
    async hexists(key, field) {
        const result = await this.command('HEXISTS', key, field);
        return result;
    }
    async hlen(key) {
        const result = await this.command('HLEN', key);
        return result;
    }
    async hkeys(key) {
        const result = await this.command('HKEYS', key);
        return result;
    }
    async hvals(key) {
        const result = await this.command('HVALS', key);
        return result;
    }
    // List operations
    async lpush(key, ...values) {
        const serialized = values.map(serializeValue);
        const result = await this.command('LPUSH', key, ...serialized);
        return result;
    }
    async rpush(key, ...values) {
        const serialized = values.map(serializeValue);
        const result = await this.command('RPUSH', key, ...serialized);
        return result;
    }
    async lpop(key, count) {
        const result = count !== undefined
            ? await this.command('LPOP', key, count)
            : await this.command('LPOP', key);
        return result;
    }
    async rpop(key, count) {
        const result = count !== undefined
            ? await this.command('RPOP', key, count)
            : await this.command('RPOP', key);
        return result;
    }
    async llen(key) {
        const result = await this.command('LLEN', key);
        return result;
    }
    async lrange(key, start, stop) {
        const result = await this.command('LRANGE', key, start, stop);
        return result;
    }
    // Set operations
    async sadd(key, ...members) {
        const serialized = members.map(serializeValue);
        const result = await this.command('SADD', key, ...serialized);
        return result;
    }
    async srem(key, ...members) {
        const serialized = members.map(serializeValue);
        const result = await this.command('SREM', key, ...serialized);
        return result;
    }
    async smembers(key) {
        const result = await this.command('SMEMBERS', key);
        return result;
    }
    async scard(key) {
        const result = await this.command('SCARD', key);
        return result;
    }
    async sismember(key, member) {
        const result = await this.command('SISMEMBER', key, serializeValue(member));
        return result;
    }
    // Sorted set operations
    async zadd(key, ...scoreMembers) {
        if (scoreMembers.length % 2 !== 0) {
            throw new ValidationError('ZADD requires an even number of score-member arguments');
        }
        const serialized = scoreMembers.map((sm, i) => i % 2 === 1 ? serializeValue(sm) : sm);
        const result = await this.command('ZADD', key, ...serialized);
        return result;
    }
    async zrem(key, ...members) {
        const serialized = members.map(serializeValue);
        const result = await this.command('ZREM', key, ...serialized);
        return result;
    }
    async zrange(key, start, stop, withScores) {
        const result = withScores
            ? await this.command('ZRANGE', key, start, stop, 'WITHSCORES')
            : await this.command('ZRANGE', key, start, stop);
        return result;
    }
    async zcard(key) {
        const result = await this.command('ZCARD', key);
        return result;
    }
    async zscore(key, member) {
        const result = await this.command('ZSCORE', key, serializeValue(member));
        return result;
    }
    // Pipeline operations
    pipeline() {
        return new Pipeline(this.httpClient, this.config.db);
    }
    // Transaction operations
    multi() {
        return new Transaction(this.httpClient, this.config.db);
    }
    // Health check
    async ping() {
        const result = await this.command('PING');
        return result;
    }
    async health() {
        return this.httpClient.request('GET', '/health');
    }
    // Configuration
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config) {
        const newConfig = { ...this.config, ...config };
        validateConfig(newConfig);
        this.config = newConfig;
        this.httpClient = new HttpClient(this.config);
    }
}
/**
 * Transaction builder class
 */
class Transaction {
    constructor(httpClient, db) {
        this.commands = [];
        this.httpClient = httpClient;
        this.db = db;
    }
    /**
     * Add a command to the transaction
     */
    command(command, ...args) {
        this.commands.push({
            command: command.toUpperCase(),
            args,
            db: this.db,
        });
        return this;
    }
    // Add all the same methods as Pipeline for consistency
    set(key, value, ...args) {
        return this.command('SET', key, serializeValue(value), ...args);
    }
    get(key) {
        return this.command('GET', key);
    }
    incr(key) {
        return this.command('INCR', key);
    }
    // ... (add more methods as needed)
    /**
     * Execute the transaction
     */
    async exec() {
        if (this.commands.length === 0) {
            return [];
        }
        const request = {
            commands: [...this.commands],
        };
        try {
            const response = await this.httpClient.request('POST', '/v1/transaction', request);
            if (!response.exec) {
                throw new TransactionError('Transaction was discarded');
            }
            // Clear commands after successful execution
            this.commands = [];
            // Extract results
            return response.results.map(result => {
                if (result.error) {
                    throw new RedisError(result.error);
                }
                return parseValue(result.result, result.type);
            });
        }
        catch (error) {
            // Don't clear commands on error so they can be retried
            throw error;
        }
    }
    /**
     * Discard the transaction
     */
    discard() {
        this.commands = [];
    }
    /**
     * Get the number of commands in the transaction
     */
    get length() {
        return this.commands.length;
    }
}

export { AuthenticationError, ConnectionError, HttpClient, Pipeline, PipelineError, RateLimitError, RedisError, ServerlessRedis, ServerlessRedisError, TimeoutError, Transaction, TransactionError, ValidationError, buildUrl, calculateBackoffDelay, createErrorFromResponse, ServerlessRedis as default, isRetryableError, parseValue, serializeValue, sleep, validateConfig, validateKey };
//# sourceMappingURL=index.esm.js.map
