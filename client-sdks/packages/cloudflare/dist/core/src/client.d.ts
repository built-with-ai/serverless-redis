import { ServerlessRedisConfig, HealthResponse, RedisValue, RedisKey, RequestInterceptor, ResponseInterceptor } from './types';
import { HttpClient } from './utils';
import { Pipeline } from './pipeline';
/**
 * Main ServerlessRedis client class
 */
export declare class ServerlessRedis {
    private httpClient;
    private config;
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
     * Execute a raw Redis command
     */
    command(command: string, ...args: unknown[]): Promise<unknown>;
    set(key: RedisKey, value: RedisValue, ...options: unknown[]): Promise<string>;
    get(key: RedisKey): Promise<string | null>;
    mget(...keys: RedisKey[]): Promise<(string | null)[]>;
    mset(...keyValues: (RedisKey | RedisValue)[]): Promise<string>;
    del(...keys: RedisKey[]): Promise<number>;
    exists(...keys: RedisKey[]): Promise<number>;
    expire(key: RedisKey, seconds: number): Promise<number>;
    ttl(key: RedisKey): Promise<number>;
    incr(key: RedisKey): Promise<number>;
    incrby(key: RedisKey, increment: number): Promise<number>;
    decr(key: RedisKey): Promise<number>;
    decrby(key: RedisKey, decrement: number): Promise<number>;
    hset(key: RedisKey, ...fieldValues: (string | RedisValue)[]): Promise<number>;
    hget(key: RedisKey, field: string): Promise<string | null>;
    hmget(key: RedisKey, ...fields: string[]): Promise<(string | null)[]>;
    hgetall(key: RedisKey): Promise<Record<string, string>>;
    hdel(key: RedisKey, ...fields: string[]): Promise<number>;
    hexists(key: RedisKey, field: string): Promise<number>;
    hlen(key: RedisKey): Promise<number>;
    hkeys(key: RedisKey): Promise<string[]>;
    hvals(key: RedisKey): Promise<string[]>;
    lpush(key: RedisKey, ...values: RedisValue[]): Promise<number>;
    rpush(key: RedisKey, ...values: RedisValue[]): Promise<number>;
    lpop(key: RedisKey, count?: number): Promise<string | string[] | null>;
    rpop(key: RedisKey, count?: number): Promise<string | string[] | null>;
    llen(key: RedisKey): Promise<number>;
    lrange(key: RedisKey, start: number, stop: number): Promise<string[]>;
    sadd(key: RedisKey, ...members: RedisValue[]): Promise<number>;
    srem(key: RedisKey, ...members: RedisValue[]): Promise<number>;
    smembers(key: RedisKey): Promise<string[]>;
    scard(key: RedisKey): Promise<number>;
    sismember(key: RedisKey, member: RedisValue): Promise<number>;
    zadd(key: RedisKey, ...scoreMembers: (number | RedisValue)[]): Promise<number>;
    zrem(key: RedisKey, ...members: RedisValue[]): Promise<number>;
    zrange(key: RedisKey, start: number, stop: number, withScores?: boolean): Promise<string[]>;
    zcard(key: RedisKey): Promise<number>;
    zscore(key: RedisKey, member: RedisValue): Promise<string | null>;
    pipeline(): Pipeline;
    multi(): Transaction;
    ping(): Promise<string>;
    health(): Promise<HealthResponse>;
    getConfig(): Readonly<ServerlessRedisConfig>;
    updateConfig(config: Partial<ServerlessRedisConfig>): void;
}
/**
 * Transaction builder class
 */
export declare class Transaction {
    private commands;
    private httpClient;
    private db?;
    constructor(httpClient: HttpClient, db?: number);
    /**
     * Add a command to the transaction
     */
    command(command: string, ...args: unknown[]): this;
    set(key: RedisKey, value: RedisValue, ...args: unknown[]): this;
    get(key: RedisKey): this;
    incr(key: RedisKey): this;
    /**
     * Execute the transaction
     */
    exec(): Promise<unknown[]>;
    /**
     * Discard the transaction
     */
    discard(): void;
    /**
     * Get the number of commands in the transaction
     */
    get length(): number;
}
//# sourceMappingURL=client.d.ts.map