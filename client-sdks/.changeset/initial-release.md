---
"@builtwithai/serverless-redis-client": major
"@builtwithai/serverless-redis-nextjs": major
"@builtwithai/serverless-redis-vercel": major
"@builtwithai/serverless-redis-cloudflare": major
"@builtwithai/serverless-redis-aws-lambda": major
---

Initial release of Serverless Redis Client SDKs

This is the first major release of the Serverless Redis Client SDK ecosystem, providing comprehensive TypeScript/JavaScript clients for serverless platforms.

## Features

### Core Client (`@builtwithai/serverless-redis-client`)
- Redis-compatible API with full TypeScript support
- HTTP-based communication optimized for serverless environments
- Pipeline and transaction support for batched operations
- Comprehensive error handling with Redis error semantics
- Request/response interceptors for middleware integration
- Automatic retry logic with exponential backoff
- Built-in compression and timeout handling

### Platform-Specific Integrations

#### Next.js (`@builtwithai/serverless-redis-nextjs`)
- Seamless integration with Next.js App Router and Pages Router
- Edge Runtime and Node.js runtime optimizations
- Built-in environment variable configuration
- API route helpers and middleware
- Server-side rendering support

#### Vercel (`@builtwithai/serverless-redis-vercel`)
- Optimized for Vercel Edge Functions
- Automatic runtime detection and configuration
- CORS utilities for cross-origin requests
- Environment-specific optimizations (production/preview/development)

#### Cloudflare Workers (`@builtwithai/serverless-redis-cloudflare`)
- Ultra-low latency optimizations for Workers runtime
- KV integration for automatic caching
- R2 storage for large objects
- Client information extraction from Cloudflare headers
- Distributed rate limiting across edge locations

#### AWS Lambda (`@builtwithai/serverless-redis-aws-lambda`)
- API Gateway v1 and v2 support
- Memory-based timeout scaling
- Lambda context utilities
- Container reuse optimizations
- Middy.js middleware compatibility

## Performance Optimizations

- **Runtime-specific timeouts**: Automatically adjusted based on platform constraints
- **Connection pooling**: Efficient HTTP connection reuse
- **Compression**: Automatic payload compression for reduced bandwidth
- **Caching**: Platform-specific caching integrations (KV, etc.)
- **Edge computing**: Optimized for global edge deployment

## Developer Experience

- **Zero configuration**: Works out of the box with environment variables
- **Type safety**: Full TypeScript support with IntelliSense
- **Familiar API**: Redis-like interface for easy migration
- **Comprehensive docs**: Examples for all major use cases
- **Testing utilities**: Mock clients for unit testing

## Compatibility

- ✅ Node.js 16+
- ✅ Modern browsers
- ✅ Vercel Edge Functions
- ✅ Cloudflare Workers
- ✅ AWS Lambda
- ✅ Deno
- ✅ Bun

## Getting Started

```bash
# Core client
npm install @builtwithai/serverless-redis-client

# Platform-specific packages
npm install @builtwithai/serverless-redis-nextjs
npm install @builtwithai/serverless-redis-vercel
npm install @builtwithai/serverless-redis-cloudflare
npm install @builtwithai/serverless-redis-aws-lambda
```

See the documentation for detailed usage examples and platform-specific guides.