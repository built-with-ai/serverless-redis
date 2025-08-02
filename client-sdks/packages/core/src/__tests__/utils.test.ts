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
  AuthenticationError, 
  TimeoutError, 
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
        text: jest.fn().mockResolvedValue('{ "result": "success" }'),
        headers: {
          get: jest.fn((_key: string) => _key === 'content-type' ? 'application/json' : null),
          forEach: jest.fn((_callback: (_value: string, _key: string) => void) => {
            _callback('application/json', 'content-type');
          }),
        },
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await httpClient.request('GET', '/test');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/test', {
        method: 'GET',
        headers: {
          'Authorization': 'test-token',
          'Content-Type': 'application/json',
          'User-Agent': 'serverless-redis-client/1.0.0',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: undefined,
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual({ result: 'success' });
    });

    it('should include request body for POST requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: 'success' }),
        text: jest.fn().mockResolvedValue('{ "result": "success" }'),
        headers: {
          get: jest.fn((_key: string) => _key === 'content-type' ? 'application/json' : null),
          forEach: jest.fn((_callback: (_value: string, _key: string) => void) => {
            _callback('application/json', 'content-type');
          }),
        },
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
        text: jest.fn().mockResolvedValue('{ "error": "Invalid token" }'),
        headers: {
          get: jest.fn((_key: string) => _key === 'content-type' ? 'application/json' : null),
          forEach: jest.fn((_callback: (_value: string, _key: string) => void) => {
            _callback('application/json', 'content-type');
          }),
        },
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
        text: jest.fn().mockResolvedValue('{ "error": "Rate limit exceeded" }'),
        headers: {
          get: jest.fn((_key: string) => {
            if (_key === 'content-type') return 'application/json';
            if (_key === 'retry-after') return '60';
            return null;
          }),
          forEach: jest.fn((_callback: (_value: string, _key: string) => void) => {
            _callback('application/json', 'content-type');
            _callback('60', 'retry-after');
          }),
        },
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(httpClient.request('GET', '/test')).rejects.toThrow(RateLimitError);
    });

    it('should handle timeout errors', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValue(abortError);

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
          text: jest.fn().mockResolvedValue('{ "result": "success" }'),
          headers: {
            get: jest.fn((key: string) => key === 'content-type' ? 'application/json' : null),
            forEach: jest.fn((_callback: (_value: string, _key: string) => void) => {
              _callback('application/json', 'content-type');
            }),
          },
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
        text: jest.fn().mockResolvedValue('{ "error": "Invalid request" }'),
        headers: {
          get: jest.fn((_key: string) => _key === 'content-type' ? 'application/json' : null),
          forEach: jest.fn((_callback: (_value: string, _key: string) => void) => {
            _callback('application/json', 'content-type');
          }),
        },
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
        headers: {
          get: jest.fn().mockReturnValue('application/json'),
          forEach: jest.fn(),
        },
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
        headers: {
          get: jest.fn().mockReturnValue('application/json'),
          forEach: jest.fn(),
        },
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await httpClient.request('GET', '/test');

      expect(interceptor).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
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
      }).toThrow('URL is required');
    });

    it('should throw for missing token', () => {
      expect(() => {
        validateConfig({
          url: 'http://localhost:8080',
          token: '',
        });
      }).toThrow('Token is required');
    });

    it('should throw for invalid URL', () => {
      expect(() => {
        validateConfig({
          url: 'not-a-url',
          token: 'test-token',
        });
      }).toThrow('Invalid URL format');
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
      expect(serializeValue(null)).toBe('');
    });

    it('should handle undefined values', () => {
      expect(serializeValue(undefined)).toBe('');
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
    it('should build URL from base without params', () => {
      expect(buildUrl('http://localhost:8080')).toBe('http://localhost:8080');
    });

    it('should build URL with query parameters', () => {
      const url = buildUrl('http://localhost:8080', { key: 'value', count: '10' });
      expect(url).toBe('http://localhost:8080/?key=value&count=10');
    });

    it('should build URL with empty params', () => {
      expect(buildUrl('http://localhost:8080', {})).toBe('http://localhost:8080');
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay0 = calculateBackoffDelay(0, 100);
      const delay1 = calculateBackoffDelay(1, 100);
      const delay2 = calculateBackoffDelay(2, 100);
      
      // Should follow exponential pattern (with jitter)
      expect(delay0).toBeGreaterThanOrEqual(100);
      expect(delay1).toBeGreaterThanOrEqual(200);
      expect(delay2).toBeGreaterThanOrEqual(400);
    });

    it('should add jitter', () => {
      const delay1 = calculateBackoffDelay(1, 100);
      const delay2 = calculateBackoffDelay(1, 100);
      
      // With jitter, delays should be in the expected range but may vary
      expect(delay1).toBeGreaterThanOrEqual(200);
      expect(delay1).toBeLessThanOrEqual(1200);
      expect(delay2).toBeGreaterThanOrEqual(200);
      expect(delay2).toBeLessThanOrEqual(1200);
    });

    it('should cap maximum delay', () => {
      const delay = calculateBackoffDelay(10, 100);
      expect(delay).toBeLessThanOrEqual(30000);
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