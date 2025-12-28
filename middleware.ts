import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { addCsrfTokenToResponse } from '@/lib/csrf'

/**
 * Next.js Middleware for handling CORS, CSRF tokens, and authentication
 * This runs on every request and handles:
 * - CORS preflight requests (OPTIONS)
 * - Setting CORS headers for all API routes
 * - CSRF token generation
 * - Ensuring credentials are allowed
 */
export function middleware(request: NextRequest) {
  // Get origin and check if it's allowed
  const origin = request.headers.get('origin')
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
  const allowAllOrigins = allowedOrigins.includes('*')
  const isAllowedOrigin = allowAllOrigins || (origin && allowedOrigins.includes(origin))

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    if (isAllowedOrigin) {
      // When credentials are required, we must return the actual origin, not '*'
      const allowOrigin = allowAllOrigins && origin ? origin : (origin || '*')
      
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      })
    }
    
    // Origin not allowed, return 403
    return new NextResponse(null, { status: 403 })
  }

  // Create response
  const response = NextResponse.next()

  // For API routes, add CORS headers and CSRF token
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Add CORS headers if origin is allowed
    if (isAllowedOrigin) {
      // When credentials are required, we must return the actual origin, not '*'
      const allowOrigin = allowAllOrigins && origin ? origin : (origin || '*')
      
      response.headers.set('Access-Control-Allow-Origin', allowOrigin)
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token')
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    // Add CSRF token to response
    return addCsrfTokenToResponse(response)
  }

  // For non-API routes, add CSRF token
  return addCsrfTokenToResponse(response)
}

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

