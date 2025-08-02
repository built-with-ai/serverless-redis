/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    REDIS_PROXY_URL: process.env.REDIS_PROXY_URL,
    REDIS_TOKEN: process.env.REDIS_TOKEN,
  },
}

module.exports = nextConfig