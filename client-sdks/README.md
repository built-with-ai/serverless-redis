# Serverless Redis Client SDKs

TypeScript/JavaScript client libraries for the Serverless Redis Proxy, optimized for serverless and edge computing environments.

## Packages

### Core Packages

- **[@scaler/serverless-redis-client](./packages/core/)** - Core TypeScript client with Redis-like API
- **[@scaler/serverless-redis-nextjs](./packages/nextjs/)** - Next.js integration utilities
- **[@scaler/serverless-redis-vercel](./packages/vercel/)** - Vercel Edge Functions support
- **[@scaler/serverless-redis-cloudflare](./packages/cloudflare/)** - Cloudflare Workers utilities
- **[@scaler/serverless-redis-aws](./packages/aws-lambda/)** - AWS Lambda integration

### Examples

- **[examples](./packages/examples/)** - Complete usage examples for all platforms

## Quick Start

```bash
npm install @scaler/serverless-redis-client
```

```typescript
import { ServerlessRedis } from '@scaler/serverless-redis-client';

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