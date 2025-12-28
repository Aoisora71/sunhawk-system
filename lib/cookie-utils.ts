import { type NextRequest } from "next/server"

/**
 * Get cookie options that work across different environments
 * - Handles cross-origin scenarios (VPS accessed from localhost)
 * - Properly sets secure flag based on actual protocol
 * - Uses 'lax' sameSite for better compatibility
 */
export function getAuthCookieOptions(request?: NextRequest) {
  // Detect if we're using HTTPS
  // Check environment variable first, then request headers
  const isSecure = 
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.COOKIE_SECURE !== 'false' && 
     (request?.headers.get('x-forwarded-proto') === 'https' ||
      request?.url?.startsWith('https://') ||
      (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false')))

  // Use 'lax' instead of 'strict' to allow cookies in cross-origin scenarios
  // 'lax' still provides CSRF protection for most cases while allowing
  // cookies to be sent when navigating from external sites
  const sameSite: 'strict' | 'lax' | 'none' = 
    process.env.COOKIE_SAME_SITE === 'none' ? 'none' :
    process.env.COOKIE_SAME_SITE === 'strict' ? 'strict' :
    'lax' // Default to 'lax' for better compatibility

  // If sameSite is 'none', secure must be true
  const secure = sameSite === 'none' ? true : isSecure

  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    // Don't set domain - let browser handle it automatically
    // This allows cookies to work across subdomains and different origins
  }
}



