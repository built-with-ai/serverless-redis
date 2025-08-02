import { CommandRequest, PipelineResponse, RedisValue, RedisKey } from './types';
import { HttpClient } from './utils';
/**
 * Pipeline builder for batching Redis commands
 */
export declare class Pipeline {
    private commands;
    private httpClient;
    private db?;
    constructor(httpClient: HttpClient, db?: number);
    /**
     * Get the number of commands in the pipeline
     */
    get length(): number;
    /**
     * Clear all commands from the pipeline
     */
    clear(): this;
    /**
     * Add a raw command to the pipeline
     */
    command(command: string, ...args: unknown[]): this;
    set(key: RedisKey, value: RedisValue, ...args: unknown[]): this;
    get(key: RedisKey): this;
    mget(...keys: RedisKey[]): this;
    mset(...keyValues: (RedisKey | RedisValue)[]): this;
    del(...keys: RedisKey[]): this;
    exists(...keys: RedisKey[]): this;
    expire(key: RedisKey, seconds: number): this;
    ttl(key: RedisKey): this;
    incr(key: RedisKey): this;
    incrby(key: RedisKey, increment: number): this;
    decr(key: RedisKey): this;
    decrby(key: RedisKey, decrement: number): this;
    hset(key: RedisKey, ...fieldValues: (string | RedisValue)[]): this;
    hget(key: RedisKey, field: string): this;
    hmget(key: RedisKey, ...fields: string[]): this;
    hgetall(key: RedisKey): this;
    hdel(key: RedisKey, ...fields: string[]): this;
    hexists(key: RedisKey, field: string): this;
    hlen(key: RedisKey): this;
    hkeys(key: RedisKey): this;
    hvals(key: RedisKey): this;
    lpush(key: RedisKey, ...values: RedisValue[]): this;
    rpush(key: RedisKey, ...values: RedisValue[]): this;
    lpop(key: RedisKey, count?: number): this;
    rpop(key: RedisKey, count?: number): this;
    llen(key: RedisKey): this;
    lrange(key: RedisKey, start: number, stop: number): this;
    sadd(key: RedisKey, ...members: RedisValue[]): this;
    srem(key: RedisKey, ...members: RedisValue[]): this;
    smembers(key: RedisKey): this;
    scard(key: RedisKey): this;
    sismember(key: RedisKey, member: RedisValue): this;
    zadd(key: RedisKey, ...scoreMembers: (number | RedisValue)[]): this;
    zrem(key: RedisKey, ...members: RedisValue[]): this;
    zrange(key: RedisKey, start: number, stop: number, withScores?: boolean): this;
    zcard(key: RedisKey): this;
    zscore(key: RedisKey, member: RedisValue): this;
    /**
     * Execute the pipeline
     */
    exec(): Promise<unknown[]>;
    /**
     * Execute the pipeline and return detailed results
     */
    execWithDetails(): Promise<PipelineResponse>;
    /**
     * Get a copy of the current commands
     */
    getCommands(): CommandRequest[];
    /**
     * Create a copy of this pipeline
     */
    clone(): Pipeline;
}
//# sourceMappingURL=pipeline.d.ts.map