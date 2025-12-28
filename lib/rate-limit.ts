import { type NextRequest } from 'next/server'
import { query } from '@/lib/db'

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  identifier: string
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

/**
 * Rate limiting using database storage
 * More reliable than in-memory for distributed systems
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const ip = getClientIp(request)
  const key = `${config.identifier}:${ip}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  try {
    // Clean up old entries (only run cleanup occasionally to reduce DB load)
    // Use a random check to avoid every request hitting the cleanup
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      try {
        await query(
          `DELETE FROM rate_limits WHERE expires_at < NOW()`
        )
      } catch (cleanupError) {
        // Ignore cleanup errors - they're not critical
        if (process.env.NODE_ENV === 'development') {
          console.warn('Rate limit cleanup error (non-critical):', cleanupError)
        }
      }
    }

    // Get current attempts
    // Use parameterized query to prevent SQL injection
    const windowSeconds = Math.floor(config.windowMs / 1000)
    const result = await query<{ count: string; expires_at: Date | null }>(
      `SELECT COUNT(*)::text as count, MAX(expires_at) as expires_at
       FROM rate_limits
       WHERE identifier = $1 AND created_at > NOW() - INTERVAL $2`,
      [key, `${windowSeconds} seconds`]
    )

    const currentAttempts = parseInt(result.rows[0]?.count || '0', 10)
    const resetTime = result.rows[0]?.expires_at 
      ? new Date(result.rows[0].expires_at).getTime()
      : now + config.windowMs

    if (currentAttempts >= config.maxAttempts) {
      // Record the blocked attempt
      // Use parameterized query to prevent SQL injection
      await query(
        `INSERT INTO rate_limits (identifier, created_at, expires_at)
         VALUES ($1, NOW(), NOW() + INTERVAL $2)
         ON CONFLICT DO NOTHING`,
        [key, `${windowSeconds} seconds`]
      )

      return {
        allowed: false,
        remaining: 0,
        resetTime,
      }
    }

    // Record this attempt
    // Use parameterized query to prevent SQL injection
    await query(
      `INSERT INTO rate_limits (identifier, created_at, expires_at)
       VALUES ($1, NOW(), NOW() + INTERVAL $2)`,
      [key, `${windowSeconds} seconds`]
    )

    return {
      allowed: true,
      remaining: config.maxAttempts - currentAttempts - 1,
      resetTime,
    }
  } catch (error) {
    console.error('Rate limit check error:', error)
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetTime: now + config.windowMs,
    }
  }
}

// Helper function to normalize and validate IP addresses
function normalizeIp(ip: string): string | null {
  if (!ip) return null
  
  const trimmed = ip.trim()
  
  // Handle IPv6-mapped IPv4 addresses (::ffff:127.0.0.1 -> 127.0.0.1)
  if (trimmed.startsWith("::ffff:")) {
    const ipv4 = trimmed.substring(7) // Remove "::ffff:" prefix
    // Validate it's a valid IPv4 address
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ipv4)) {
      return ipv4
    }
  }
  
  return trimmed
}

// Helper function to check if IP is a loopback or invalid address
function isValidClientIp(ip: string | null): boolean {
  if (!ip) return false
  
  const normalized = normalizeIp(ip)
  if (!normalized) return false
  
  // List of invalid/loopback addresses
  const invalidIps = [
    "localhost",
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "0.0.0.0",
    "::",
    "::ffff:0.0.0.0",
  ]
  
  // Check exact match
  if (invalidIps.includes(normalized.toLowerCase())) {
    return false
  }
  
  return true
}

function getClientIp(request: NextRequest): string {
  // Priority order for AWS environments:
  // 1. CloudFront header (AWS CloudFront)
  // 2. x-forwarded-for (ALB, Nginx, etc.) - first IP is client
  // 3. x-real-ip (Nginx, some proxies)
  // 4. x-client-ip (some proxies)
  
  const headers = [
    "cf-connecting-ip",           // AWS CloudFront
    "x-forwarded-for",            // ALB, Nginx, most proxies
    "x-real-ip",                  // Nginx, some proxies
    "x-client-ip",                // Some proxies
    "true-client-ip",             // Cloudflare (if used)
  ]
  
  for (const headerName of headers) {
    const headerValue = request.headers.get(headerName)
    if (!headerValue) continue
    
    // x-forwarded-for can contain multiple IPs: "client-ip, proxy1-ip, proxy2-ip"
    const ips = headerValue.split(",").map((ip) => normalizeIp(ip.trim())).filter((ip): ip is string => ip !== null)
    
    // Find the first valid (non-loopback) IP
    for (const ip of ips) {
      if (isValidClientIp(ip)) {
        return ip
      }
    }
  }
  
  // Fallback: return 'unknown' if we can't determine a valid client IP
  return 'unknown'
}

/**
 * Create rate limit table if it doesn't exist
 */
export async function createRateLimitTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id SERIAL PRIMARY KEY,
      identifier TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      UNIQUE(identifier, created_at)
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier 
      ON rate_limits(identifier, created_at);
    
    CREATE INDEX IF NOT EXISTS idx_rate_limits_expires 
      ON rate_limits(expires_at);
  `)
}

