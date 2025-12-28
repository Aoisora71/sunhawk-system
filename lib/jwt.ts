import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

/**
 * Get JWT secret key from environment variables
 * In production, JWT_SECRET is required for security
 * @throws Error if JWT_SECRET is not set in production
 */
function getSecretKey(): string {
  const secret = process.env.JWT_SECRET
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET environment variable is required in production. ' +
        'Please set a strong random secret (minimum 32 characters).'
      )
    }
    // Development fallback with warning
        return 'your-secret-key-change-in-production'
  }
  
  // Validate secret strength in production
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      }
  
  return secret
}

const SECRET_KEY = getSecretKey()
const ALGORITHM = 'HS256'

export interface JWTPayload {
  userId: number
  email: string
  role: string
  iat?: number
  exp?: number
}

/**
 * Create a JWT token for a user
 */
export async function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = new TextEncoder().encode(SECRET_KEY)
  
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  return token
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(SECRET_KEY)
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JWTPayload
  } catch (error) {
        return null
  }
}

/**
 * Get the current user from the JWT token in cookies
 */
export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('authToken')?.value

  if (!token) {
    return null
  }

  return verifyToken(token)
}

