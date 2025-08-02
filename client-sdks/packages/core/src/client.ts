import {
  ServerlessRedisConfig,
  CommandRequest,
  CommandResponse,
  TransactionRequest,
  TransactionResponse,
  HealthResponse,
  RedisValue,
  RedisKey,
  RequestInterceptor,
  ResponseInterceptor,
} from './types';
import { HttpClient, validateConfig, serializeValue, parseValue } from './utils';
import { Pipeline } from './pipeline';
import { RedisError, TransactionError, ValidationError } from './errors';

/**
 * Main ServerlessRedis client class
 */
export class ServerlessRedis {
  private httpClient: HttpClient;
  private config: ServerlessRedisConfig;

  constructor(config: ServerlessRedisConfig) {
    validateConfig(config);
    this.config = { ...config };
    this.httpClient = new HttpClient(this.config);
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.httpClient.addRequestInterceptor(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.httpClient.addResponseInterceptor(interceptor);
  }

  /**
   * Execute a raw Redis command
   */
  async command(command: string, ...args: unknown[]): Promise<unknown> {
    const request: CommandRequest = {
      command: command.toUpperCase(),
      args,
      db: this.config.db,
    };

    const response = await this.httpClient.request<CommandResponse>(
      'POST',
      '/v1/command',
      request
    );

    if (response.error) {
      throw new RedisError(response.error, command);
    }

    return parseValue(response.result, response.type);
  }

  // String operations
  async set(key: RedisKey, value: RedisValue, ...options: unknown[]): Promise<string> {
    const result = await this.command('SET', key, serializeValue(value), ...options);
    return result as string;
  }

  async get(key: RedisKey): Promise<string | null> {
    const result = await this.command('GET', key);
    return result as string | null;
  }

  async mget(...keys: RedisKey[]): Promise<(string | null)[]> {
    const result = await this.command('MGET', ...keys);
    return result as (string | null)[];
  }

  async mset(...keyValues: (RedisKey | RedisValue)[]): Promise<string> {
    if (keyValues.length % 2 !== 0) {
      throw new ValidationError('MSET requires an even number of arguments');
    }
    const serialized = keyValues.map((kv, i) => i % 2 === 1 ? serializeValue(kv) : kv);
    const result = await this.command('MSET', ...serialized);
    return result as string;
  }

  async del(...keys: RedisKey[]): Promise<number> {
    const result = await this.command('DEL', ...keys);
    return result as number;
  }

  async exists(...keys: RedisKey[]): Promise<number> {
    const result = await this.command('EXISTS', ...keys);
    return result as number;
  }

  async expire(key: RedisKey, seconds: number): Promise<number> {
    const result = await this.command('EXPIRE', key, seconds);
    return result as number;
  }

  async ttl(key: RedisKey): Promise<number> {
    const result = await this.command('TTL', key);
    return result as number;
  }

  // Numeric operations
  async incr(key: RedisKey): Promise<number> {
    const result = await this.command('INCR', key);
    return result as number;
  }

  async incrby(key: RedisKey, increment: number): Promise<number> {
    const result = await this.command('INCRBY', key, increment);
    return result as number;
  }

  async decr(key: RedisKey): Promise<number> {
    const result = await this.command('DECR', key);
    return result as number;
  }

  async decrby(key: RedisKey, decrement: number): Promise<number> {
    const result = await this.command('DECRBY', key, decrement);
    return result as number;
  }

  // Hash operations
  async hset(key: RedisKey, ...fieldValues: (string | RedisValue)[]): Promise<number> {
    if (fieldValues.length % 2 !== 0) {
      throw new ValidationError('HSET requires an even number of field-value arguments');
    }
    const serialized = fieldValues.map((fv, i) => i % 2 === 1 ? serializeValue(fv) : fv);
    const result = await this.command('HSET', key, ...serialized);
    return result as number;
  }

  async hget(key: RedisKey, field: string): Promise<string | null> {
    const result = await this.command('HGET', key, field);
    return result as string | null;
  }

  async hmget(key: RedisKey, ...fields: string[]): Promise<(string | null)[]> {
    const result = await this.command('HMGET', key, ...fields);
    return result as (string | null)[];
  }

  async hgetall(key: RedisKey): Promise<Record<string, string>> {
    const result = await this.command('HGETALL', key);
    return result as Record<string, string>;
  }

  async hdel(key: RedisKey, ...fields: string[]): Promise<number> {
    const result = await this.command('HDEL', key, ...fields);
    return result as number;
  }

  async hexists(key: RedisKey, field: string): Promise<number> {
    const result = await this.command('HEXISTS', key, field);
    return result as number;
  }

  async hlen(key: RedisKey): Promise<number> {
    const result = await this.command('HLEN', key);
    return result as number;
  }

  async hkeys(key: RedisKey): Promise<string[]> {
    const result = await this.command('HKEYS', key);
    return result as string[];
  }

  async hvals(key: RedisKey): Promise<string[]> {
    const result = await this.command('HVALS', key);
    return result as string[];
  }

  // List operations
  async lpush(key: RedisKey, ...values: RedisValue[]): Promise<number> {
    const serialized = values.map(serializeValue);
    const result = await this.command('LPUSH', key, ...serialized);
    return result as number;
  }

  async rpush(key: RedisKey, ...values: RedisValue[]): Promise<number> {
    const serialized = values.map(serializeValue);
    const result = await this.command('RPUSH', key, ...serialized);
    return result as number;
  }

  async lpop(key: RedisKey, count?: number): Promise<string | string[] | null> {
    const result = count !== undefined
      ? await this.command('LPOP', key, count)
      : await this.command('LPOP', key);
    return result as string | string[] | null;
  }

  async rpop(key: RedisKey, count?: number): Promise<string | string[] | null> {
    const result = count !== undefined
      ? await this.command('RPOP', key, count)
      : await this.command('RPOP', key);
    return result as string | string[] | null;
  }

  async llen(key: RedisKey): Promise<number> {
    const result = await this.command('LLEN', key);
    return result as number;
  }

  async lrange(key: RedisKey, start: number, stop: number): Promise<string[]> {
    const result = await this.command('LRANGE', key, start, stop);
    return result as string[];
  }

  // Set operations
  async sadd(key: RedisKey, ...members: RedisValue[]): Promise<number> {
    const serialized = members.map(serializeValue);
    const result = await this.command('SADD', key, ...serialized);
    return result as number;
  }

  async srem(key: RedisKey, ...members: RedisValue[]): Promise<number> {
    const serialized = members.map(serializeValue);
    const result = await this.command('SREM', key, ...serialized);
    return result as number;
  }

  async smembers(key: RedisKey): Promise<string[]> {
    const result = await this.command('SMEMBERS', key);
    return result as string[];
  }

  async scard(key: RedisKey): Promise<number> {
    const result = await this.command('SCARD', key);
    return result as number;
  }

  async sismember(key: RedisKey, member: RedisValue): Promise<number> {
    const result = await this.command('SISMEMBER', key, serializeValue(member));
    return result as number;
  }

  // Sorted set operations
  async zadd(key: RedisKey, ...scoreMembers: (number | RedisValue)[]): Promise<number> {
    if (scoreMembers.length % 2 !== 0) {
      throw new ValidationError('ZADD requires an even number of score-member arguments');
    }
    const serialized = scoreMembers.map((sm, i) => i % 2 === 1 ? serializeValue(sm) : sm);
    const result = await this.command('ZADD', key, ...serialized);
    return result as number;
  }

  async zrem(key: RedisKey, ...members: RedisValue[]): Promise<number> {
    const serialized = members.map(serializeValue);
    const result = await this.command('ZREM', key, ...serialized);
    return result as number;
  }

  async zrange(key: RedisKey, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    const result = withScores
      ? await this.command('ZRANGE', key, start, stop, 'WITHSCORES')
      : await this.command('ZRANGE', key, start, stop);
    return result as string[];
  }

  async zcard(key: RedisKey): Promise<number> {
    const result = await this.command('ZCARD', key);
    return result as number;
  }

  async zscore(key: RedisKey, member: RedisValue): Promise<string | null> {
    const result = await this.command('ZSCORE', key, serializeValue(member));
    return result as string | null;
  }

  // Pipeline operations
  pipeline(): Pipeline {
    return new Pipeline(this.httpClient, this.config.db);
  }

  // Transaction operations
  multi(): Transaction {
    return new Transaction(this.httpClient, this.config.db);
  }

  // Health check
  async ping(): Promise<string> {
    const result = await this.command('PING');
    return result as string;
  }

  async health(): Promise<HealthResponse> {
    return this.httpClient.request<HealthResponse>('GET', '/health');
  }

  // Configuration
  getConfig(): Readonly<ServerlessRedisConfig> {
    return { ...this.config };
  }

  updateConfig(config: Partial<ServerlessRedisConfig>): void {
    const newConfig = { ...this.config, ...config };
    validateConfig(newConfig);
    this.config = newConfig;
    this.httpClient = new HttpClient(this.config);
  }
}

/**
 * Transaction builder class
 */
export class Transaction {
  private commands: CommandRequest[] = [];
  private httpClient: HttpClient;
  private db?: number;

  constructor(httpClient: HttpClient, db?: number) {
    this.httpClient = httpClient;
    this.db = db;
  }

  /**
   * Add a command to the transaction
   */
  command(command: string, ...args: unknown[]): this {
    this.commands.push({
      command: command.toUpperCase(),
      args,
      db: this.db,
    });
    return this;
  }

  // Add all the same methods as Pipeline for consistency
  set(key: RedisKey, value: RedisValue, ...args: unknown[]): this {
    return this.command('SET', key, serializeValue(value), ...args);
  }

  get(key: RedisKey): this {
    return this.command('GET', key);
  }

  incr(key: RedisKey): this {
    return this.command('INCR', key);
  }

  // ... (add more methods as needed)

  /**
   * Execute the transaction
   */
  async exec(): Promise<unknown[]> {
    if (this.commands.length === 0) {
      return [];
    }

    const request: TransactionRequest = {
      commands: [...this.commands],
    };

    try {
      const response = await this.httpClient.request<TransactionResponse>(
        'POST',
        '/v1/transaction',
        request
      );

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
    } catch (error) {
      // Don't clear commands on error so they can be retried
      throw error;
    }
  }

  /**
   * Discard the transaction
   */
  discard(): void {
    this.commands = [];
  }

  /**
   * Get the number of commands in the transaction
   */
  get length(): number {
    return this.commands.length;
  }
}