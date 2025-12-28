/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Enable type checking for better code quality
  },
  images: {
    unoptimized: false, // Enable image optimization for better performance
  },
  // Performance optimizations for 70 concurrent users
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header for security
  // Optimize production builds
  // swcMinify: true, // Deprecated in Next.js 15 - SWC is default
  // React optimizations
  reactStrictMode: true,
  // Experimental features for better performance
  experimental: {
    // optimizeCss: true, // Optimize CSS - disabled: requires 'critters' package
  },
  // Headers for caching, performance, and security (AWS-optimized)
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ]

    // Add HSTS in production
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      })
    }

    // Content Security Policy
    const cspHeader = {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    }

    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          cspHeader,
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
          ...securityHeaders,
          // Note: CORS headers are handled by middleware.ts for dynamic origin support
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  // AWS-specific: Output configuration for better deployment
  // output: 'standalone', // Optimized for AWS deployment (ECS, EC2, etc.)
  // Disabled on Windows due to symlink permission issues (EPERM)
  // Enable this when deploying to AWS/Linux environments
}

export default nextConfig
