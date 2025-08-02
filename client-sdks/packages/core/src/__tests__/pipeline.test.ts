import { Pipeline } from '../pipeline';
import { HttpClient } from '../utils';
import { PipelineError } from '../errors';

// Mock the HttpClient
jest.mock('../utils');

describe('Pipeline', () => {
  let pipeline: Pipeline;
  let mockHttpClient: jest.Mocked<HttpClient>;

  beforeEach(() => {
    mockHttpClient = {
      request: jest.fn(),
    } as any;

    pipeline = new Pipeline(mockHttpClient, 0);
  });

  describe('command building', () => {
    it('should add SET command', () => {
      pipeline.set('key', 'value');
      expect(pipeline.length).toBe(1);
    });

    it('should add GET command', () => {
      pipeline.get('key');
      expect(pipeline.length).toBe(1);
    });

    it('should add multiple commands', () => {
      pipeline
        .set('key1', 'value1')
        .get('key2')
        .incr('counter')
        .del('key3');
      
      expect(pipeline.length).toBe(4);
    });

    it('should support method chaining', () => {
      const result = pipeline
        .set('key1', 'value1')
        .set('key2', 'value2');
      
      expect(result).toBe(pipeline);
      expect(pipeline.length).toBe(2);
    });
  });

  describe('hash operations', () => {
    it('should add hash commands', () => {
      pipeline
        .hset('user:1', 'name', 'John', 'age', '30')
        .hget('user:1', 'name')
        .hgetall('user:1');
      
      expect(pipeline.length).toBe(3);
    });

    it('should validate HSET arguments', () => {
      expect(() => {
        pipeline.hset('key', 'field');
      }).toThrow('HSET requires an even number of field-value arguments');
    });
  });

  describe('list operations', () => {
    it('should add list commands', () => {
      pipeline
        .lpush('list', 'item1', 'item2')
        .rpush('list', 'item3')
        .lpop('list')
        .llen('list');
      
      expect(pipeline.length).toBe(4);
    });
  });

  describe('set operations', () => {
    it('should add set commands', () => {
      pipeline
        .sadd('set', 'member1', 'member2')
        .srem('set', 'member1')
        .smembers('set')
        .scard('set');
      
      expect(pipeline.length).toBe(4);
    });
  });

  describe('sorted set operations', () => {
    it('should add sorted set commands', () => {
      pipeline
        .zadd('zset', 1, 'member1', 2, 'member2')
        .zrange('zset', 0, -1)
        .zcard('zset');
      
      expect(pipeline.length).toBe(3);
    });

    it('should validate ZADD arguments', () => {
      expect(() => {
        pipeline.zadd('zset', 1, 'member1', 2);
      }).toThrow('ZADD requires an even number of score-member arguments');
    });
  });

  describe('execution', () => {
    it('should execute empty pipeline', async () => {
      const result = await pipeline.exec();
      expect(result).toEqual([]);
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it('should execute pipeline with commands', async () => {
      const mockResponse = {
        results: [
          { result: 'OK', type: 'string', error: null },
          { result: 'value1', type: 'string', error: null },
          { result: 1, type: 'integer', error: null },
        ],
        time: 10.5,
      };
      
      mockHttpClient.request.mockResolvedValue(mockResponse);
      
      pipeline
        .set('key1', 'value1')
        .get('key1')
        .incr('counter');
      
      const results = await pipeline.exec();
      
      expect(results).toEqual(['OK', 'value1', 1]);
      expect(mockHttpClient.request).toHaveBeenCalledWith('POST', '/v1/pipeline', {
        commands: [
          { command: 'SET', args: ['key1', 'value1'], db: 0 },
          { command: 'GET', args: ['key1'], db: 0 },
          { command: 'INCR', args: ['counter'], db: 0 },
        ],
      });
    });

    it('should handle command errors in pipeline', async () => {
      const mockResponse = {
        results: [
          { result: 'OK', type: 'string', error: null },
          { result: null, type: null, error: 'Key not found' },
          { result: 1, type: 'integer', error: null },
        ],
        time: 10.5,
      };
      
      mockHttpClient.request.mockResolvedValue(mockResponse);
      
      pipeline
        .set('key1', 'value1')
        .get('nonexistent')
        .incr('counter');
      
      const results = await pipeline.exec();
      
      // Should have error in the second result
      expect(results).toHaveLength(3);
      expect(results[0]).toBe('OK');
      expect(results[1]).toBeInstanceOf(Error);
      expect(results[2]).toBe(1);
    });

    it('should execute with detailed results', async () => {
      const mockResponse = {
        results: [
          { result: 'OK', type: 'string', error: null },
          { result: 'value1', type: 'string', error: null },
        ],
        time: 15.2,
      };
      
      mockHttpClient.request.mockResolvedValue(mockResponse);
      
      pipeline
        .set('key1', 'value1')
        .get('key1');
      
      const results = await pipeline.execWithDetails();
      
      expect(results).toEqual({
        results: ['OK', 'value1'],
        time: 15.2,
        commandCount: 2,
      });
    });

    it('should clear commands after execution', async () => {
      const mockResponse = {
        results: [{ result: 'OK', type: 'string', error: null }],
        time: 5.0,
      };
      
      mockHttpClient.request.mockResolvedValue(mockResponse);
      
      pipeline.set('key', 'value');
      expect(pipeline.length).toBe(1);
      
      await pipeline.exec();
      expect(pipeline.length).toBe(0);
    });

    it('should not clear commands on execution error', async () => {
      mockHttpClient.request.mockRejectedValue(new Error('Network error'));
      
      pipeline.set('key', 'value');
      expect(pipeline.length).toBe(1);
      
      await expect(pipeline.exec()).rejects.toThrow('Network error');
      expect(pipeline.length).toBe(1); // Commands preserved for retry
    });
  });

  describe('utility methods', () => {
    it('should discard pipeline', () => {
      pipeline
        .set('key1', 'value1')
        .set('key2', 'value2');
      
      expect(pipeline.length).toBe(2);
      
      pipeline.discard();
      expect(pipeline.length).toBe(0);
    });

    it('should get command count', () => {
      expect(pipeline.length).toBe(0);
      
      pipeline.set('key', 'value');
      expect(pipeline.length).toBe(1);
      
      pipeline.get('key');
      expect(pipeline.length).toBe(2);
    });
  });

  describe('raw command support', () => {
    it('should add raw commands', () => {
      pipeline.command('CUSTOM', 'arg1', 'arg2');
      expect(pipeline.length).toBe(1);
    });

    it('should support mixed command types', () => {
      pipeline
        .set('key', 'value')
        .command('CUSTOM', 'arg1')
        .get('key')
        .command('ANOTHER', 'arg2', 'arg3');
      
      expect(pipeline.length).toBe(4);
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      mockHttpClient.request.mockRejectedValue(new Error('Connection failed'));
      
      pipeline.set('key', 'value');
      
      await expect(pipeline.exec()).rejects.toThrow('Connection failed');
    });

    it('should handle malformed responses', async () => {
      mockHttpClient.request.mockResolvedValue({ invalid: 'response' });
      
      pipeline.set('key', 'value');
      
      await expect(pipeline.exec()).rejects.toThrow();
    });
  });

  describe('serialization', () => {
    it('should serialize values correctly', () => {
      // This would test the serializeValue integration
      pipeline
        .set('string', 'value')
        .set('number', 42)
        .set('object', { key: 'value' })
        .set('array', [1, 2, 3]);
      
      expect(pipeline.length).toBe(4);
    });
  });
});