# Serverless Redis Proxy

🚀 **High-performance HTTP-to-Redis proxy designed for serverless applications**

[![Go Version](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Available-blue.svg)](Dockerfile)

## 🎯 Features

- **Multi-Engine Support**: Redis, Valkey, and DragonflyDB 
- **Single Binary**: Easy deployment, no external dependencies
- **Full Redis Compatibility**: Support for all Redis commands and data types
- **Smart Connection Pooling**: Intelligent connection management and reuse
- **Pipeline Optimization**: Batch multiple commands in single HTTP request
- **Authentication & Security**: JWT, API keys, tenant isolation, rate limiting
- **Observability**: Prometheus metrics, health checks, performance monitoring
- **Developer Friendly**: RESTful API with comprehensive error handling

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/2    ┌─────────────────┐    Redis Protocol    ┌─────────────────┐
│  Serverless     │ ──────────►  │   Proxy Layer   │ ─────────────────►   │ Redis/Dragonfly │
│  Applications   │              │                 │                      │    Cluster      │
│                 │ ◄──────────  │  - Auth         │ ◄─────────────────   │                 │
│ - Next.js       │    JSON      │  - Pool Mgmt    │   Native Protocol    │ - Redis Stack   │
│ - Lambda        │              │  - Protocol     │                      │ - Valkey        │
│ - Workers       │              │    Translation  │                      │ - DragonflyDB   │
└─────────────────┘              └─────────────────┘                      └─────────────────┘
```

## 🚀 Quick Start

### Option 1: Binary Release
```bash
# Download latest release
curl -L https://github.com/scaler/serverless-redis/releases/latest/download/serverless-redis-linux-amd64 \
  -o serverless-redis && chmod +x serverless-redis

# Run with default config
./serverless-redis
```

### Option 2: Docker
```bash
# Run with Docker
docker run -p 8080:8080 \
  -e REDIS_URL=redis://localhost:6379 \
  -e JWT_SECRET=your-secret-key \
  scaler/serverless-redis:latest
```

### Option 3: Build from Source
```bash
# Clone repository
git clone https://github.com/scaler/serverless-redis.git
cd serverless-redis

# Build and run
make build
./serverless-redis
```

## 📖 API Usage

### Single Command
```bash
curl -X POST http://localhost:8080/v1/command \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "SET",
    "args": ["key", "value"]
  }'

# Response:
# {"result": "OK", "type": "string", "time": 1.2}
```

### Pipeline (Batch Commands)
```bash
curl -X POST http://localhost:8080/v1/pipeline \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "SET", "args": ["key1", "value1"]},
      {"command": "SET", "args": ["key2", "value2"]},
      {"command": "MGET", "args": ["key1", "key2"]}
    ]
  }'

# Response:
# {
#   "results": [
#     {"result": "OK", "type": "string"},
#     {"result": "OK", "type": "string"},
#     {"result": ["value1", "value2"], "type": "array"}
#   ],
#   "time": 2.1,
#   "count": 3
# }
```

### Transaction
```bash
curl -X POST http://localhost:8080/v1/transaction \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "INCR", "args": ["counter"]},
      {"command": "GET", "args": ["counter"]}
    ],
    "watch": ["counter"]
  }'
```

## ⚙️ Configuration

Create `config.yaml`:

```yaml
server:
  port: 8080
  host: "0.0.0.0"

redis:
  primary:
    addr: "localhost:6379"
    password: ""
    db: 0
  
  # Optional: DragonflyDB for high performance
  dragonfly:
    enabled: true
    addr: "localhost:6380"

pool:
  min_idle_conns: 5
  max_idle_conns: 100
  max_active_conns: 1000
  idle_timeout: 300s

auth:
  enabled: true
  jwt_secret: "your-jwt-secret-key"
  api_keys:
    - key: "your-api-key"
      tenant_id: "default"
      rate_limit: 1000
      allowed_dbs: [0, 1, 2]
      permissions: ["*"]

metrics:
  enabled: true
  path: "/metrics"
```

### Environment Variables
```bash
export PORT=8080
export REDIS_URL=redis://localhost:6379
export REDIS_PASSWORD=your-password
export JWT_SECRET=your-jwt-secret
export DRAGONFLY_URL=redis://localhost:6380
```

## 🔒 Authentication

### API Key Authentication
```bash
# Header-based
curl -H "Authorization: Bearer your-api-key" http://localhost:8080/v1/command

# Basic Auth
curl -u tenant_id:your-api-key http://localhost:8080/v1/command
```

### JWT Authentication
```bash
# Generate JWT token (example using server endpoint)
curl -X POST http://localhost:8080/auth/token \
  -d '{"tenant_id": "user123", "duration": "24h"}'

# Use JWT token
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." http://localhost:8080/v1/command
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:8080/health

# Response:
# {
#   "status": "healthy",
#   "version": "1.0.0",
#   "connections": {"primary_total_conns": 10},
#   "uptime": 3600,
#   "memory": {"alloc": 1048576}
# }
```

### Prometheus Metrics
```bash
curl http://localhost:8080/metrics

# Key metrics:
# redis_proxy_http_requests_total
# redis_proxy_redis_latency_seconds
# redis_proxy_pool_connections
# redis_proxy_memory_usage_bytes
```

## 📦 Client SDKs 

We provide official TypeScript/JavaScript client libraries for seamless integration:

### Core Client
```bash
npm install @builtwithai/serverless-redis-client
```

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

### Client SDK Features

- **🚀 Redis-like API** - Familiar interface for Redis developers
- **📦 Zero Dependencies** - Minimal bundle size for serverless environments  
- **🔧 TypeScript First** - Full type safety and excellent IntelliSense
- **⚡ Edge Optimized** - Works in all serverless and edge runtimes
- **🔄 Pipeline Support** - Batch multiple operations efficiently
- **🛡️ Error Handling** - Proper Redis error semantics over HTTP
- **🔌 Framework Integration** - Purpose-built integrations for popular platforms

### All Available Packages

| Package                                                                                                            | Version                                                                       | Description                                |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------ |
| [@builtwithai/serverless-redis-client](https://www.npmjs.com/package/@builtwithai/serverless-redis-client)         | ![npm](https://img.shields.io/npm/v/@builtwithai/serverless-redis-client)     | Core TypeScript client with Redis-like API |
| [@builtwithai/serverless-redis-nextjs](https://www.npmjs.com/package/@builtwithai/serverless-redis-nextjs)         | ![npm](https://img.shields.io/npm/v/@builtwithai/serverless-redis-nextjs)     | Next.js integration utilities              |
| [@builtwithai/serverless-redis-vercel](https://www.npmjs.com/package/@builtwithai/serverless-redis-vercel)         | ![npm](https://img.shields.io/npm/v/@builtwithai/serverless-redis-vercel)     | Vercel Edge Functions support              |
| [@builtwithai/serverless-redis-cloudflare](https://www.npmjs.com/package/@builtwithai/serverless-redis-cloudflare) | ![npm](https://img.shields.io/npm/v/@builtwithai/serverless-redis-cloudflare) | Cloudflare Workers utilities               |
| [@builtwithai/serverless-redis-aws-lambda](https://www.npmjs.com/package/@builtwithai/serverless-redis-aws-lambda) | ![npm](https://img.shields.io/npm/v/@builtwithai/serverless-redis-aws-lambda) | AWS Lambda integration                     |

### Framework-Specific Packages

#### Next.js Integration
```bash
npm install @builtwithai/serverless-redis-nextjs
```

```typescript
import { createServerlessRedis } from '@builtwithai/serverless-redis-nextjs';

const redis = createServerlessRedis({
  url: process.env.REDIS_PROXY_URL,
  token: process.env.REDIS_API_KEY
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await redis.set('user:123', JSON.stringify({ name: 'John' }));
  const user = await redis.get('user:123');
  res.json({ user: JSON.parse(user!) });
}
```

#### AWS Lambda Integration
```bash
npm install @builtwithai/serverless-redis-aws-lambda
```

```typescript
import { createLambdaRedis } from '@builtwithai/serverless-redis-aws-lambda';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const redis = createLambdaRedis({
  url: process.env.REDIS_PROXY_URL!,
  token: process.env.REDIS_API_KEY!
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Use Redis
  await redis.set('key', 'value');
  const value = await redis.get('key');
  
  return {
    statusCode: 200,
    body: JSON.stringify({ value })
  };
};
```

#### Vercel Edge Functions
```bash
npm install @builtwithai/serverless-redis-vercel
```

```typescript
import { createVercelRedis } from '@builtwithai/serverless-redis-vercel';

const redis = createVercelRedis({
  url: process.env.REDIS_PROXY_URL!,
  token: process.env.REDIS_API_KEY!
});

export default async function handler(request: Request) {
  await redis.set('edge-key', 'edge-value');
  const value = await redis.get('edge-key');
  
  return new Response(JSON.stringify({ value }), {
    headers: { 'content-type': 'application/json' }
  });
}
```

#### Cloudflare Workers
```bash
npm install @builtwithai/serverless-redis-cloudflare
```

```typescript
import { createWorkerRedis } from '@builtwithai/serverless-redis-cloudflare';

const redis = createWorkerRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key'
});

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    await redis.set('worker-key', 'worker-value');
    const value = await redis.get('worker-key');
    
    return new Response(JSON.stringify({ value }), {
      headers: { 'content-type': 'application/json' }
    });
  }
};

## 🔧 Development

```bash
# Setup development environment
make setup

# Run with hot reload
make dev

# Run tests
make test

# Run with coverage
make test-coverage

# Lint code
make lint

# Format code
make fmt

# Build for production
make build-prod
```

## 📈 Performance

- **Latency**: Sub-millisecond Redis command execution
- **Throughput**: 10,000+ requests/second per instance
- **Connections**: Efficient pooling with configurable limits
- **Memory**: Optimized for low memory footprint

### Benchmarks
```bash
# Load test
make load-test

# Benchmarks
make bench
```

## 🐳 Docker Compose Example

```yaml
version: '3.8'
services:
  serverless-redis:
    image: scaler/serverless-redis:latest
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-secret-key
    depends_on:
      - redis
      - dragonfly

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  dragonfly:
    image: docker.dragonflydb.io/dragonflydb/dragonfly:latest
    ports:
      - "6380:6379"
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

