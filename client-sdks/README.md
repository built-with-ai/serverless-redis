# Serverless Redis Client SDKs

TypeScript/JavaScript client libraries for the Serverless Redis Proxy, optimized for serverless and edge computing environments.

## 📦 Published Packages

All packages are available on NPM under the `@builtwithai` organization:

### Core Package

- **[@builtwithai/serverless-redis-client](https://www.npmjs.com/package/@builtwithai/serverless-redis-client)** - Core TypeScript client with Redis-like API

### Framework-Specific Packages

- **[@builtwithai/serverless-redis-nextjs](https://www.npmjs.com/package/@builtwithai/serverless-redis-nextjs)** - Next.js integration utilities
- **[@builtwithai/serverless-redis-vercel](https://www.npmjs.com/package/@builtwithai/serverless-redis-vercel)** - Vercel Edge Functions support  
- **[@builtwithai/serverless-redis-cloudflare](https://www.npmjs.com/package/@builtwithai/serverless-redis-cloudflare)** - Cloudflare Workers utilities
- **[@builtwithai/serverless-redis-aws-lambda](https://www.npmjs.com/package/@builtwithai/serverless-redis-aws-lambda)** - AWS Lambda integration

### Examples

- **[examples](./packages/examples/)** - Complete usage examples for all platforms

## 🚀 Quick Start

### Installation

```bash
# Core client
npm install @builtwithai/serverless-redis-client

# Or framework-specific packages
npm install @builtwithai/serverless-redis-nextjs
npm install @builtwithai/serverless-redis-vercel  
npm install @builtwithai/serverless-redis-cloudflare
npm install @builtwithai/serverless-redis-aws-lambda
```

### Basic Usage

```typescript
import { ServerlessRedis } from '@builtwithai/serverless-redis-client';

const redis = new ServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key'
});

// Redis-like API
await redis.set('key', 'value');
const value = await redis.get('key');

// Pipeline operations
const results = await redis.pipeline()
  .set('key1', 'value1')
  .get('key1')
  .exec();
```

### Framework-Specific Usage

#### Next.js
```typescript
import { createServerlessRedis } from '@builtwithai/serverless-redis-nextjs';

const redis = createServerlessRedis({
  url: process.env.REDIS_PROXY_URL,
  token: process.env.REDIS_API_KEY
});
```

#### Vercel Edge Functions
```typescript
import { createVercelRedis } from '@builtwithai/serverless-redis-vercel';

const redis = createVercelRedis({
  url: process.env.REDIS_PROXY_URL,
  token: process.env.REDIS_API_KEY
});
```

#### Cloudflare Workers
```typescript
import { createWorkerRedis } from '@builtwithai/serverless-redis-cloudflare';

const redis = createWorkerRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key'
});
```

#### AWS Lambda
```typescript
import { createLambdaRedis } from '@builtwithai/serverless-redis-aws-lambda';

const redis = createLambdaRedis({
  url: process.env.REDIS_PROXY_URL,
  token: process.env.REDIS_API_KEY
});
```

## Features

- 🚀 **Redis-like API** - Familiar interface for Redis developers
- 📦 **Zero Dependencies** - Minimal bundle size for serverless environments
- 🔧 **TypeScript First** - Full type safety and excellent IntelliSense
- ⚡ **Edge Optimized** - Works in all serverless and edge runtimes
- 🔄 **Pipeline Support** - Batch multiple operations efficiently
- 🛡️ **Error Handling** - Proper Redis error semantics over HTTP
- 🔌 **Framework Integration** - Purpose-built integrations for popular platforms

## Development

This is a monorepo managed with NPM workspaces.

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test

# Lint all packages
npm run lint

# Type check all packages
npm run type-check
```

## Architecture

The client SDKs communicate with the Serverless Redis Proxy via HTTP/REST API, providing:

- Automatic connection management and retries
- Request/response compression
- Pipeline and transaction support
- Framework-specific optimizations
- Comprehensive error handling

## License

MIT License - see [LICENSE](../LICENSE) for details.