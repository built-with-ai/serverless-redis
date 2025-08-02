# Serverless Redis Client Examples

This directory contains comprehensive examples demonstrating how to use the Serverless Redis Client SDKs across different serverless platforms and use cases.

## 📁 Directory Structure

```
examples/
├── nextjs/              # Next.js examples
├── vercel/              # Vercel Edge Functions examples  
├── cloudflare/          # Cloudflare Workers examples
├── aws-lambda/          # AWS Lambda examples
├── common/              # Shared utilities and types
└── docker-compose.yml   # Local Redis proxy for testing
```

## 🚀 Getting Started

1. **Start the Redis proxy locally**:
   ```bash
   docker-compose up -d
   ```

2. **Install dependencies**:
   ```bash
   cd examples
   npm install
   ```

3. **Set environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run examples**:
   ```bash
   # Next.js examples
   cd nextjs && npm run dev

   # Vercel examples  
   cd vercel && vercel dev

   # Cloudflare examples
   cd cloudflare && npm run dev

   # AWS Lambda examples
   cd aws-lambda && npm run start
   ```

## 📋 Example Categories

### 🔧 Basic Operations
- **CRUD operations** - Create, read, update, delete data
- **Data types** - Strings, hashes, lists, sets, sorted sets
- **Expiration** - TTL and expiration handling
- **Transactions** - Multi-command atomic operations
- **Pipelines** - Batch operations for performance

### 🏗️ Real-World Applications  
- **Session management** - User sessions with Redis
- **Caching layer** - API response caching
- **Rate limiting** - Request throttling and quotas
- **Real-time features** - Pub/sub, notifications
- **Analytics** - Event tracking and metrics
- **Content management** - Dynamic content delivery

### 🔐 Security & Auth
- **Authentication** - JWT tokens and API keys
- **Authorization** - Role-based access control
- **Input validation** - Request sanitization
- **CORS handling** - Cross-origin requests

### 📊 Performance & Monitoring
- **Connection pooling** - Efficient resource usage
- **Error handling** - Graceful failure management  
- **Metrics collection** - Performance monitoring
- **Health checks** - Service availability

## 🌐 Platform-Specific Features

### Next.js
- **App Router** examples with server components
- **API Routes** with middleware integration
- **Edge Runtime** optimizations
- **SSR/SSG** with Redis data fetching

### Vercel
- **Edge Functions** with global deployment
- **Environment detection** (production/preview/dev)
- **KV integration** for enhanced caching
- **Analytics** with Vercel's platform features

### Cloudflare Workers
- **Edge computing** with global distribution
- **KV storage** integration for caching
- **R2 storage** for large objects
- **Durable Objects** for stateful operations
- **Geographic routing** and data locality

### AWS Lambda
- **API Gateway** integration (v1 and v2)
- **EventBridge** event processing
- **S3 triggers** for data processing
- **Step Functions** workflow coordination
- **CloudWatch** monitoring and logging

## 🛠️ Development Tools

- **TypeScript** - Full type safety across examples
- **ESLint** - Code quality and consistency
- **Prettier** - Code formatting
- **Jest** - Unit testing framework
- **Docker** - Local development environment

## 📖 Learn More

Each example includes:
- **README.md** - Setup and usage instructions
- **Source code** - Well-commented implementation
- **Tests** - Unit and integration tests  
- **Deployment** - Platform-specific deployment guides
- **Performance** - Optimization tips and benchmarks

## 🤝 Contributing

Want to add more examples? See our [Contributing Guide](../CONTRIBUTING.md) for guidelines on:
- Code style and structure
- Testing requirements
- Documentation standards
- Submission process