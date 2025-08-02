import { getServerlessRedis } from '@builtwithai/serverless-redis-nextjs';
import { SessionDemo } from './SessionDemo';
import { cookies } from 'next/headers';

export default async function SessionManagementPage() {
  // Get session data server-side
  const sessionData = await getSessionData();
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Session Management
          </h1>
          <p className="text-gray-600">
            Demonstrate user session handling with Redis storage and automatic cleanup
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Interactive Demo */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Session Demo</h2>
            <SessionDemo initialSession={sessionData} />
          </div>

          {/* Current Session Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Current Session</h2>
            <SessionInfo sessionData={sessionData} />
          </div>
        </div>

        {/* Code Examples */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Implementation Examples</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Session API Route</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`// app/api/session/route.ts
import { withRedis } from '@scaler/serverless-redis-nextjs';
import { cookies } from 'next/headers';

export const GET = withRedis(async (redis) => {
  const sessionId = cookies().get('sessionId')?.value;
  
  if (!sessionId) {
    return Response.json({ session: null });
  }
  
  const sessionData = await redis.hgetall(\`session:\${sessionId}\`);
  const ttl = await redis.ttl(\`session:\${sessionId}\`);
  
  return Response.json({ 
    session: sessionData, 
    expiresIn: ttl 
  });
});

export const POST = withRedis(async (redis, request) => {
  const data = await request.json();
  const sessionId = generateSessionId();
  
  // Store session data with 24-hour expiration
  await redis.pipeline()
    .hset(\`session:\${sessionId}\`, data)
    .expire(\`session:\${sessionId}\`, 86400)
    .exec();
  
  // Set cookie
  cookies().set('sessionId', sessionId, {
    httpOnly: true,
    secure: true,
    maxAge: 86400
  });
  
  return Response.json({ success: true, sessionId });
});`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Session Middleware</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`// lib/session-middleware.ts
import { getServerlessRedis } from '@builtwithai/serverless-redis-nextjs';

export async function getSession(sessionId: string) {
  const redis = getServerlessRedis();
  
  const sessionData = await redis.hgetall(\`session:\${sessionId}\`);
  const ttl = await redis.ttl(\`session:\${sessionId}\`);
  
  if (Object.keys(sessionData).length === 0) {
    return null;
  }
  
  return {
    ...sessionData,
    expiresIn: ttl,
    expiresAt: new Date(Date.now() + ttl * 1000)
  };
}

export async function updateSession(sessionId: string, data: any) {
  const redis = getServerlessRedis();
  
  await redis.pipeline()
    .hset(\`session:\${sessionId}\`, data)
    .expire(\`session:\${sessionId}\`, 86400) // Reset TTL
    .exec();
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* Features Overview */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Session Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-green-600">✓ Implemented</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Automatic session creation</li>
                <li>• Secure session IDs</li>
                <li>• TTL-based expiration</li>
                <li>• Session data persistence</li>
                <li>• Cookie-based storage</li>
                <li>• Session cleanup</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-600">⚡ Performance</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Redis hash storage</li>
                <li>• Pipeline operations</li>
                <li>• Efficient TTL management</li>
                <li>• Minimal cookie footprint</li>
                <li>• Server-side rendering</li>
                <li>• Edge runtime compatible</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function getSessionData() {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('sessionId')?.value;
    
    if (!sessionId) {
      return null;
    }
    
    const redis = getServerlessRedis();
    const sessionData = await redis.hgetall(`session:${sessionId}`);
    const ttl = await redis.ttl(`session:${sessionId}`);
    
    if (Object.keys(sessionData).length === 0) {
      return null;
    }
    
    return {
      sessionId,
      ...sessionData,
      expiresIn: ttl,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    };
  } catch (error) {
    console.error('Failed to get session data:', error);
    return null;
  }
}

function SessionInfo({ sessionData }: { sessionData: any }) {
  if (!sessionData) {
    return (
      <div className="text-gray-500 italic">
        No active session. Create one using the demo.
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div>
        <span className="font-semibold">Session ID:</span>
        <div className="font-mono text-sm bg-gray-100 p-2 rounded mt-1 break-all">
          {sessionData.sessionId}
        </div>
      </div>
      
      <div>
        <span className="font-semibold">Expires In:</span>
        <div className="text-sm text-gray-600">
          {sessionData.expiresIn} seconds
        </div>
      </div>
      
      <div>
        <span className="font-semibold">Expires At:</span>
        <div className="text-sm text-gray-600">
          {new Date(sessionData.expiresAt).toLocaleString()}
        </div>
      </div>
      
      <div>
        <span className="font-semibold">Session Data:</span>
        <pre className="bg-gray-100 p-2 rounded mt-1 text-sm overflow-x-auto">
          {JSON.stringify(
            Object.fromEntries(
              Object.entries(sessionData).filter(([key]) => 
                !['sessionId', 'expiresIn', 'expiresAt'].includes(key)
              )
            ), 
            null, 
            2
          )}
        </pre>
      </div>
    </div>
  );
}