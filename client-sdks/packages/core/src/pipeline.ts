import {
  CommandRequest,
  PipelineRequest,
  PipelineResponse,
  RedisValue,
  RedisKey,
} from './types';
import { HttpClient } from './utils';
import { PipelineError } from './errors';

/**
 * Pipeline builder for batching Redis commands
 */
export class Pipeline {
  private commands: CommandRequest[] = [];
  private httpClient: HttpClient;
  private db?: number;

  constructor(httpClient: HttpClient, db?: number) {
    this.httpClient = httpClient;
    this.db = db;
  }

  /**
   * Get the number of commands in the pipeline
   */
  get length(): number {
    return this.commands.length;
  }

  /**
   * Clear all commands from the pipeline
   */
  clear(): this {
    this.commands = [];
    return this;
  }

  /**
   * Add a raw command to the pipeline
   */
  command(command: string, ...args: unknown[]): this {
    this.commands.push({
      command: command.toUpperCase(),
      args,
      db: this.db,
    });
    return this;
  }

  // String operations
  set(key: RedisKey, value: RedisValue, ...args: unknown[]): this {
    return this.command('SET', key, value, ...args);
  }

  get(key: RedisKey): this {
    return this.command('GET', key);
  }

  mget(...keys: RedisKey[]): this {
    return this.command('MGET', ...keys);
  }

  mset(...keyValues: (RedisKey | RedisValue)[]): this {
    return this.command('MSET', ...keyValues);
  }

  del(...keys: RedisKey[]): this {
    return this.command('DEL', ...keys);
  }

  exists(...keys: RedisKey[]): this {
    return this.command('EXISTS', ...keys);
  }

  expire(key: RedisKey, seconds: number): this {
    return this.command('EXPIRE', key, seconds);
  }

  ttl(key: RedisKey): this {
    return this.command('TTL', key);
  }

  // Numeric operations
  incr(key: RedisKey): this {
    return this.command('INCR', key);
  }

  incrby(key: RedisKey, increment: number): this {
    return this.command('INCRBY', key, increment);
  }

  decr(key: RedisKey): this {
    return this.command('DECR', key);
  }

  decrby(key: RedisKey, decrement: number): this {
    return this.command('DECRBY', key, decrement);
  }

  // Hash operations
  hset(key: RedisKey, ...fieldValues: (string | RedisValue)[]): this {
    return this.command('HSET', key, ...fieldValues);
  }

  hget(key: RedisKey, field: string): this {
    return this.command('HGET', key, field);
  }

  hmget(key: RedisKey, ...fields: string[]): this {
    return this.command('HMGET', key, ...fields);
  }

  hgetall(key: RedisKey): this {
    return this.command('HGETALL', key);
  }

  hdel(key: RedisKey, ...fields: string[]): this {
    return this.command('HDEL', key, ...fields);
  }

  hexists(key: RedisKey, field: string): this {
    return this.command('HEXISTS', key, field);
  }

  hlen(key: RedisKey): this {
    return this.command('HLEN', key);
  }

  hkeys(key: RedisKey): this {
    return this.command('HKEYS', key);
  }

  hvals(key: RedisKey): this {
    return this.command('HVALS', key);
  }

  // List operations
  lpush(key: RedisKey, ...values: RedisValue[]): this {
    return this.command('LPUSH', key, ...values);
  }

  rpush(key: RedisKey, ...values: RedisValue[]): this {
    return this.command('RPUSH', key, ...values);
  }

  lpop(key: RedisKey, count?: number): this {
    return count !== undefined 
      ? this.command('LPOP', key, count)
      : this.command('LPOP', key);
  }

  rpop(key: RedisKey, count?: number): this {
    return count !== undefined
      ? this.command('RPOP', key, count)
      : this.command('RPOP', key);
  }

  llen(key: RedisKey): this {
    return this.command('LLEN', key);
  }

  lrange(key: RedisKey, start: number, stop: number): this {
    return this.command('LRANGE', key, start, stop);
  }

  // Set operations
  sadd(key: RedisKey, ...members: RedisValue[]): this {
    return this.command('SADD', key, ...members);
  }

  srem(key: RedisKey, ...members: RedisValue[]): this {
    return this.command('SREM', key, ...members);
  }

  smembers(key: RedisKey): this {
    return this.command('SMEMBERS', key);
  }

  scard(key: RedisKey): this {
    return this.command('SCARD', key);
  }

  sismember(key: RedisKey, member: RedisValue): this {
    return this.command('SISMEMBER', key, member);
  }

  // Sorted set operations
  zadd(key: RedisKey, ...scoreMembers: (number | RedisValue)[]): this {
    return this.command('ZADD', key, ...scoreMembers);
  }

  zrem(key: RedisKey, ...members: RedisValue[]): this {
    return this.command('ZREM', key, ...members);
  }

  zrange(key: RedisKey, start: number, stop: number, withScores?: boolean): this {
    return withScores
      ? this.command('ZRANGE', key, start, stop, 'WITHSCORES')
      : this.command('ZRANGE', key, start, stop);
  }

  zcard(key: RedisKey): this {
    return this.command('ZCARD', key);
  }

  zscore(key: RedisKey, member: RedisValue): this {
    return this.command('ZSCORE', key, member);
  }

  /**
   * Execute the pipeline
   */
  async exec(): Promise<unknown[]> {
    if (this.commands.length === 0) {
      return [];
    }

    const request: PipelineRequest = {
      commands: [...this.commands],
    };

    try {
      const response = await this.httpClient.request<PipelineResponse>(
        'POST',
        '/v1/pipeline',
        request
      );

      // Clear commands after successful execution
      this.clear();

      // Extract results and check for errors
      const results: unknown[] = [];
      for (let i = 0; i < response.results.length; i++) {
        const result = response.results[i];
        if (result.error) {
          throw new PipelineError(
            `Command ${i} failed: ${result.error}`,
            results,
            i
          );
        }
        results.push(result.result);
      }

      return results;
    } catch (error) {
      // Don't clear commands on error so they can be retried
      throw error;
    }
  }

  /**
   * Execute the pipeline and return detailed results
   */
  async execWithDetails(): Promise<PipelineResponse> {
    if (this.commands.length === 0) {
      return {
        results: [],
        count: 0,
        time: 0,
      };
    }

    const request: PipelineRequest = {
      commands: [...this.commands],
    };

    const response = await this.httpClient.request<PipelineResponse>(
      'POST',
      '/v1/pipeline',
      request
    );

    // Clear commands after successful execution
    this.clear();

    return response;
  }

  /**
   * Get a copy of the current commands
   */
  getCommands(): CommandRequest[] {
    return [...this.commands];
  }

  /**
   * Discard the pipeline (clear all commands)
   */
  discard(): void {
    this.clear();
  }

  /**
   * Create a copy of this pipeline
   */
  clone(): Pipeline {
    const newPipeline = new Pipeline(this.httpClient, this.db);
    newPipeline.commands = [...this.commands];
    return newPipeline;
  }
}