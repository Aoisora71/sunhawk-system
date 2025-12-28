/**
 * Environment variable validation
 * Ensures required environment variables are set and valid
 */

interface EnvConfig {
  DATABASE_URL?: string
  JWT_SECRET?: string
  NODE_ENV?: string
  DB_POOL_MAX?: string
  DB_POOL_MIN?: string
  DB_SSL?: string
}

/**
 * Validate required environment variables
 * @throws Error if required variables are missing or invalid
 */
export function validateEnvironment(): void {
  const errors: string[] = []
  const warnings: string[] = []

  // Required in all environments
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required')
  }

  // Required in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET is required in production')
    } else if (process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters for better security')
    }
  }

  // Validate connection pool settings
  if (process.env.DB_POOL_MAX) {
    const max = parseInt(process.env.DB_POOL_MAX, 10)
    if (isNaN(max) || max < 1 || max > 100) {
      warnings.push('DB_POOL_MAX should be between 1 and 100')
    }
  }

  if (process.env.DB_POOL_MIN) {
    const min = parseInt(process.env.DB_POOL_MIN, 10)
    if (isNaN(min) || min < 0 || min > 50) {
      warnings.push('DB_POOL_MIN should be between 0 and 50')
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    
  }

  // Throw errors
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
    )
  }
}

/**
 * Get validated environment variable
 */
export function getEnv(key: keyof EnvConfig, defaultValue?: string): string {
  const value = process.env[key] || defaultValue
  
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Environment variable ${key} is required in production`)
  }
  
  return value || ''
}

/**
 * Initialize environment validation (call at app startup)
 */
export function initEnvironment(): void {
  try {
    validateEnvironment()
    
  } catch (error) {
    
    if (process.env.NODE_ENV === 'production') {
      throw error // Fail fast in production
    }
  }
}

