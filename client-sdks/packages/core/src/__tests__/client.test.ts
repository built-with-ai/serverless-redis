import { ServerlessRedis } from '../client';
import { HttpClient } from '../utils';
import { RedisError, ValidationError } from '../errors';

// Mock the HttpClient
jest.mock('../utils', () => ({
  HttpClient: jest.fn(),
  validateConfig: jest.fn(),
  serializeValue: jest.fn((val) => val),
  parseValue: jest.fn((val) => val),
}));

describe('ServerlessRedis Client', () => {
  let redis: ServerlessRedis;
  let mockHttpClient: jest.Mocked<HttpClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock HttpClient instance
    mockHttpClient = {
      request: jest.fn(),
      addRequestInterceptor: jest.fn(),
      addResponseInterceptor: jest.fn(),
    } as any;

    // Mock HttpClient constructor
    (HttpClient as jest.MockedClass<typeof HttpClient>).mockImplementation(() => mockHttpClient);

    // Create Redis client instance
    redis = new ServerlessRedis({
      url: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(redis).toBeInstanceOf(ServerlessRedis);
      expect(HttpClient).toHaveBeenCalledWith({
        url: 'http://localhost:8080',
        token: 'test-token',
      });
    });
  });

  describe('command method', () => {
    it('should execute raw Redis command', async () => {
      const mockResponse = {
        result: 'OK',
        type: 'string',
        error: null,
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await redis.command('SET', 'key', 'value');

      expect(mockHttpClient.request).toHaveBeenCalledWith('POST', '/v1/command', {
        command: 'SET',
        args: ['key', 'value'],
        db: undefined,
      });
      expect(result).toBe('OK');
    });

    it('should throw RedisError when command fails', async () => {
      const mockResponse = {
        result: null,
        type: null,
        error: 'Command failed',
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      await expect(redis.command('INVALID')).rejects.toThrow(RedisError);
    });
  });

  describe('string operations', () => {
    it('should set and get values', async () => {
      // Test SET
      mockHttpClient.request.mockResolvedValue({ result: 'OK', type: 'string', error: null });
      const setResult = await redis.set('test-key', 'test-value');
      expect(setResult).toBe('OK');

      // Test GET
      mockHttpClient.request.mockResolvedValue({ result: 'test-value', type: 'string', error: null });
      const getValue = await redis.get('test-key');
      expect(getValue).toBe('test-value');
    });

    it('should handle null values', async () => {
      mockHttpClient.request.mockResolvedValue({ result: null, type: 'null', error: null });
      const result = await redis.get('non-existent');
      expect(result).toBeNull();
    });

    it('should support SET with options', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 'OK', type: 'string', error: null });
      
      await redis.set('key', 'value', 'EX', 60);
      
      expect(mockHttpClient.request).toHaveBeenCalledWith('POST', '/v1/command', {
        command: 'SET',
        args: ['key', 'value', 'EX', 60],
        db: undefined,
      });
    });

    it('should support MGET operation', async () => {
      mockHttpClient.request.mockResolvedValue({ 
        result: ['value1', 'value2', null], 
        type: 'array', 
        error: null 
      });
      
      const result = await redis.mget('key1', 'key2', 'key3');
      expect(result).toEqual(['value1', 'value2', null]);
    });

    it('should support MSET operation', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 'OK', type: 'string', error: null });
      
      await redis.mset('key1', 'value1', 'key2', 'value2');
      
      expect(mockHttpClient.request).toHaveBeenCalledWith('POST', '/v1/command', {
        command: 'MSET',
        args: ['key1', 'value1', 'key2', 'value2'],
        db: undefined,
      });
    });

    it('should validate MSET arguments', async () => {
      await expect(redis.mset('key1', 'value1', 'key2')).rejects.toThrow(ValidationError);
    });
  });

  describe('numeric operations', () => {
    it('should increment values', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 1, type: 'integer', error: null });
      
      const result = await redis.incr('counter');
      expect(result).toBe(1);
      
      expect(mockHttpClient.request).toHaveBeenCalledWith('POST', '/v1/command', {
        command: 'INCR',
        args: ['counter'],
        db: undefined,
      });
    });

    it('should increment by amount', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 10, type: 'integer', error: null });
      
      const result = await redis.incrby('counter', 5);
      expect(result).toBe(10);
    });

    it('should decrement values', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 9, type: 'integer', error: null });
      
      const result = await redis.decr('counter');
      expect(result).toBe(9);
    });
  });

  describe('hash operations', () => {
    it('should set hash fields', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 2, type: 'integer', error: null });
      
      const result = await redis.hset('user:123', 'name', 'John', 'age', '30');
      expect(result).toBe(2);
    });

    it('should validate HSET arguments', async () => {
      await expect(redis.hset('key', 'field')).rejects.toThrow(ValidationError);
    });

    it('should get hash field', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 'John', type: 'string', error: null });
      
      const result = await redis.hget('user:123', 'name');
      expect(result).toBe('John');
    });

    it('should get multiple hash fields', async () => {
      mockHttpClient.request.mockResolvedValue({ 
        result: ['John', '30'], 
        type: 'array', 
        error: null 
      });
      
      const result = await redis.hmget('user:123', 'name', 'age');
      expect(result).toEqual(['John', '30']);
    });

    it('should get all hash fields', async () => {
      mockHttpClient.request.mockResolvedValue({ 
        result: { name: 'John', age: '30' }, 
        type: 'hash', 
        error: null 
      });
      
      const result = await redis.hgetall('user:123');
      expect(result).toEqual({ name: 'John', age: '30' });
    });
  });

  describe('list operations', () => {
    it('should push to list', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 2, type: 'integer', error: null });
      
      const result = await redis.lpush('list', 'item1', 'item2');
      expect(result).toBe(2);
    });

    it('should pop from list', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 'item1', type: 'string', error: null });
      
      const result = await redis.lpop('list');
      expect(result).toBe('item1');
    });

    it('should pop multiple items', async () => {
      mockHttpClient.request.mockResolvedValue({ 
        result: ['item1', 'item2'], 
        type: 'array', 
        error: null 
      });
      
      const result = await redis.lpop('list', 2);
      expect(result).toEqual(['item1', 'item2']);
    });
  });

  describe('set operations', () => {
    it('should add members to set', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 2, type: 'integer', error: null });
      
      const result = await redis.sadd('set', 'member1', 'member2');
      expect(result).toBe(2);
    });

    it('should get set members', async () => {
      mockHttpClient.request.mockResolvedValue({ 
        result: ['member1', 'member2'], 
        type: 'array', 
        error: null 
      });
      
      const result = await redis.smembers('set');
      expect(result).toEqual(['member1', 'member2']);
    });
  });

  describe('sorted set operations', () => {
    it('should add scored members', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 2, type: 'integer', error: null });
      
      const result = await redis.zadd('zset', 1, 'member1', 2, 'member2');
      expect(result).toBe(2);
    });

    it('should validate ZADD arguments', async () => {
      await expect(redis.zadd('zset', 1, 'member1', 2)).rejects.toThrow(ValidationError);
    });

    it('should get range with scores', async () => {
      mockHttpClient.request.mockResolvedValue({ 
        result: ['member1', '1', 'member2', '2'], 
        type: 'array', 
        error: null 
      });
      
      const result = await redis.zrange('zset', 0, -1, true);
      expect(result).toEqual(['member1', '1', 'member2', '2']);
    });
  });

  describe('utility operations', () => {
    it('should delete keys', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 2, type: 'integer', error: null });
      
      const result = await redis.del('key1', 'key2');
      expect(result).toBe(2);
    });

    it('should check key existence', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 1, type: 'integer', error: null });
      
      const result = await redis.exists('key');
      expect(result).toBe(1);
    });

    it('should set expiration', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 1, type: 'integer', error: null });
      
      const result = await redis.expire('key', 60);
      expect(result).toBe(1);
    });

    it('should get TTL', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 58, type: 'integer', error: null });
      
      const result = await redis.ttl('key');
      expect(result).toBe(58);
    });
  });

  describe('health and monitoring', () => {
    it('should ping server', async () => {
      mockHttpClient.request.mockResolvedValue({ result: 'PONG', type: 'string', error: null });
      
      const result = await redis.ping();
      expect(result).toBe('PONG');
    });

    it('should get health status', async () => {
      const healthResponse = {
        status: 'healthy',
        uptime: 3600,
        connections: { active: 10, total: 100 },
        memory: { used: 1024, available: 4096 },
      };
      mockHttpClient.request.mockResolvedValue(healthResponse);
      
      const result = await redis.health();
      expect(result).toEqual(healthResponse);
      
      expect(mockHttpClient.request).toHaveBeenCalledWith('GET', '/health');
    });
  });

  describe('pipeline operations', () => {
    it('should create pipeline instance', () => {
      const pipeline = redis.pipeline();
      expect(pipeline).toBeDefined();
    });
  });

  describe('transaction operations', () => {
    it('should create transaction instance', () => {
      const transaction = redis.multi();
      expect(transaction).toBeDefined();
    });
  });

  describe('interceptors', () => {
    it('should add request interceptor', () => {
      const interceptor = jest.fn();
      redis.addRequestInterceptor(interceptor);
      
      expect(mockHttpClient.addRequestInterceptor).toHaveBeenCalledWith(interceptor);
    });

    it('should add response interceptor', () => {
      const interceptor = jest.fn();
      redis.addResponseInterceptor(interceptor);
      
      expect(mockHttpClient.addResponseInterceptor).toHaveBeenCalledWith(interceptor);
    });
  });

  describe('configuration', () => {
    it('should get configuration', () => {
      const config = redis.getConfig();
      expect(config).toEqual({
        url: 'http://localhost:8080',
        token: 'test-token',
      });
    });

    it('should update configuration', () => {
      redis.updateConfig({ timeout: 10000 });
      
      // Should create new HttpClient with updated config
      expect(HttpClient).toHaveBeenCalledTimes(2);
    });
  });
});