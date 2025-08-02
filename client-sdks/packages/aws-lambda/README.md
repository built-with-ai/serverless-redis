# @scaler/serverless-redis-aws-lambda

AWS Lambda integration for the Serverless Redis Client, optimized for Lambda's execution model and API Gateway integration.

## Installation

```bash
npm install @scaler/serverless-redis-aws-lambda
```

## Quick Start

### API Gateway REST API (v1)

```typescript
// handler.ts
import { withRedis } from '@scaler/serverless-redis-aws-lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = withRedis(async (redis, event, context) => {
  const { key } = event.pathParameters || {};
  
  if (event.httpMethod === 'GET') {
    const value = await redis.get(key!);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ key, value }),
    };
  }
  
  if (event.httpMethod === 'POST') {
    const { value } = JSON.parse(event.body || '{}');
    await redis.set(key!, value);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ success: true, key, value }),
    };
  }
  
  return {
    statusCode: 405,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
});
```

### API Gateway HTTP API (v2)

```typescript
// handler.ts
import { withRedisV2 } from '@scaler/serverless-redis-aws-lambda';

export const handler = withRedisV2(async (redis, event, context) => {
  const key = event.pathParameters?.key;
  const method = event.requestContext.http.method;
  
  if (method === 'GET') {
    const value = await redis.get(key!);
    return { key, value }; // Automatically wrapped in JSON response
  }
  
  if (method === 'POST') {
    const { value } = JSON.parse(event.body || '{}');
    await redis.set(key!, value);
    return { success: true, key, value };
  }
  
  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
});
```

### Generic Lambda Handler

```typescript
// handler.ts
import { withRedisGeneric } from '@scaler/serverless-redis-aws-lambda';

interface MyEvent {
  action: string;
  key: string;
  value?: string;
}

interface MyResponse {
  success: boolean;
  data?: any;
}

export const handler = withRedisGeneric<MyEvent, MyResponse>(async (redis, event, context) => {
  switch (event.action) {
    case 'get':
      const value = await redis.get(event.key);
      return { success: true, data: { key: event.key, value } };
      
    case 'set':
      await redis.set(event.key, event.value!);
      return { success: true, data: { key: event.key, value: event.value } };
      
    default:
      return { success: false };
  }
});
```

## Features

- 🚀 **Lambda Optimized** - Designed for AWS Lambda's execution model
- 📦 **API Gateway Ready** - Built-in support for v1 and v2 APIs
- 🔄 **Container Reuse** - Global client instance for warm starts
- 🎯 **TypeScript First** - Full type safety with AWS Lambda types
- 📊 **Auto-Configuration** - Reads from Lambda environment variables
- 🛡️ **Error Handling** - Proper error responses for API Gateway
- 🔧 **Middleware Support** - Compatible with Middy.js and custom middleware
- ⚡ **Memory Optimized** - Configures timeouts based on Lambda memory

## Configuration

### Environment Variables

Set these in your Lambda function configuration:

```bash
REDIS_PROXY_URL=https://your-redis-proxy.example.com
REDIS_TOKEN=your-api-key-or-jwt
REDIS_TIMEOUT=10000  # Optional: timeout in ms (default: 10000)
REDIS_RETRIES=3      # Optional: retry attempts (default: 3)
REDIS_DB=0           # Optional: Redis database number
```

### Programmatic Configuration

```typescript
import { createServerlessRedis, LambdaRedisUtils } from '@scaler/serverless-redis-aws-lambda';

// Basic configuration
const redis = createServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key',
  timeout: 10000,
  retries: 3,
  compression: true,
});

// Optimized configuration based on Lambda memory
const optimizedRedis = createServerlessRedis(
  LambdaRedisUtils.getOptimizedConfig({
    url: process.env.REDIS_PROXY_URL,
    token: process.env.REDIS_TOKEN,
  })
);
```

## API Reference

### Functions

#### `createServerlessRedis(config?)`

Creates a Redis client optimized for AWS Lambda.

```typescript
const redis = createServerlessRedis({
  url: 'https://your-proxy.example.com',
  token: 'your-api-key',
  timeout: 10000,   // 10s timeout for Lambda
  retries: 3,       // Standard retries
  compression: true // Reduce payload size
});
```

#### `getServerlessRedis(config?)`

Gets or creates a global Redis client instance (recommended for performance).

```typescript
const redis = getServerlessRedis();
```

#### `withRedis(handler)` - API Gateway v1

Wraps an API Gateway REST API handler with Redis client injection.

```typescript
export const handler = withRedis(async (redis, event, context) => {
  // Your logic here
  const data = await redis.get('key');
  
  return {
    statusCode: 200,
    body: JSON.stringify({ data }),
  };
});
```

#### `withRedisV2(handler)` - API Gateway v2

Wraps an API Gateway HTTP API handler with Redis client injection.

```typescript
export const handler = withRedisV2(async (redis, event, context) => {
  // Your logic here
  const data = await redis.get('key');
  
  // Return object is automatically wrapped in JSON response
  return { data };
});
```

#### `withRedisGeneric(handler)` - Any Event Type

Wraps any Lambda handler with Redis client injection.

```typescript
export const handler = withRedisGeneric<MyEvent, MyResponse>(async (redis, event, context) => {
  // Handle any event type
  return await processEvent(redis, event);
});
```

### Utilities

#### `LambdaRedisUtils`

AWS Lambda-specific utility functions:

```typescript
import { LambdaRedisUtils } from '@scaler/serverless-redis-aws-lambda';

// Environment detection
LambdaRedisUtils.isLambda(); // true if running in Lambda

// Function information
const info = LambdaRedisUtils.getFunctionInfo();
console.log(info.name, info.version, info.memorySize, info.region);

// Client information from API Gateway events
const ip = LambdaRedisUtils.getClientIP(event);
const userAgent = LambdaRedisUtils.getUserAgent(event);

// Rate limiting key generation
const rateLimitKey = LambdaRedisUtils.createRateLimitKey(event, 'api');

// Optimized configuration
const config = LambdaRedisUtils.getOptimizedConfig({
  url: process.env.REDIS_PROXY_URL,
  token: process.env.REDIS_TOKEN,
});

// Event parsing helpers
const body = LambdaRedisUtils.parseBody(event);
const queryParams = LambdaRedisUtils.getQueryParams(event);
const pathParams = LambdaRedisUtils.getPathParams(event);

// CORS responses
const corsResponse = LambdaRedisUtils.corsResponse({ data: 'value' });
const corsV2Response = LambdaRedisUtils.corsResponseV2({ data: 'value' });

// CORS preflight handling
const corsResult = LambdaRedisUtils.handleCors(event);
const corsV2Result = LambdaRedisUtils.handleCorsV2(eventV2);
```

#### `LambdaRateLimit`

Rate limiting for Lambda functions:

```typescript
import { LambdaRateLimit } from '@scaler/serverless-redis-aws-lambda';

const rateLimit = new LambdaRateLimit(redis, 100, 60); // 100 requests per minute

const key = LambdaRedisUtils.createRateLimitKey(event);
const { allowed, remaining, resetIn } = await rateLimit.check(key);

if (!allowed) {
  return {
    statusCode: 429,
    body: JSON.stringify({ error: 'Rate limit exceeded' }),
    headers: {
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetIn.toString(),
    },
  };
}
```

## Examples

### User API with CRUD Operations

```typescript
// users.ts
import { withRedis, LambdaRedisUtils } from '@scaler/serverless-redis-aws-lambda';

export const handler = withRedis(async (redis, event, context) => {
  // Handle CORS preflight
  const corsResponse = LambdaRedisUtils.handleCors(event);
  if (corsResponse) return corsResponse;
  
  const { userId } = event.pathParameters || {};
  const method = event.httpMethod;
  
  switch (method) {
    case 'GET':
      const user = await redis.hgetall(`user:${userId}`);
      return LambdaRedisUtils.corsResponse({ user });
      
    case 'POST':
    case 'PUT':
      const userData = LambdaRedisUtils.parseBody(event);
      await redis.hset(`user:${userId}`, ...Object.entries(userData).flat());
      return LambdaRedisUtils.corsResponse({ success: true, userId, userData });
      
    case 'DELETE':
      await redis.del(`user:${userId}`);
      return LambdaRedisUtils.corsResponse({ success: true, userId });
      
    default:
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
  }
});
```

### Session Management API

```typescript
// sessions.ts
import { withRedisV2, LambdaRedisUtils } from '@scaler/serverless-redis-aws-lambda';

export const handler = withRedisV2(async (redis, event, context) => {
  const { sessionId } = event.pathParameters || {};
  const method = event.requestContext.http.method;
  
  if (method === 'GET') {
    const sessionData = await redis.hgetall(`session:${sessionId}`);
    const ttl = await redis.ttl(`session:${sessionId}`);
    
    return {
      sessionData,
      expiresIn: ttl,
      clientInfo: {
        ip: LambdaRedisUtils.getClientIP(event),
        userAgent: LambdaRedisUtils.getUserAgent(event),
      }
    };
  }
  
  if (method === 'POST') {
    const sessionData = LambdaRedisUtils.parseBody(event);
    
    // Use pipeline for atomic operations
    await redis.pipeline()
      .hset(`session:${sessionId}`, ...Object.entries(sessionData).flat())
      .expire(`session:${sessionId}`, 3600) // 1 hour TTL
      .exec();
    
    return { success: true, sessionId, expiresIn: 3600 };
  }
  
  if (method === 'DELETE') {
    await redis.del(`session:${sessionId}`);
    return { success: true, sessionId };
  }
  
  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
});
```

### Rate-Limited API

```typescript
// api.ts
import { withRedis, LambdaRedisUtils, LambdaRateLimit } from '@scaler/serverless-redis-aws-lambda';

export const handler = withRedis(async (redis, event, context) => {
  // Rate limiting
  const rateLimit = new LambdaRateLimit(redis, 100, 60); // 100 requests per minute
  const clientIP = LambdaRedisUtils.getClientIP(event);
  const rateLimitKey = `rate:${clientIP}`;
  
  const { allowed, remaining, resetIn } = await rateLimit.check(rateLimitKey);
  
  if (!allowed) {
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetIn.toString(),
      },
      body: JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: resetIn,
      }),
    };
  }
  
  // Your API logic here
  const data = await redis.get('api-data');
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetIn.toString(),
    },
    body: JSON.stringify({ data }),
  };
});
```

### Background Job Processing

```typescript
// jobs.ts
import { withRedisGeneric } from '@scaler/serverless-redis-aws-lambda';

interface JobEvent {
  jobId: string;
  type: 'email' | 'webhook' | 'cleanup';
  payload: any;
}

interface JobResult {
  success: boolean;
  jobId: string;
  duration: number;
  error?: string;
}

export const handler = withRedisGeneric<JobEvent, JobResult>(async (redis, event, context) => {
  const startTime = Date.now();
  
  try {
    // Mark job as started
    await redis.hset(`job:${event.jobId}`, 
      'status', 'running',
      'startedAt', new Date().toISOString(),
      'functionName', context.functionName
    );
    
    // Process job based on type
    let result;
    switch (event.type) {
      case 'email':
        result = await processEmailJob(event.payload);
        break;
      case 'webhook':
        result = await processWebhookJob(event.payload);
        break;
      case 'cleanup':
        result = await processCleanupJob(redis, event.payload);
        break;
      default:
        throw new Error(`Unknown job type: ${event.type}`);
    }
    
    // Mark job as completed
    await redis.hset(`job:${event.jobId}`,
      'status', 'completed',
      'completedAt', new Date().toISOString(),
      'result', JSON.stringify(result)
    );
    
    return {
      success: true,
      jobId: event.jobId,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    // Mark job as failed
    await redis.hset(`job:${event.jobId}`,
      'status', 'failed',
      'failedAt', new Date().toISOString(),
      'error', error instanceof Error ? error.message : 'Unknown error'
    );
    
    return {
      success: false,
      jobId: event.jobId,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

async function processEmailJob(payload: any) {
  // Email processing logic
}

async function processWebhookJob(payload: any) {
  // Webhook processing logic
}

async function processCleanupJob(redis: any, payload: any) {
  // Cleanup logic using Redis
}
```

### Middleware Integration (Middy.js)

```typescript
// middleware-example.ts
import { createRedisMiddleware } from '@scaler/serverless-redis-aws-lambda';
import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import httpJsonBodyParser from '@middy/http-json-body-parser';

const { redis, before } = createRedisMiddleware();

const baseHandler = async (event: any, context: any) => {
  // Redis is available on event.redis
  const data = await event.redis.get('key');
  
  return {
    statusCode: 200,
    body: JSON.stringify({ data }),
  };
};

export const handler = middy(baseHandler)
  .use(httpJsonBodyParser())
  .use(httpErrorHandler())
  .use({ before });
```

## Deployment

### Serverless Framework

```yaml
# serverless.yml
service: my-redis-api

provider:
  name: aws
  runtime: nodejs18.x
  environment:
    REDIS_PROXY_URL: ${env:REDIS_PROXY_URL}
    REDIS_TOKEN: ${env:REDIS_TOKEN}

functions:
  api:
    handler: handler.handler
    events:
      - http:
          path: /{key}
          method: any
          cors: true
```

### AWS SAM

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs18.x
    Environment:
      Variables:
        REDIS_PROXY_URL: !Ref RedisProxyUrl
        REDIS_TOKEN: !Ref RedisToken

Resources:
  RedisApi:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: handler.handler
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /{key}
            Method: any

Parameters:
  RedisProxyUrl:
    Type: String
  RedisToken:
    Type: String
    NoEcho: true
```

### AWS CDK

```typescript
// infrastructure.ts
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

const redisLambda = new lambda.Function(this, 'RedisFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'handler.handler',
  code: lambda.Code.fromAsset('dist'),
  environment: {
    REDIS_PROXY_URL: process.env.REDIS_PROXY_URL!,
    REDIS_TOKEN: process.env.REDIS_TOKEN!,
  },
  timeout: Duration.seconds(30),
  memorySize: 512,
});

const api = new apigateway.RestApi(this, 'RedisApi', {
  restApiName: 'Redis API',
});

api.root.addProxy({
  defaultIntegration: new apigateway.LambdaIntegration(redisLambda),
  anyMethod: true,
});
```

## Performance Optimization

The package automatically optimizes based on Lambda configuration:

### Memory-Based Timeout Scaling
- **128MB-512MB**: 8s timeout (lower memory = shorter timeout)
- **513MB-1023MB**: 10s timeout (default)
- **1024MB+**: 15s timeout (higher memory = longer timeout)

### Container Reuse
- Global client instance for warm Lambda containers
- Connection pooling across invocations
- Reduced cold start impact

### Best Practices
1. **Use appropriate memory allocation** - Higher memory = better performance
2. **Enable compression** - Reduces payload size over HTTP
3. **Use pipelines** - Batch multiple Redis operations
4. **Configure timeouts** - Match your Lambda timeout settings

## License

MIT License - see [LICENSE](../../../LICENSE) for details.