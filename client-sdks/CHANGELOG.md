# Changelog

All notable changes to the Serverless Redis Client SDKs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-01-XX

### Added

#### Core Client (`@builtwithai/serverless-redis-client`)
- Initial release of TypeScript Redis client for serverless environments
- Complete Redis-compatible API with type safety
- HTTP-based communication optimized for serverless platforms
- Pipeline operations for batched commands
- Transaction support with MULTI/EXEC semantics
- Comprehensive error handling with Redis error types
- Request/response interceptors for middleware integration
- Automatic retry logic with exponential backoff and jitter
- Built-in compression support for reduced bandwidth usage
- Configurable timeouts and connection management
- Health check and monitoring endpoints
- Value serialization/deserialization for complex data types

#### Next.js Integration (`@builtwithai/serverless-redis-nextjs`)
- Seamless integration with Next.js App Router and Pages Router
- Automatic environment variable configuration
- Edge Runtime and Node.js runtime optimizations
- Built-in API route helpers with error handling
- Middleware support for request injection
- React hooks for client-side usage
- Global client instance management for performance
- Runtime detection utilities (Edge vs Node.js)
- CORS handling utilities
- Server-side rendering compatibility

#### Vercel Integration (`@scaler/serverless-redis-vercel`)
- Optimized for Vercel Edge Functions and serverless functions
- Automatic runtime detection and configuration
- Environment-specific optimizations (production/preview/development)
- CORS utilities for cross-origin API requests
- Request wrapper with automatic error handling
- Middleware integration for request injection
- Performance optimizations for edge computing
- Built-in timeout management for edge constraints
- Client information extraction from Vercel headers

#### Cloudflare Workers Integration (`@scaler/serverless-redis-cloudflare`)
- Ultra-low latency optimizations for Workers runtime
- KV namespace integration for automatic caching
- R2 bucket integration for large object storage
- Enhanced Redis client with caching layer
- Client information extraction from Cloudflare headers (IP, country, datacenter)
- Distributed rate limiting across edge locations
- Support for Durable Objects integration
- Worker-specific error handling and timeouts
- Global edge network optimizations
- Background task support with `waitUntil()`

#### AWS Lambda Integration (`@scaler/serverless-redis-aws-lambda`)
- API Gateway v1 (REST API) and v2 (HTTP API) support
- Generic Lambda handler wrapper for any event type
- Memory-based timeout scaling and optimization
- Lambda context utilities and function information extraction
- Container reuse optimizations with global client instances
- Middy.js middleware compatibility
- Client information extraction from API Gateway events
- CORS handling for API Gateway responses
- Event parsing utilities for Lambda events
- Rate limiting utilities with Redis backend

### Development & Tooling
- Comprehensive monorepo structure with NPM workspaces
- Shared TypeScript configuration across all packages
- Rollup build system with ESM and CommonJS outputs
- Jest testing framework with coverage reporting
- ESLint and Prettier for code quality
- GitHub Actions CI/CD pipeline
- Automated testing on multiple Node.js versions
- Integration testing with Redis proxy
- Security scanning and license checking
- Automated NPM publishing with version management
- Changeset-based version management
- Docker Compose setup for local development

### Documentation & Examples
- Comprehensive README files for each package
- API reference documentation with TypeScript signatures
- Real-world examples for all supported platforms
- Getting started guides and quick start examples
- Performance optimization guides
- Best practices documentation
- Deployment guides for each platform
- Interactive examples with Next.js
- Session management examples
- Rate limiting implementations
- Caching layer examples
- Real-time application examples

### Testing & Quality Assurance
- Unit tests for all core functionality
- Integration tests with real Redis instances
- End-to-end testing scenarios
- Mock clients for unit testing
- Performance benchmarks and load testing
- Browser compatibility testing
- Edge runtime compatibility verification
- Error handling and edge case coverage
- Security vulnerability scanning
- License compliance checking

### Performance Features
- **Runtime-specific optimizations**: Timeout and retry configurations adapted to each platform's constraints
- **HTTP/2 support**: Efficient multiplexing for concurrent requests
- **Compression**: Automatic payload compression to reduce bandwidth usage
- **Connection pooling**: Efficient HTTP connection reuse across requests
- **Caching integrations**: Platform-specific caching (KV, R2, etc.)
- **Pipeline operations**: Batch multiple Redis commands to reduce round-trips
- **Edge computing**: Global deployment and edge-optimized configurations
- **Memory management**: Optimized for serverless memory constraints

### Security Features
- **Authentication**: Support for API keys and JWT tokens
- **Input validation**: Comprehensive request validation and sanitization
- **Error handling**: Secure error messages without information leakage
- **CORS support**: Configurable cross-origin request handling
- **Rate limiting**: Built-in and platform-specific rate limiting
- **Secure defaults**: Security-first configuration defaults

### Compatibility
- ✅ Node.js 16+ (LTS)
- ✅ Modern browsers (ES2020+)
- ✅ Vercel Edge Functions
- ✅ Cloudflare Workers
- ✅ AWS Lambda (all runtimes)
- ✅ Next.js 12+ (App Router and Pages Router)
- ✅ Deno runtime
- ✅ Bun runtime

### Breaking Changes
- None (initial release)

### Migration Guide
- None (initial release)

### Known Issues
- None identified

### Contributors
- Scaler Team

---

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

### For Maintainers

1. **Creating a changeset**: Run `npm run changeset` after making changes
2. **Version bumping**: Run `npm run version-packages` to consume changesets and update versions
3. **Publishing**: Run `npm run release` to publish updated packages
4. **Manual publishing**: Use `./scripts/publish.sh` for manual control

### Version Strategy

- **Major (1.0.0)**: Breaking changes, new platform support, major feature additions
- **Minor (0.1.0)**: New features, platform optimizations, significant improvements
- **Patch (0.0.1)**: Bug fixes, performance improvements, documentation updates

All packages in this monorepo are released together with synchronized versions to ensure compatibility.