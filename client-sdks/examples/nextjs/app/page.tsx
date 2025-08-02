import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Next.js Redis Examples
          </h1>
          <p className="text-xl text-gray-600">
            Comprehensive examples using Serverless Redis with Next.js
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {examples.map((example) => (
            <div key={example.href} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {example.title}
              </h3>
              <p className="text-gray-600 mb-4">
                {example.description}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {example.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href={example.href}
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                View Example
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Getting Started
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">1. Start Redis Proxy</h3>
              <pre className="bg-gray-100 p-2 rounded mt-1 text-sm">
                docker-compose up -d
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">2. Set Environment Variables</h3>
              <pre className="bg-gray-100 p-2 rounded mt-1 text-sm">
                REDIS_PROXY_URL=http://localhost:8080{'\n'}
                REDIS_TOKEN=example-api-key-123
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">3. Run Examples</h3>
              <pre className="bg-gray-100 p-2 rounded mt-1 text-sm">
                npm run dev
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const examples = [
  {
    title: 'Basic CRUD Operations',
    description: 'Simple create, read, update, delete operations with Redis',
    href: '/basic-crud',
    tags: ['GET', 'SET', 'DEL', 'Basics']
  },
  {
    title: 'Session Management',
    description: 'User session handling with Redis storage',
    href: '/session-management',
    tags: ['Sessions', 'Auth', 'HSET', 'Expire']
  },
  {
    title: 'API Caching',
    description: 'Cache API responses for improved performance',
    href: '/api-caching',
    tags: ['Caching', 'Performance', 'TTL']
  },
  {
    title: 'Rate Limiting',
    description: 'Implement request rate limiting with Redis',
    href: '/rate-limiting',
    tags: ['Rate Limit', 'INCR', 'Security']
  },
  {
    title: 'Real-time Chat',
    description: 'Simple chat application with Redis pub/sub',
    href: '/realtime-chat',
    tags: ['Real-time', 'Lists', 'WebSocket']
  },
  {
    title: 'Shopping Cart',
    description: 'E-commerce shopping cart with Redis',
    href: '/shopping-cart',
    tags: ['E-commerce', 'Hashes', 'Transactions']
  },
  {
    title: 'Analytics Dashboard',
    description: 'Track and display analytics data',
    href: '/analytics',
    tags: ['Analytics', 'Sorted Sets', 'Counters']
  },
  {
    title: 'Content Management',
    description: 'Dynamic content delivery with caching',
    href: '/content-management',
    tags: ['CMS', 'Caching', 'Pipeline']
  },
  {
    title: 'User Preferences',
    description: 'Store and manage user preferences',
    href: '/user-preferences',
    tags: ['Preferences', 'JSON', 'Personalization']
  }
];