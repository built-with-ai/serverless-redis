import { getServerlessRedis } from '@builtwithai/serverless-redis-nextjs';
import { CrudDemo } from './CrudDemo';

export default function BasicCrudPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Basic CRUD Operations
          </h1>
          <p className="text-gray-600">
            Demonstrate basic Create, Read, Update, Delete operations with Redis
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Interactive Demo */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Interactive Demo</h2>
            <CrudDemo />
          </div>

          {/* Code Examples */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Code Examples</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Server Component</h3>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`import { getServerlessRedis } from '@builtwithai/serverless-redis-nextjs';

async function getData() {
  const redis = getServerlessRedis();
  const value = await redis.get('user:123');
  return { value };
}

export default async function ServerComponent() {
  const data = await getData();
  return <div>Value: {data.value}</div>;
}`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">API Route</h3>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`import { withRedis } from '@scaler/serverless-redis-nextjs';

export default withRedis(async (redis, req, res) => {
  if (req.method === 'GET') {
    const value = await redis.get(req.query.key);
    return { key: req.query.key, value };
  }
  
  if (req.method === 'POST') {
    await redis.set(req.body.key, req.body.value);
    return { success: true };
  }
});`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Client Component</h3>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`'use client';
import { useState } from 'react';

export function CrudDemo() {
  const [data, setData] = useState('');
  
  const handleSet = async () => {
    await fetch('/api/crud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'demo', value: data })
    });
  };
  
  return (
    <div>
      <input 
        value={data} 
        onChange={(e) => setData(e.target.value)}
        placeholder="Enter value"
      />
      <button onClick={handleSet}>Set Value</button>
    </div>
  );
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Server-side Data Display */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Server-side Data</h2>
          <ServerData />
        </div>
      </div>
    </div>
  );
}

async function ServerData() {
  try {
    const redis = getServerlessRedis();
    
    // Get some sample data
    const results = await redis.pipeline()
      .get('demo')
      .get('counter')
      .get('timestamp')
      .exec();
    
    const [demo, counter, timestamp] = results;
    
    return (
      <div className="space-y-2">
        <div>Demo Value: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{demo || 'null'}</span></div>
        <div>Counter: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{counter || '0'}</span></div>
        <div>Last Updated: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{timestamp || 'never'}</span></div>
      </div>
    );
  } catch (error) {
    return (
      <div className="text-red-600">
        Error loading data: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }
}