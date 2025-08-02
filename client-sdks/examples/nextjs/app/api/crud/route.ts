import { withRedis } from '@builtwithai/serverless-redis-nextjs';
import { NextRequest } from 'next/server';

export const GET = withRedis(async (redis, request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  
  if (!key) {
    return Response.json({ error: 'Key parameter is required' }, { status: 400 });
  }
  
  try {
    const value = await redis.get(key);
    const ttl = await redis.ttl(key);
    
    return Response.json({ 
      key, 
      value, 
      ttl: ttl > 0 ? ttl : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ 
      error: 'Failed to get value',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

export const POST = withRedis(async (redis, request: NextRequest) => {
  try {
    const body = await request.json();
    
    // Handle different actions
    switch (body.action) {
      case 'incr':
        const newValue = await redis.incr(body.key || 'counter');
        return Response.json({ 
          action: 'increment',
          key: body.key || 'counter',
          value: newValue,
          timestamp: new Date().toISOString()
        });
        
      case 'pipeline':
        const pipeline = redis.pipeline();
        
        // Add commands to pipeline
        for (const cmd of body.commands) {
          pipeline.command(cmd.command, ...cmd.args);
        }
        
        const results = await pipeline.exec();
        return Response.json({
          action: 'pipeline',
          commands: body.commands.length,
          results,
          timestamp: new Date().toISOString()
        });
        
      default:
        // Regular SET operation
        const { key, value, ttl, timestamp } = body;
        
        if (!key || value === undefined) {
          return Response.json({ 
            error: 'Key and value are required' 
          }, { status: 400 });
        }
        
        // Set the value
        await redis.set(key, value);
        
        // Set TTL if provided
        if (ttl && ttl > 0) {
          await redis.expire(key, ttl);
        }
        
        // Also set a timestamp if provided
        if (timestamp) {
          await redis.set(`${key}:timestamp`, timestamp);
        }
        
        return Response.json({ 
          success: true,
          key,
          value,
          ttl: ttl || null,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    return Response.json({ 
      error: 'Failed to set value',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

export const DELETE = withRedis(async (redis, request: NextRequest) => {
  try {
    const body = await request.json();
    const { key } = body;
    
    if (!key) {
      return Response.json({ error: 'Key is required' }, { status: 400 });
    }
    
    const deleted = await redis.del(key, `${key}:timestamp`);
    
    return Response.json({ 
      success: true,
      key,
      deleted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ 
      error: 'Failed to delete value',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});