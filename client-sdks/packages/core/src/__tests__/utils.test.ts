import { 
  HttpClient, 
  validateConfig, 
  serializeValue, 
  parseValue, 
  buildUrl, 
  calculateBackoffDelay, 
  sleep 
} from '../utils';
import { 
  ConnectionError, 
  AuthenticationError, 
  TimeoutError, 
  ValidationError,
  RateLimitError 
} from '../errors';

// Mock fetch globally
global.fetch = jest.fn();

describe('HttpClient', () => {
  let httpClient: HttpClient;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    httpClient = new HttpClient({
      url: 'http://localhost:8080',
      token: 'test-token',
      timeout: 5000,
      retries: 3,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(httpClient).toBeInstanceOf(HttpClient);
    });

    it('should set default values', () => {
      const client = new HttpClient({
        url: 'http://localhost:8080',
        token: 'test-token',
      });
      expect(client).toBeInstanceOf(HttpClient);
    });
  });

  describe('request method', () => {
    it('should make successful HTTP request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({ result: 'success' }),
        headers: new Map(),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await httpClient.request('GET', '/test');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/test', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
          'User-Agent': expect.stringContaining('serverless-redis-client'),
        },
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual({ result: 'success' });
    });

    it('should include request body for POST requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: 'success' }),
        headers: new Map(),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const requestData = { key: 'value' };
      await httpClient.request('POST', '/test', requestData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
        })
      );
    });

    it('should handle authentication errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({ error: 'Invalid token' }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(httpClient.request('GET', '/test')).rejects.toThrow(AuthenticationError);
    });

    it('should handle rate limit errors', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: jest.fn().mockResolvedValue({ error: 'Rate limit exceeded' }),
        headers: new Map([['retry-after', '60']]),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(httpClient.request('GET', '/test')).rejects.toThrow(RateLimitError);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        })
      );

      await expect(httpClient.request('GET', '/test')).rejects.toThrow(TimeoutError);
    });

    it('should retry on retryable errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ result: 'success' }),
        } as any);

      const result = await httpClient.request('GET', '/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ result: 'success' });
    });

    it('should not retry non-retryable errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ error: 'Invalid request' }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(httpClient.request('GET', '/test')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('interceptors', () => {
    it('should execute request interceptors', async () => {
      const interceptor = jest.fn().mockImplementation((config) => ({
        ...config,
        headers: { ...config.headers, 'X-Custom': 'value' },
      }));

      httpClient.addRequestInterceptor(interceptor);

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: 'success' }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await httpClient.request('GET', '/test');

      expect(interceptor).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'value',
          }),
        })
      );
    });

    it('should execute response interceptors', async () => {
      const interceptor = jest.fn().mockImplementation((response) => ({
        ...response,
        modified: true,
      }));

      httpClient.addResponseInterceptor(interceptor);

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: 'success' }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await httpClient.request('GET', '/test');

      expect(interceptor).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success', modified: true });
    });
  });
});

describe('Utility Functions', () => {
  describe('validateConfig', () => {
    it('should validate valid config', () => {
      expect(() => {
        validateConfig({
          url: 'http://localhost:8080',
          token: 'test-token',
        });
      }).not.toThrow();
    });

    it('should throw for missing URL', () => {
      expect(() => {
        validateConfig({
          url: '',
          token: 'test-token',
        });
      }).toThrow(ValidationError);
    });

    it('should throw for missing token', () => {
      expect(() => {
        validateConfig({
          url: 'http://localhost:8080',
          token: '',
        });
      }).toThrow(ValidationError);
    });

    it('should throw for invalid URL', () => {
      expect(() => {
        validateConfig({
          url: 'not-a-url',
          token: 'test-token',
        });
      }).toThrow(ValidationError);
    });
  });

  describe('serializeValue', () => {
    it('should serialize string values', () => {
      expect(serializeValue('test')).toBe('test');
    });

    it('should serialize number values', () => {
      expect(serializeValue(42)).toBe('42');
    });

    it('should serialize boolean values', () => {
      expect(serializeValue(true)).toBe('true');
      expect(serializeValue(false)).toBe('false');
    });

    it('should serialize object values', () => {
      const obj = { key: 'value', number: 42 };
      expect(serializeValue(obj)).toBe(JSON.stringify(obj));
    });

    it('should serialize array values', () => {
      const arr = [1, 2, 3];
      expect(serializeValue(arr)).toBe(JSON.stringify(arr));
    });

    it('should handle null values', () => {
      expect(serializeValue(null)).toBe('null');
    });

    it('should handle undefined values', () => {
      expect(serializeValue(undefined)).toBe('undefined');
    });
  });

  describe('parseValue', () => {
    it('should parse string values', () => {
      expect(parseValue('test', 'string')).toBe('test');
    });

    it('should parse integer values', () => {
      expect(parseValue(42, 'integer')).toBe(42);
    });

    it('should parse array values', () => {
      expect(parseValue(['a', 'b', 'c'], 'array')).toEqual(['a', 'b', 'c']);
    });

    it('should parse hash values', () => {
      const hash = { key: 'value' };
      expect(parseValue(hash, 'hash')).toEqual(hash);
    });

    it('should parse JSON strings', () => {
      const obj = { key: 'value' };
      expect(parseValue(JSON.stringify(obj), 'json')).toEqual(obj);
    });

    it('should handle null values', () => {
      expect(parseValue(null, 'null')).toBeNull();
    });

    it('should return raw value for unknown types', () => {
      expect(parseValue('test', 'unknown' as any)).toBe('test');
    });
  });

  describe('buildUrl', () => {
    it('should build URL from base and path', () => {
      expect(buildUrl('http://localhost:8080', '/test')).toBe('http://localhost:8080/test');
    });

    it('should handle trailing slashes', () => {
      expect(buildUrl('http://localhost:8080/', '/test')).toBe('http://localhost:8080/test');
    });

    it('should handle missing leading slash in path', () => {
      expect(buildUrl('http://localhost:8080', 'test')).toBe('http://localhost:8080/test');
    });

    it('should add query parameters', () => {
      const url = buildUrl('http://localhost:8080', '/test', { key: 'value', count: '10' });
      expect(url).toBe('http://localhost:8080/test?key=value&count=10');
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateBackoffDelay(0, 100)).toBe(100);
      expect(calculateBackoffDelay(1, 100)).toBe(200);
      expect(calculateBackoffDelay(2, 100)).toBe(400);
    });

    it('should add jitter', () => {
      const delay1 = calculateBackoffDelay(1, 100);
      const delay2 = calculateBackoffDelay(1, 100);
      
      // With jitter, delays should be in the expected range but may vary
      expect(delay1).toBeGreaterThanOrEqual(100);
      expect(delay1).toBeLessThanOrEqual(300);
      expect(delay2).toBeGreaterThanOrEqual(100);
      expect(delay2).toBeLessThanOrEqual(300);
    });

    it('should cap maximum delay', () => {
      const delay = calculateBackoffDelay(10, 100, 1000);
      expect(delay).toBeLessThanOrEqual(1000);
    });
  });

  describe('sleep', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });
});