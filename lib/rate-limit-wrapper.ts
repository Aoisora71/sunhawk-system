/**
 * Rate limiting wrapper for API routes
 * Provides consistent rate limiting across all endpoints
 */

import { type NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from './rate-limit'

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  identifier: string
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 100, // 100 requests per window
  windowMs: 15 * 60 * 1000, // 15 minutes
  identifier: 'api',
}

/**
 * Rate limit wrapper for API routes
 */
export function withRateLimit<T extends Record<string, string>>(
  handler: (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse>,
  config: Partial<RateLimitConfig> = {}
) {
  const rateLimitConfig = { ...DEFAULT_CONFIG, ...config }

  return async (request: NextRequest, context: { params: Promise<T> }) => {
    const rateLimitResult = await checkRateLimit(request, rateLimitConfig)

    if (!rateLimitResult.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': rateLimitConfig.maxAttempts.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          },
        }
      )
    }

    const response = await handler(request, context)
    
    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit', rateLimitConfig.maxAttempts.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString())

    return response
  }
}

/**
 * Rate limit wrapper for routes without params
 */
export function withRateLimitNoParams(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config: Partial<RateLimitConfig> = {}
) {
  const rateLimitConfig = { ...DEFAULT_CONFIG, ...config }

  return async (request: NextRequest) => {
    const rateLimitResult = await checkRateLimit(request, rateLimitConfig)

    if (!rateLimitResult.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': rateLimitConfig.maxAttempts.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          },
        }
      )
    }

    const response = await handler(request)
    
    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit', rateLimitConfig.maxAttempts.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString())

    return response
  }
}

