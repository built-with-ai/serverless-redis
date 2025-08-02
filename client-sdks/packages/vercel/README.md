# @scaler/serverless-redis-vercel

Vercel Edge Functions integration for the Serverless Redis Client, optimized for Vercel's edge runtime and deployment model.

## Installation

```bash
npm install @scaler/serverless-redis-vercel
```

## Quick Start

### Edge Functions

```typescript
// api/redis-example.ts
import { withRedis } from '@scaler/serverless-redis-vercel';

export default withRedis(async (redis, request) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || 'default';
  
  if (request.method === 'GET') {
    const value = await redis.get(key);
    return { key, value };
  }
  
  if (request.method === 'POST') {
    const { value } = await request.json();
    await redis.set(key, value);
    return { success: true, key, value };
  }
  
  return new Response('Method not allowed', { status: 405 });
});

export const config = {
  runtime: 'edge',
};
```

### API Routes (Node.js)

```typescript
// api/users/[id].ts
import { getServerlessRedis } from '@scaler/serverless-redis-vercel';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const redis = getServerlessRedis();
  const { id } = req.query;
  
  if (req.method === 'GET') {
    const user = await redis.hgetall(`user:${id}`);
    res.json(user);
  } else if (req.method === 'PUT') {
    await redis.hset(`user:${id}`, ...Object.entries(req.body).flat());
    res.json({ success: true });
  }
}
```

## Features

- 🚀 **Edge Runtime Optimized** - Works seamlessly in Vercel Edge Functions
- ⚡ **Auto-Configuration** - Detects runtime and applies optimal settings
- 🌍 **Environment Detection** - Automatically configures for production/preview/development
- 🔧 **TypeScript First** - Full type safety for Vercel environments
- 📦 **Zero Config** - Works with standard Vercel environment variables
- 🛡️ **CORS Helpers** - Built-in CORS handling utilities

## Configuration

### Environment Variables

Set these in your Vercel project settings or `.env.local`:

```bash
REDIS_PROXY_URL=https://your-redis-proxy.example.com
REDIS_TOKEN=your-api-key-or-jwt
REDIS_TIMEOUT=3000  # Optional: timeout in ms (default: 3000 for edge, 5000 for nodejs)
REDIS_RETRIES=1     # Optional: retry attempts (default: 1 for edge, 3 for nodejs)
REDIS_DB=0          # Optional: Redis database number
```

### Programmatic Configuration

```typescript
import { createServerlessRedis, VercelRedisUtils } from '@scaler/serverless-redis-vercel';

const redis = createServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key',
  timeout: 3000,
  retries: 1,
  compression: true,
  headers: {
    'X-Custom-Header': 'value'
  }
});

// Or use optimized configuration for current environment
const optimizedRedis = createServerlessRedis(
  VercelRedisUtils.getOptimizedConfig({
    url: process.env.REDIS_PROXY_URL,
    token: process.env.REDIS_TOKEN,
  })
);
```

## API Reference

### Functions

#### `createServerlessRedis(config?)`

Creates a new Redis client instance optimized for Vercel.

```typescript
const redis = createServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key',
  timeout: 3000,    // Shorter timeout for edge functions
  retries: 1,       // Fewer retries for edge functions
  compression: true // Enable compression
});
```

#### `getServerlessRedis(config?)`

Gets or creates a global Redis client instance (recommended for performance).

```typescript
const redis = getServerlessRedis();
```

#### `withRedis(handler)`

Wraps an Edge Function handler with Redis client injection and error handling.

```typescript
export default withRedis(async (redis, request) => {
  const data = await redis.get('key');
  return { data };
});
```

#### `createRedisMiddleware(config?)`

Creates middleware that adds Redis client to request objects.

```typescript
const { redis, middleware } = createRedisMiddleware();
```

### Utilities

#### `VercelRedisUtils`

Utility functions for Vercel-specific functionality:

```typescript
import { VercelRedisUtils } from '@scaler/serverless-redis-vercel';

// Runtime detection
VercelRedisUtils.isEdgeRuntime();    // true if running in Edge Runtime
VercelRedisUtils.isNodeRuntime();    // true if running in Node.js runtime

// Environment detection
VercelRedisUtils.isProduction();     // true if VERCEL_ENV=production
VercelRedisUtils.isPreview();        // true if VERCEL_ENV=preview
VercelRedisUtils.isDevelopment();    // true if VERCEL_ENV=development

// Get current Vercel URL
const url = VercelRedisUtils.getVercelUrl();

// Get optimized config for current environment
const config = VercelRedisUtils.getOptimizedConfig({
  url: process.env.REDIS_PROXY_URL,
  token: process.env.REDIS_TOKEN,
});

// Create config from environment variables
const envConfig = VercelRedisUtils.createConfigFromEnvironment();
```

#### CORS Helpers

```typescript
import { corsResponse, handleCors } from '@scaler/serverless-redis-vercel';

export default async function handler(request: Request) {
  // Handle CORS preflight
  const corsResult = handleCors(request);
  if (corsResult) return corsResult;
  
  // Your logic here
  const data = { message: 'Hello' };
  
  // Return CORS-enabled response
  return corsResponse(data);
}
```

## Examples

### User Session Management

```typescript
// api/session.ts
import { withRedis } from '@scaler/serverless-redis-vercel';

export default withRedis(async (redis, request) => {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }
  
  if (request.method === 'GET') {
    const sessionData = await redis.hgetall(`session:${sessionId}`);
    return { sessionData };
  }
  
  if (request.method === 'POST') {
    const data = await request.json();
    await redis.hset(`session:${sessionId}`, ...Object.entries(data).flat());
    await redis.expire(`session:${sessionId}`, 3600); // 1 hour TTL
    return { success: true };
  }
  
  if (request.method === 'DELETE') {
    await redis.del(`session:${sessionId}`);
    return { success: true };
  }
});

export const config = { runtime: 'edge' };
```

### Rate Limiting

```typescript
// api/rate-limit.ts
import { withRedis } from '@scaler/serverless-redis-vercel';

export default withRedis(async (redis, request) => {
  const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
  const key = `rate_limit:${clientIP}`;
  
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, 60); // 1 minute window
  }
  
  if (current > 10) { // 10 requests per minute
    return new Response('Rate limit exceeded', { 
      status: 429,
      headers: {
        'Retry-After': '60'
      }
    });
  }
  
  return {
    message: 'API call successful',
    remaining: 10 - current,
    resetIn: await redis.ttl(key)
  };
});

export const config = { runtime: 'edge' };
```

### Cached API Proxy

```typescript
// api/proxy/[...path].ts
import { withRedis } from '@scaler/serverless-redis-vercel';

export default withRedis(async (redis, request) => {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/proxy/', '');
  const cacheKey = `proxy:${path}:${url.search}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from upstream API
  const response = await fetch(`https://api.example.com/${path}${url.search}`);
  const data = await response.json();
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(data));
  
  return data;
});

export const config = { runtime: 'edge' };
```

## Runtime Optimization

The package automatically optimizes settings based on the Vercel runtime:

### Edge Runtime
- Shorter timeouts (3000ms default)
- Fewer retries (1 default)
- Compression enabled
- Minimal memory footprint

### Node.js Runtime
- Standard timeouts (5000ms default)
- Standard retries (3 default)
- Full feature set available

## Deployment

1. **Install the package**:
   ```bash
   npm install @scaler/serverless-redis-vercel
   ```

2. **Set environment variables** in Vercel dashboard:
   - `REDIS_PROXY_URL`
   - `REDIS_TOKEN`

3. **Deploy your functions**:
   ```bash
   vercel deploy
   ```

The package handles the rest automatically!

## License

MIT License - see [LICENSE](../../../LICENSE) for details.