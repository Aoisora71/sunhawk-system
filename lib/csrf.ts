/**
 * CSRF Protection Implementation
 * Uses double-submit cookie pattern for CSRF protection
 */

import { NextRequest, NextResponse } from 'next/server'

const CSRF_TOKEN_COOKIE = 'csrf-token'
const CSRF_TOKEN_HEADER = 'X-CSRF-Token'
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate a random CSRF token
 */
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < CSRF_TOKEN_LENGTH; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

/**
 * Validate CSRF token from request
 */
export function validateCsrfToken(request: NextRequest): boolean {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true
  }

  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER)

  if (!cookieToken || !headerToken) {
    return false
  }

  // Use constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Middleware to add CSRF token to response
 */
export function addCsrfTokenToResponse(response: NextResponse): NextResponse {
  let token = response.cookies.get(CSRF_TOKEN_COOKIE)?.value

  if (!token) {
    token = generateToken()
    response.cookies.set(CSRF_TOKEN_COOKIE, token, {
      httpOnly: false, // Must be accessible to JavaScript for header submission
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
  }

  return response
}

/**
 * CSRF protection middleware wrapper
 */
export function withCsrf<T extends Record<string, string>>(
  handler: (request: NextRequest, context: { params: Promise<T> }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: { params: Promise<T> }) => {
    const isValid = validateCsrfToken(request)

    if (!isValid) {
      return new NextResponse(
        JSON.stringify({ error: 'CSRF token validation failed' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const response = await handler(request, context)
    return addCsrfTokenToResponse(response)
  }
}

/**
 * CSRF protection for routes without params
 */
export function withCsrfNoParams(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const isValid = validateCsrfToken(request)

    if (!isValid) {
      return new NextResponse(
        JSON.stringify({ error: 'CSRF token validation failed' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const response = await handler(request)
    return addCsrfTokenToResponse(response)
  }
}

