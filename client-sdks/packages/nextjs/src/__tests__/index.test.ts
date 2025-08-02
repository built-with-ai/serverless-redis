import {
  createServerlessRedis,
  getServerlessRedis,
  resetServerlessRedis,
  withRedis,
  NextRedisUtils,
  createRedisMiddleware,
} from '../index';
import { ServerlessRedis } from '@builtwithai/serverless-redis-client';

// Mock the core client
jest.mock('@builtwithai/serverless-redis-client', () => ({
  ServerlessRedis: jest.fn().mockImplementation((config) => ({
    config,
    get: jest.fn(),
    set: jest.fn(),
  })),
}));

describe('@scaler/serverless-redis-nextjs', () => {
  const MockedServerlessRedis = ServerlessRedis as jest.MockedClass<typeof ServerlessRedis>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetServerlessRedis();
    
    // Reset environment variables
    delete process.env.REDIS_PROXY_URL;
    delete process.env.REDIS_TOKEN;
    delete process.env.REDIS_API_KEY;
    delete process.env.REDIS_TIMEOUT;
    delete process.env.REDIS_RETRIES;
    delete process.env.REDIS_DB;
    delete process.env.NEXT_RUNTIME;
    delete process.env.__NEXT_PRIVATE_PREBUNDLED_REACT;
  });

  describe('createServerlessRedis', () => {
    it('should create Redis client with provided config', () => {
      const config = {
        url: 'http://localhost:8080',
        token: 'test-token',
        timeout: 5000,
      };

      const redis = createServerlessRedis(config);

      expect(MockedServerlessRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          url: config.url,
          token: config.token,
          timeout: config.timeout,
        })
      );
      expect(redis).toBeDefined();
    });

    it('should use environment variables when config not provided', () => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';
      process.env.REDIS_TOKEN = 'env-token';
      process.env.REDIS_TIMEOUT = '3000';
      process.env.REDIS_RETRIES = '2';
      process.env.REDIS_DB = '1';

      const _redis = createServerlessRedis();

      expect(MockedServerlessRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:8080',
          token: 'env-token',
          timeout: 3000,
          retries: 2,
          db: 1,
        })
      );
    });

    it('should prefer REDIS_API_KEY over REDIS_TOKEN', () => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';
      process.env.REDIS_TOKEN = 'token';
      process.env.REDIS_API_KEY = 'api-key';

      createServerlessRedis();

      expect(MockedServerlessRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'api-key',
        })
      );
    });

    it('should throw error when URL is missing', () => {
      expect(() => {
        createServerlessRedis();
      }).toThrow('Redis proxy URL is required');
    });

    it('should throw error when token is missing', () => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';

      expect(() => {
        createServerlessRedis();
      }).toThrow('Redis token is required');
    });

    it('should override environment with provided config', () => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';
      process.env.REDIS_TOKEN = 'env-token';

      createServerlessRedis({
        token: 'config-token',
        timeout: 10000,
      });

      expect(MockedServerlessRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:8080',
          token: 'config-token',
          timeout: 10000,
        })
      );
    });
  });

  describe('getServerlessRedis', () => {
    beforeEach(() => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';
      process.env.REDIS_TOKEN = 'test-token';
    });

    it('should return same instance on multiple calls', () => {
      const redis1 = getServerlessRedis();
      const redis2 = getServerlessRedis();

      expect(redis1).toBe(redis2);
      expect(MockedServerlessRedis).toHaveBeenCalledTimes(1);
    });

    it('should create new instance with different config', () => {
      const redis1 = getServerlessRedis();
      const redis2 = getServerlessRedis({ timeout: 10000 });

      expect(redis1).toBe(redis2); // Still returns cached instance
      expect(MockedServerlessRedis).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetServerlessRedis', () => {
    beforeEach(() => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';
      process.env.REDIS_TOKEN = 'test-token';
    });

    it('should clear cached instance', () => {
      const redis1 = getServerlessRedis();
      resetServerlessRedis();
      const redis2 = getServerlessRedis();

      expect(redis1).not.toBe(redis2);
      expect(MockedServerlessRedis).toHaveBeenCalledTimes(2);
    });
  });

  describe('withRedis', () => {
    beforeEach(() => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';
      process.env.REDIS_TOKEN = 'test-token';
    });

    it('should inject Redis client into handler', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'test' });
      const wrappedHandler = withRedis(handler);

      const mockReq = { method: 'GET' };
      const mockRes = { json: jest.fn(), headersSent: false };

      await wrappedHandler(mockReq, mockRes);

      expect(handler).toHaveBeenCalledWith(
        expect.any(Object), // Redis instance
        mockReq,
        mockRes
      );
      expect(mockRes.json).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle handler errors', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const wrappedHandler = withRedis(handler);

      const mockReq = { method: 'GET' };
      const mockRes = { json: jest.fn(), status: jest.fn().mockReturnThis(), headersSent: false };

      await wrappedHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Handler error',
      });
    });

    it('should not send response if handler returns undefined', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const wrappedHandler = withRedis(handler);

      const mockReq = { method: 'GET' };
      const mockRes = { json: jest.fn(), headersSent: false };

      await wrappedHandler(mockReq, mockRes);

      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should not send response if headers already sent', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'test' });
      const wrappedHandler = withRedis(handler);

      const mockReq = { method: 'GET' };
      const mockRes = { json: jest.fn(), headersSent: true };

      await wrappedHandler(mockReq, mockRes);

      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('NextRedisUtils', () => {
    beforeEach(() => {
      // Clear environment variables
      delete process.env.NEXT_RUNTIME;
      delete process.env.__NEXT_PRIVATE_PREBUNDLED_REACT;
    });

    describe('isNextJS', () => {
      it('should detect Next.js environment with NEXT_RUNTIME', () => {
        process.env.NEXT_RUNTIME = 'nodejs';
        expect(NextRedisUtils.isNextJS()).toBe(true);
      });

      it('should detect Next.js environment with __NEXT_PRIVATE_PREBUNDLED_REACT', () => {
        process.env.__NEXT_PRIVATE_PREBUNDLED_REACT = 'true';
        expect(NextRedisUtils.isNextJS()).toBe(true);
      });

      it('should return false when not in Next.js environment', () => {
        expect(NextRedisUtils.isNextJS()).toBe(false);
      });
    });

    describe('isEdgeRuntime', () => {
      it('should detect Edge Runtime', () => {
        process.env.NEXT_RUNTIME = 'edge';
        expect(NextRedisUtils.isEdgeRuntime()).toBe(true);
      });

      it('should return false for Node.js runtime', () => {
        process.env.NEXT_RUNTIME = 'nodejs';
        expect(NextRedisUtils.isEdgeRuntime()).toBe(false);
      });

      it('should return false when NEXT_RUNTIME not set', () => {
        expect(NextRedisUtils.isEdgeRuntime()).toBe(false);
      });
    });

    describe('isNodeRuntime', () => {
      it('should detect Node.js runtime', () => {
        process.env.NEXT_RUNTIME = 'nodejs';
        expect(NextRedisUtils.isNodeRuntime()).toBe(true);
      });

      it('should return false for Edge runtime', () => {
        process.env.NEXT_RUNTIME = 'edge';
        expect(NextRedisUtils.isNodeRuntime()).toBe(false);
      });
    });

    describe('getOptimizedConfig', () => {
      it('should optimize config for Edge runtime', () => {
        process.env.NEXT_RUNTIME = 'edge';

        const config = NextRedisUtils.getOptimizedConfig({
          url: 'http://localhost:8080',
          token: 'test-token',
        });

        expect(config).toEqual({
          url: 'http://localhost:8080',
          token: 'test-token',
          timeout: 3000, // Shorter timeout for edge
          retries: 1,    // Fewer retries for edge
          compression: true,
        });
      });

      it('should optimize config for Node.js runtime', () => {
        process.env.NEXT_RUNTIME = 'nodejs';

        const config = NextRedisUtils.getOptimizedConfig({
          url: 'http://localhost:8080',
          token: 'test-token',
        });

        expect(config).toEqual({
          url: 'http://localhost:8080',
          token: 'test-token',
          timeout: 5000, // Standard timeout
          retries: 3,    // Standard retries
          compression: true,
        });
      });

      it('should preserve existing config values', () => {
        const config = NextRedisUtils.getOptimizedConfig({
          url: 'http://localhost:8080',
          token: 'test-token',
          timeout: 8000,
          compression: false,
        });

        expect(config.timeout).toBe(8000);
        expect(config.compression).toBe(false);
      });
    });
  });

  describe('createRedisMiddleware', () => {
    beforeEach(() => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';
      process.env.REDIS_TOKEN = 'test-token';
    });

    it('should create middleware with Redis instance', () => {
      const { redis, middleware } = createRedisMiddleware();

      expect(redis).toBeDefined();
      expect(middleware).toBeInstanceOf(Function);
    });

    it('should inject Redis into request object', () => {
      const { middleware } = createRedisMiddleware();
      const mockReq = {} as any;
      const mockNext = jest.fn();

      middleware(mockReq, {}, mockNext);

      expect(mockReq.redis).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('useServerlessRedis', () => {
    beforeEach(() => {
      process.env.REDIS_PROXY_URL = 'http://localhost:8080';
      process.env.REDIS_TOKEN = 'test-token';
    });

    it('should return Redis client instance', () => {
      const { useServerlessRedis } = require('../index');
      const redis = useServerlessRedis();

      expect(redis).toBeDefined();
    });

    it('should create new instance with config', () => {
      const { useServerlessRedis } = require('../index');
      const redis = useServerlessRedis({
        timeout: 10000,
      });

      expect(redis).toBeDefined();
    });
  });
});