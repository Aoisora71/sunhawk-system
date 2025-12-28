// Authentication and authorization middleware helpers
import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { unauthorizedResponse, forbiddenResponse } from "@/lib/api-errors"

export interface AuthenticatedUser {
  userId: number
  email: string
  role: string
}

export interface AdminUser {
  userId: number
  email: string
}

/**
 * Check if user is authenticated
 * @param request - Next.js request object
 * @returns User object if authenticated, null otherwise
 */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser | null> {
  // First try to get JWT token from cookie
  const token = request.cookies.get("authToken")?.value

  if (token) {
    try {
      const { verifyToken } = await import("@/lib/jwt")
      const payload = await verifyToken(token)
      
      if (payload) {
        return {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        }
      }
    } catch (error) {
          }
  }

  // No fallback - JWT token is required
  return null
}

/**
 * Check if user is admin
 * @param request - Next.js request object
 * @returns Admin user object if user is admin, null otherwise
 */
export async function requireAdmin(request: NextRequest): Promise<AdminUser | null> {
  const user = await requireAuth(request)

  if (!user || user.role !== "admin") {
    return null
  }

  return {
    userId: user.userId,
    email: user.email,
  }
}

/**
 * Middleware wrapper for authenticated routes
 * @param handler - Route handler function
 * @returns Wrapped handler with authentication check
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const user = await requireAuth(request)

    if (!user) {
      return unauthorizedResponse()
    }

    return handler(request, user)
  }
}

/**
 * Middleware wrapper for admin-only routes (for static routes)
 * @param handler - Route handler function
 * @returns Wrapped handler with admin check
 */
export function withAdmin(
  handler: (request: NextRequest, user: AdminUser) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const user = await requireAdmin(request)

    if (!user) {
      return forbiddenResponse()
    }

    return handler(request, user)
  }
}

/**
 * Middleware wrapper for authenticated routes with params (for dynamic routes)
 * @param handler - Route handler function with params
 * @returns Wrapped handler with authentication check
 */
export function withAuthParams<T extends Record<string, string>>(
  handler: (request: NextRequest, context: { params: Promise<T> }, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: { params: Promise<T> }) => {
    const user = await requireAuth(request)

    if (!user) {
      return unauthorizedResponse()
    }

    return handler(request, context, user)
  }
}

/**
 * Middleware wrapper for admin-only routes with params (for dynamic routes)
 * @param handler - Route handler function with params
 * @returns Wrapped handler with admin check
 */
export function withAdminParams<T extends Record<string, string>>(
  handler: (request: NextRequest, context: { params: Promise<T> }, user: AdminUser) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: { params: Promise<T> }) => {
    const user = await requireAdmin(request)

    if (!user) {
      return forbiddenResponse()
    }

    return handler(request, context, user)
  }
}

