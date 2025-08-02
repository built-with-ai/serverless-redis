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

## 🚀 Serverless Integration

### Next.js (Vercel)
```typescript
// lib/redis.ts
class ServerlessRedis {
  private baseURL: string;
  private apiKey: string;

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  async set(key: string, value: string): Promise<string> {
    const response = await fetch(`${this.baseURL}/v1/command`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: 'SET',
        args: [key, value]
      })
    });
    
    const data = await response.json();
    return data.result;
  }

  async get(key: string): Promise<string | null> {
    const response = await fetch(`${this.baseURL}/v1/command`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: 'GET',
        args: [key]
      })
    });
    
    const data = await response.json();
    return data.result;
  }

  async pipeline(commands: Array<{command: string, args: any[]}>): Promise<any[]> {
    const response = await fetch(`${this.baseURL}/v1/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands })
    });
    
    const data = await response.json();
    return data.results.map((r: any) => r.result);
  }
}

// Usage in API route
const redis = new ServerlessRedis(
  process.env.REDIS_PROXY_URL!,
  process.env.REDIS_API_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await redis.set('user:123', JSON.stringify({ name: 'John' }));
  const user = await redis.get('user:123');
  res.json({ user: JSON.parse(user!) });
}
```

### AWS Lambda
```python
import json
import requests
import os

class ServerlessRedis:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def execute_command(self, command, args):
        response = requests.post(
            f'{self.base_url}/v1/command',
            headers=self.headers,
            json={'command': command, 'args': args}
        )
        return response.json()['result']
    
    def pipeline(self, commands):
        response = requests.post(
            f'{self.base_url}/v1/pipeline',
            headers=self.headers,
            json={'commands': commands}
        )
        return [r['result'] for r in response.json()['results']]

def lambda_handler(event, context):
    redis = ServerlessRedis(
        os.environ['REDIS_PROXY_URL'],
        os.environ['REDIS_API_KEY']
    )
    
    # Use Redis
    redis.execute_command('SET', ['key', 'value'])
    value = redis.execute_command('GET', ['key'])
    
    return {
        'statusCode': 200,
        'body': json.dumps({'value': value})
    }
```

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

## 🆘 Support

- 📖 [Documentation](https://github.com/scaler/serverless-redis/wiki)
- 🐛 [Issues](https://github.com/scaler/serverless-redis/issues)
- 💬 [Discussions](https://github.com/scaler/serverless-redis/discussions)

---

**Built with ❤️ for the serverless community**