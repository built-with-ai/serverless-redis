# @scaler/serverless-redis-cloudflare

Cloudflare Workers integration for the Serverless Redis Client, optimized for Cloudflare's edge runtime with advanced caching and storage integrations.

## Installation

```bash
npm install @scaler/serverless-redis-cloudflare
```

## Quick Start

### Basic Worker

```typescript
// src/worker.ts
import { withRedis } from '@scaler/serverless-redis-cloudflare';

export interface Env {
  REDIS_PROXY_URL: string;
  REDIS_TOKEN: string;
}

export default withRedis(async (redis, request, env, ctx) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || 'default';
  
  if (request.method === 'GET') {
    const value = await redis.get(key);
    return new Response(JSON.stringify({ key, value }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (request.method === 'POST') {
    const { value } = await request.json();
    await redis.set(key, value);
    return new Response(JSON.stringify({ success: true, key, value }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
});
```

### With KV Caching

```typescript
import { CloudflareRedis } from '@scaler/serverless-redis-cloudflare';

export interface Env {
  REDIS_PROXY_URL: string;
  REDIS_TOKEN: string;
  REDIS_CACHE: KVNamespace; // KV binding for caching
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const redis = new CloudflareRedis({
      url: env.REDIS_PROXY_URL,
      token: env.REDIS_TOKEN,
    }, env, ctx);
    
    const key = new URL(request.url).searchParams.get('key') || 'default';
    
    // Get with KV cache fallback (5 minute TTL)
    const value = await redis.getWithCache(key, 300);
    
    return new Response(JSON.stringify({ key, value }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

## Features

- 🚀 **Cloudflare Workers Optimized** - Ultra-low latency edge computing
- ⚡ **KV Integration** - Automatic caching with Cloudflare KV
- 💾 **R2 Storage** - Large object storage with Redis metadata
- 🌍 **Global Edge Network** - Deploy to 200+ locations worldwide
- 🔧 **TypeScript First** - Full type safety for Workers environment
- 📊 **Built-in Rate Limiting** - Distributed rate limiting across edge
- 🛡️ **Security Headers** - Automatic client info extraction
- 🎯 **Zero Cold Start** - Instant execution at the edge

## Configuration

### Environment Variables

Set these in your `wrangler.toml` or Cloudflare Dashboard:

```toml
# wrangler.toml
[vars]
REDIS_PROXY_URL = "https://your-redis-proxy.example.com"
REDIS_TOKEN = "your-api-key-or-jwt"
REDIS_TIMEOUT = "2000"  # Very short timeout for Workers
REDIS_RETRIES = "1"     # Single retry for Workers

# KV namespace binding (optional)
[[kv_namespaces]]
binding = "REDIS_CACHE"
id = "your-kv-namespace-id"

# R2 bucket binding (optional)
[[r2_buckets]]
binding = "R2"
bucket_name = "your-r2-bucket"

# D1 database binding (optional)
[[d1_databases]]
binding = "DB"
database_name = "your-d1-database"
database_id = "your-d1-database-id"
```

### Programmatic Configuration

```typescript
import { createServerlessRedis, CloudflareRedisUtils } from '@scaler/serverless-redis-cloudflare';

// Basic configuration
const redis = createServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key',
  timeout: 2000,  // Short timeout for Workers
  retries: 1,     // Single retry
  compression: true,
}, env);

// Optimized configuration
const optimizedRedis = createServerlessRedis(
  CloudflareRedisUtils.getOptimizedConfig({
    url: env.REDIS_PROXY_URL,
    token: env.REDIS_TOKEN,
  }),
  env
);
```

## API Reference

### Functions

#### `createServerlessRedis(config?, env?)`

Creates a Redis client optimized for Cloudflare Workers.

```typescript
const redis = createServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key',
  timeout: 2000,    // Very short timeout for Workers
  retries: 1,       // Single retry
  compression: true // Enable compression
}, env);
```

#### `withRedis(handler)`

Wraps a Worker fetch handler with Redis client injection.

```typescript
export default withRedis(async (redis, request, env, ctx) => {
  const data = await redis.get('key');
  return new Response(JSON.stringify({ data }));
});
```

### Enhanced Client

#### `CloudflareRedis`

Extended client with Cloudflare-specific optimizations:

```typescript
const redis = new CloudflareRedis(config, env, ctx);

// KV-cached operations
const value = await redis.getWithCache('key', 300); // 5 min TTL
await redis.setWithCache('key', 'value', 300);
await redis.delWithCache('key');

// R2 large object storage
await redis.setLargeObject('large-key', largeData, { type: 'image' });
const object = await redis.getLargeObject('large-key');
```

### Utilities

#### `CloudflareRedisUtils`

Cloudflare-specific utility functions:

```typescript
import { CloudflareRedisUtils } from '@scaler/serverless-redis-cloudflare';

// Environment detection
CloudflareRedisUtils.isCloudflareWorker(); // true if running in Workers

// Client information extraction
const ip = CloudflareRedisUtils.getClientIP(request);
const country = CloudflareRedisUtils.getClientCountry(request);
const datacenter = CloudflareRedisUtils.getDataCenter(request);

// Rate limiting key generation
const rateLimitKey = CloudflareRedisUtils.createRateLimitKey(request, 'api');

// Optimized configuration
const config = CloudflareRedisUtils.getOptimizedConfig({
  url: env.REDIS_PROXY_URL,
  token: env.REDIS_TOKEN,
});

// CORS helpers
const corsResponse = CloudflareRedisUtils.corsResponse({ data: 'value' });
const corsPreflightResponse = CloudflareRedisUtils.handleCors(request);
```

#### `CloudflareRateLimit`

Distributed rate limiting across Cloudflare's edge:

```typescript
import { CloudflareRateLimit } from '@scaler/serverless-redis-cloudflare';

const rateLimit = new CloudflareRateLimit(redis, 100, 60); // 100 requests per minute

const key = CloudflareRedisUtils.createRateLimitKey(request);
const { allowed, remaining, resetIn } = await rateLimit.check(key);

if (!allowed) {
  return new Response('Rate limit exceeded', {
    status: 429,
    headers: {
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetIn.toString(),
    }
  });
}
```

## Examples

### API with Rate Limiting

```typescript
import { withRedis, CloudflareRedisUtils, CloudflareRateLimit } from '@scaler/serverless-redis-cloudflare';

export interface Env {
  REDIS_PROXY_URL: string;
  REDIS_TOKEN: string;
}

export default withRedis(async (redis, request, env, ctx) => {
  // Handle CORS preflight
  const corsResponse = CloudflareRedisUtils.handleCors(request);
  if (corsResponse) return corsResponse;
  
  // Rate limiting
  const rateLimit = new CloudflareRateLimit(redis, 60, 60); // 60 requests per minute
  const rateLimitKey = CloudflareRedisUtils.createRateLimitKey(request);
  
  const { allowed, remaining, resetIn } = await rateLimit.check(rateLimitKey);
  
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetIn.toString(),
      }
    });
  }
  
  // Your API logic here
  const data = await redis.get('api-data');
  
  return CloudflareRedisUtils.corsResponse({
    data,
    rateLimit: { remaining, resetIn }
  });
});
```

### Geo-distributed Caching

```typescript
import { CloudflareRedis, CloudflareRedisUtils } from '@scaler/serverless-redis-cloudflare';

export interface Env {
  REDIS_PROXY_URL: string;
  REDIS_TOKEN: string;
  REDIS_CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const redis = new CloudflareRedis({
      url: env.REDIS_PROXY_URL,
      token: env.REDIS_TOKEN,
    }, env, ctx);
    
    const url = new URL(request.url);
    const cacheKey = `page:${url.pathname}`;
    const country = CloudflareRedisUtils.getClientCountry(request);
    
    // Try country-specific cache first
    const countryKey = `${cacheKey}:${country}`;
    let content = await redis.getWithCache(countryKey, 300);
    
    if (!content) {
      // Fallback to global cache
      content = await redis.getWithCache(cacheKey, 600);
      
      if (!content) {
        // Generate content (expensive operation)
        content = await generateContent(url.pathname);
        
        // Cache globally
        await redis.setWithCache(cacheKey, content, 600);
      }
      
      // Customize for country and cache
      const localizedContent = localizeContent(content, country);
      await redis.setWithCache(countryKey, localizedContent, 300);
      content = localizedContent;
    }
    
    return new Response(content, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300',
        'CF-Cache-Status': 'HIT',
      }
    });
  }
};
```

### Large File Storage with R2

```typescript
import { CloudflareRedis } from '@scaler/serverless-redis-cloudflare';

export interface Env {
  REDIS_PROXY_URL: string;
  REDIS_TOKEN: string;
  R2: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const redis = new CloudflareRedis({
      url: env.REDIS_PROXY_URL,
      token: env.REDIS_TOKEN,
    }, env, ctx);
    
    const url = new URL(request.url);
    const fileId = url.pathname.split('/').pop();
    
    if (request.method === 'POST') {
      // Upload large file
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (file && file.size > 1024 * 1024) { // > 1MB
        // Store in R2 with Redis metadata
        await redis.setLargeObject(fileId!, file.stream(), {
          filename: file.name,
          contentType: file.type,
          size: file.size.toString(),
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          fileId,
          size: file.size 
        }));
      } else {
        // Store small files directly in Redis
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        await redis.set(fileId!, base64);
        
        return new Response(JSON.stringify({ 
          success: true, 
          fileId,
          stored: 'redis' 
        }));
      }
    }
    
    if (request.method === 'GET') {
      // Retrieve file
      const largeObject = await redis.getLargeObject(fileId!);
      
      if (largeObject) {
        // Large file from R2
        return new Response(largeObject.body, {
          headers: {
            'Content-Type': largeObject.customMetadata?.contentType || 'application/octet-stream',
            'Content-Length': largeObject.size?.toString() || '',
          }
        });
      } else {
        // Small file from Redis
        const base64 = await redis.get(fileId!);
        if (base64) {
          const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          return new Response(buffer);
        }
      }
      
      return new Response('File not found', { status: 404 });
    }
    
    return new Response('Method not allowed', { status: 405 });
  }
};
```

### Session Management with Analytics

```typescript
import { withRedis, CloudflareRedisUtils } from '@scaler/serverless-redis-cloudflare';

export interface Env {
  REDIS_PROXY_URL: string;
  REDIS_TOKEN: string;
  REDIS_CACHE: KVNamespace;
}

export default withRedis(async (redis, request, env, ctx) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session');
  
  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }
  
  const clientIP = CloudflareRedisUtils.getClientIP(request);
  const country = CloudflareRedisUtils.getClientCountry(request);
  const datacenter = CloudflareRedisUtils.getDataCenter(request);
  
  if (request.method === 'GET') {
    // Get session data
    const sessionData = await redis.hgetall(`session:${sessionId}`);
    
    // Update analytics in background
    ctx.waitUntil(
      redis.pipeline()
        .incr(`analytics:daily:${new Date().toISOString().split('T')[0]}`)
        .incr(`analytics:country:${country}`)
        .incr(`analytics:datacenter:${datacenter}`)
        .exec()
    );
    
    return CloudflareRedisUtils.corsResponse({
      sessionData,
      metadata: {
        ip: clientIP,
        country,
        datacenter,
      }
    });
  }
  
  if (request.method === 'POST') {
    const data = await request.json();
    
    // Update session
    await redis.pipeline()
      .hset(`session:${sessionId}`, ...Object.entries(data).flat())
      .expire(`session:${sessionId}`, 86400) // 24 hour TTL
      .exec();
    
    return CloudflareRedisUtils.corsResponse({ success: true });
  }
  
  return new Response('Method not allowed', { status: 405 });
});
```

## Performance Optimization

### Workers Runtime Limits

Cloudflare Workers have strict limits that this package automatically handles:

- **CPU Time**: 10ms (free) / 50ms (paid)
- **Memory**: 128MB
- **Execution Time**: 10s for HTTP requests
- **Subrequest Limit**: 50 per request

### Optimization Strategies

1. **Ultra-short timeouts** (2000ms default)
2. **Single retry** to minimize latency
3. **Automatic compression** for payload reduction
4. **KV caching** for frequently accessed data
5. **R2 integration** for large objects
6. **Background tasks** with `ctx.waitUntil()`

## Deployment

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Configure `wrangler.toml`**:
   ```toml
   name = "my-redis-worker"
   compatibility_date = "2023-10-25"
   
   [vars]
   REDIS_PROXY_URL = "https://your-proxy.example.com"
   REDIS_TOKEN = "your-api-key"
   ```

3. **Deploy**:
   ```bash
   wrangler deploy
   ```

Your Redis-powered Worker is now running on Cloudflare's global edge network!

## License

MIT License - see [LICENSE](../../../LICENSE) for details.