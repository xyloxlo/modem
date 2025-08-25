/** @type {import('next').NextConfig} */
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost'
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: false,
  },
  // API proxy to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://${BACKEND_HOST}:3002/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `http://${BACKEND_HOST}:3002/socket.io/:path*`,
      },
    ];
  },
  // Headers for WebSocket support
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
