# @scaler/serverless-redis-client

TypeScript client library for the Serverless Redis Proxy, providing a familiar Redis-like API optimized for serverless and edge computing environments.

## Installation

```bash
npm install @scaler/serverless-redis-client
```

## Quick Start

```typescript
import { ServerlessRedis } from '@scaler/serverless-redis-client';

const redis = new ServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key'
});

// Basic operations
await redis.set('key', 'value');
const value = await redis.get('key');

// Pipeline operations
const results = await redis.pipeline()
  .set('key1', 'value1')
  .set('key2', 'value2')
  .mget(['key1', 'key2'])
  .exec();

// Transaction operations
const txResults = await redis.multi()
  .set('counter', '0')
  .incr('counter')
  .exec();
```

## Features

- 🚀 **Redis-like API** - Familiar interface for Redis developers
- 📦 **Zero Dependencies** - Minimal bundle size (< 50KB)
- 🔧 **TypeScript First** - Full type safety and IntelliSense
- ⚡ **Edge Optimized** - Works in Node.js, browsers, and edge runtimes
- 🔄 **Pipeline Support** - Batch operations for better performance
- 🛡️ **Error Handling** - Proper Redis error semantics
- 🔌 **Middleware Support** - Request/response interceptors
- ⚙️ **Configurable** - Timeouts, retries, compression

## Configuration

```typescript
const redis = new ServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key',
  timeout: 5000,          // Request timeout (ms)
  retries: 3,             // Retry attempts
  retryDelay: 100,        // Base retry delay (ms)
  compression: true,      // Enable compression
  db: 0,                  // Default database
  headers: {              // Custom headers
    'X-Custom': 'value'
  }
});
```

## API Reference

### String Operations

```typescript
await redis.set('key', 'value');
await redis.set('key', 'value', 'EX', 60); // With expiration
const value = await redis.get('key');
const values = await redis.mget('key1', 'key2', 'key3');
await redis.mset('key1', 'value1', 'key2', 'value2');
await redis.del('key1', 'key2');
const exists = await redis.exists('key');
await redis.expire('key', 60);
const ttl = await redis.ttl('key');
```

### Numeric Operations

```typescript
const newValue = await redis.incr('counter');
const newValue = await redis.incrby('counter', 5);
const newValue = await redis.decr('counter');
const newValue = await redis.decrby('counter', 3);
```

### Hash Operations

```typescript
await redis.hset('user:123', 'name', 'John', 'age', '30');
const name = await redis.hget('user:123', 'name');
const values = await redis.hmget('user:123', 'name', 'age');
const all = await redis.hgetall('user:123');
await redis.hdel('user:123', 'age');
const exists = await redis.hexists('user:123', 'name');
const count = await redis.hlen('user:123');
const keys = await redis.hkeys('user:123');
const values = await redis.hvals('user:123');
```

### List Operations

```typescript
await redis.lpush('list', 'item1', 'item2');
await redis.rpush('list', 'item3');
const item = await redis.lpop('list');
const items = await redis.lpop('list', 2);
const length = await redis.llen('list');
const range = await redis.lrange('list', 0, -1);
```

### Set Operations

```typescript
await redis.sadd('set', 'member1', 'member2');
await redis.srem('set', 'member1');
const members = await redis.smembers('set');
const count = await redis.scard('set');
const isMember = await redis.sismember('set', 'member1');
```

### Sorted Set Operations

```typescript
await redis.zadd('zset', 1, 'member1', 2, 'member2');
await redis.zrem('zset', 'member1');
const range = await redis.zrange('zset', 0, -1);
const rangeWithScores = await redis.zrange('zset', 0, -1, true);
const count = await redis.zcard('zset');
const score = await redis.zscore('zset', 'member1');
```

### Pipeline Operations

```typescript
const pipeline = redis.pipeline();

pipeline
  .set('key1', 'value1')
  .set('key2', 'value2')
  .get('key1')
  .incr('counter');

const results = await pipeline.exec();
console.log(results); // ['OK', 'OK', 'value1', 1]

// With detailed results
const detailedResults = await pipeline.execWithDetails();
console.log(detailedResults.time); // Execution time
```

### Transaction Operations

```typescript
const transaction = redis.multi();

transaction
  .set('key1', 'value1')
  .incr('counter')
  .get('key1');

const results = await transaction.exec();
console.log(results); // ['OK', 1, 'value1']
```

### Health & Monitoring

```typescript
// Simple ping
const pong = await redis.ping();

// Detailed health check
const health = await redis.health();
console.log(health.status);      // 'healthy'
console.log(health.uptime);      // Server uptime
console.log(health.connections); // Connection stats
console.log(health.memory);      // Memory usage
```

## Middleware & Interceptors

```typescript
// Request interceptor
redis.addRequestInterceptor(async (config) => {
  console.log('Making request:', config.method, config.url);
  config.headers['X-Request-ID'] = generateRequestId();
  return config;
});

// Response interceptor
redis.addResponseInterceptor(async (response) => {
  console.log('Response received:', response.status);
  return response;
});
```

## Error Handling

```typescript
import { 
  RedisError, 
  ConnectionError, 
  AuthenticationError,
  TimeoutError,
  ValidationError 
} from '@scaler/serverless-redis-client';

try {
  await redis.get('key');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid token');
  } else if (error instanceof ConnectionError) {
    console.log('Network error');
  } else if (error instanceof RedisError) {
    console.log('Redis command error:', error.message);
  }
}
```

## TypeScript Support

The client is built with TypeScript and provides full type safety:

```typescript
import type { 
  ServerlessRedisConfig,
  RedisValue,
  RedisKey,
  HealthResponse 
} from '@scaler/serverless-redis-client';

const config: ServerlessRedisConfig = {
  url: 'https://your-proxy.example.com',
  token: 'your-api-key'
};

const key: RedisKey = 'user:123';
const value: RedisValue = { name: 'John', age: 30 };
```

## Edge Runtime Compatibility

Works in all JavaScript environments:

- ✅ Node.js (16+)
- ✅ Browsers (modern)
- ✅ Vercel Edge Functions
- ✅ Cloudflare Workers
- ✅ Deno
- ✅ Bun

## Performance Tips

1. **Use Pipelines**: Batch multiple operations for better performance
2. **Enable Compression**: Reduces payload size (enabled by default)
3. **Connection Reuse**: The client automatically reuses HTTP connections
4. **Appropriate Timeouts**: Set timeouts based on your serverless function limits

```typescript
// Good: Use pipeline for multiple operations
const results = await redis.pipeline()
  .get('user:1')
  .get('user:2')
  .get('user:3')
  .exec();

// Avoid: Multiple individual requests
const user1 = await redis.get('user:1');
const user2 = await redis.get('user:2');
const user3 = await redis.get('user:3');
```

## License

MIT License - see [LICENSE](../../../LICENSE) for details.