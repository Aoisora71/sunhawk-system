import { Pool, QueryResult, QueryResultRow } from 'pg'
import { log } from './logger'

/**
 * PostgreSQL connection pool configuration
 * Optimized for AWS deployment with 70+ concurrent users
 * Handles AWS-specific requirements (SSL, network timeouts, connection retries)
 */

// AWS PostgreSQL SSL configuration
// AWS PostgreSQL instances often require SSL even if not RDS
const getSSLConfig = () => {
  // Explicitly disable SSL if DB_SSL is 'false'
  if (process.env.DB_SSL === 'false' || process.env.DB_SSL === '0') {
    return false
  }
  
  // Check if SSL is explicitly required via environment variable
  if (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'required') {
    return { rejectUnauthorized: false }
  }
  
  // For production on AWS, enable SSL
  if (process.env.NODE_ENV === 'production') {
    // Check if DATABASE_URL contains AWS-related hostnames
    const dbUrl = process.env.DATABASE_URL || ''
    const isAWSHost = dbUrl.includes('.amazonaws.com') || 
                      dbUrl.includes('.rds.amazonaws.com') ||
                      process.env.AWS_REGION ||
                      process.env.AWS_EXECUTION_ENV
    
    if (isAWSHost) {
      return { rejectUnauthorized: false }
    }
    
    // Default to SSL in production for security
    return { rejectUnauthorized: false }
  }
  
  // For development, default to no SSL (local PostgreSQL often doesn't support SSL)
  return false
}

// Singleton pattern to prevent multiple pool instances in Next.js development mode
let poolInstance: Pool | null = null
let sslDisabled = false // Track if we've disabled SSL due to server not supporting it

const createPool = (forceRecreate: boolean = false): Pool => {
  if (poolInstance && !forceRecreate && !sslDisabled) {
    return poolInstance
  }

  // If SSL was disabled due to server not supporting it, ensure it stays disabled
  if (sslDisabled || process.env.DB_SSL === 'false') {
    process.env.DB_SSL = 'false'
  }

  // Close existing pool if recreating
  if (poolInstance && forceRecreate) {
    poolInstance.end().catch(() => {}) // Ignore errors during cleanup
    poolInstance = null
  }

  poolInstance = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/sunhawk_system',
    ssl: getSSLConfig(),
    // Optimized for 70 concurrent users
    // Formula: With connection pooling, 25-30 connections can handle 70 concurrent users
    // Each connection can handle multiple requests sequentially
    max: parseInt(process.env.DB_POOL_MAX || '30', 10), // 30 connections for 70 concurrent users
    min: parseInt(process.env.DB_POOL_MIN || '2', 10), // Keep 2 ready for faster response, but low enough to prevent buildup
    idleTimeoutMillis: 10000, // Close idle clients after 10 seconds (balanced)
    connectionTimeoutMillis: 5000, // 5 second timeout
    allowExitOnIdle: false, // Keep pool alive for 70 concurrent users (changed back to false)
    // Prevent connection leaks by setting max lifetime
    maxLifetimeSeconds: 1800, // Close connections after 30 minutes to prevent stale connections
    // AWS-specific: Handle connection errors gracefully
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  })

  return poolInstance
}

// Create pool - will be recreated without SSL if server doesn't support it
let pool: Pool = createPool()

// Function to recreate pool without SSL
const recreatePoolWithoutSSL = async () => {
  if (sslDisabled) return // Already disabled
  
  log.warn('Recreating pool without SSL')
  sslDisabled = true
  process.env.DB_SSL = 'false'
  
  // Close old pool
  if (poolInstance) {
    try {
      await poolInstance.end()
    } catch (err) {
      // Ignore errors during cleanup
    }
    poolInstance = null
  }
  
  // Create new pool without SSL
  poolInstance = createPool(true)
  pool = poolInstance // Update exported pool reference
  log.info('Pool recreated without SSL')
}

// Connection pool statistics
let poolStats = {
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0,
}

// Monitor pool statistics periodically (with cleanup for AWS/serverless)
let poolMonitorInterval: NodeJS.Timeout | null = null
if (typeof setInterval !== 'undefined') {
  poolMonitorInterval = setInterval(() => {
    poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    }
    
    // Log warning if pool is getting full (for 70 users, warn at 80% capacity)
    const maxConnections = parseInt(process.env.DB_POOL_MAX || '30', 10)
    if (poolStats.totalCount >= maxConnections * 0.8) {
      log.warn('High connection usage (80%+)', {
        ...poolStats,
        maxConnections,
        usagePercent: Math.round((poolStats.totalCount / maxConnections) * 100),
        activeConnections: poolStats.totalCount - poolStats.idleCount,
      })
      
      // If at 90%+ capacity, try to close some idle connections proactively
      if (poolStats.totalCount >= maxConnections * 0.9 && poolStats.idleCount > 2) {
        log.warn('Proactively closing idle connections to prevent limit')
        try {
          const poolAny = pool as any
          if (poolAny._idle && poolAny._idle.length > 0) {
            const idleToClose = Math.min(5, Math.floor(poolStats.idleCount / 2))
            for (let i = 0; i < idleToClose && poolAny._idle.length > 0; i++) {
              const client = poolAny._idle.shift()
              if (client) {
                client.end().catch(() => {})
              }
            }
            log.info(`Proactively closed ${idleToClose} idle connections`)
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    }
    
    // Log when all connections are idle (normal state when no active clients)
    if (poolStats.totalCount > 0 && poolStats.idleCount === poolStats.totalCount) {
      // All connections are idle - this is normal, connections will close after idleTimeoutMillis
      if (process.env.NODE_ENV === 'development') {
        log.debug('All connections idle (will close after 10s)', poolStats)
      }
    }
    
    // Log pool stats in production for monitoring
    if (process.env.NODE_ENV === 'production' && poolStats.totalCount > 0) {
      log.info('Pool stats', poolStats)
    }
  }, 30000) // Check every 30 seconds
}

// Connection event handlers
pool.on('connect', (client) => {
  if (process.env.NODE_ENV === 'development') {
    log.debug('DB pool connected', { total: pool.totalCount, idle: pool.idleCount })
  }
})

pool.on('error', (err) => {
  // Handle connection errors gracefully (critical for AWS)
  const errorCode = (err as any)?.code
  const errorMessage = err.message
  
  if (errorMessage.includes('too many clients') || errorCode === '53300') {
    log.error('Connection limit reached', new Error('Connection limit reached'), {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    })
    // Don't crash - the pool will handle this
  } else if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT' || errorCode === 'ENOTFOUND' || errorCode === 'ECONNRESET') {
    // AWS network errors - log but don't crash (pool will retry)
    // ECONNRESET: Connection was reset by peer (database server closed the connection)
    log.warn('Network error on idle client (will retry)', { error: errorMessage, code: errorCode })
  } else if (errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
    // SSL errors - critical for AWS
    log.error('SSL/TLS error on idle client', new Error(errorMessage), { 
      message: 'Check DB_SSL environment variable and DATABASE_URL SSL settings' 
    })
  } else {
    log.error('Unexpected error on idle client', new Error(errorMessage), {
      message: errorMessage,
      code: errorCode,
    })
  }
  
  // Don't crash the application - the pool will handle reconnection
})

// Cleanup interval on process termination (important for AWS/serverless)
if (typeof process !== 'undefined') {
  const cleanup = () => {
    if (poolMonitorInterval) {
      clearInterval(poolMonitorInterval)
      poolMonitorInterval = null
    }
  }
  
  process.on('SIGINT', async () => {
    cleanup()
    log.info('Closing pool on SIGINT')
    await pool.end().catch(err => log.error('Error closing pool', err))
  })
  
  process.on('SIGTERM', async () => {
    cleanup()
    log.info('Closing pool on SIGTERM')
    await pool.end().catch(err => log.error('Error closing pool', err))
  })
  
  // AWS Lambda/ECS cleanup
  process.on('beforeExit', async () => {
    cleanup()
    if (pool.totalCount > 0) {
      log.info('Closing pool on beforeExit')
      await pool.end().catch(err => log.error('Error closing pool', err))
    }
  })
}

// Additional cleanup: Monitor idle connections to prevent buildup when no clients
// This helps prevent connection exhaustion when there are no active clients
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    // If all connections are idle, the pool will close them based on idleTimeoutMillis (5 seconds)
    // This ensures connections don't stay open when there are no active clients
    if (pool.idleCount === pool.totalCount && pool.totalCount > 0) {
      if (process.env.NODE_ENV === 'development') {
        log.debug('All connections idle, will close based on idleTimeoutMillis')
      }
    }
  }, 60000) // Check every minute
}

export { pool }

/**
 * Execute a database query with logging and connection error handling
 * @param text - SQL query text
 * @param params - Query parameters
 * @returns Query result
 */
/**
 * Execute a database query with retry logic and comprehensive error handling
 * Optimized for AWS deployment with network resilience
 */
export async function query<T extends QueryResultRow = any>(
  text: string, 
  params?: any[],
  retries: number = 2
): Promise<QueryResult<T>> {
  const start = Date.now()
  let lastError: Error | null = null
  let client: any = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Use pool.query which automatically manages connection lifecycle
      // This ensures connections are properly released back to the pool
      // Use poolInstance if available, otherwise use pool (for compatibility)
      const currentPool = poolInstance || pool
      const res = await currentPool.query<T>(text, params)
      const duration = Date.now() - start
      
      // Only log slow queries or all queries in development
      if (process.env.NODE_ENV === 'development' || duration > 1000) {
        log.debug('Executed query', { 
          text: text.substring(0, 100), // Log first 100 chars to avoid huge logs
          duration: `${duration}ms`,
          rows: res.rowCount,
          attempt: attempt + 1,
          poolStats: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          }
        })
      }
      
      return res
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const duration = Date.now() - start
      const errorMessage = lastError.message
      const errorCode = (error as any)?.code
      
      // Handle "too many clients" error gracefully
      if (errorMessage.includes('too many clients') || errorCode === '53300') {
        const currentStats = {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        }
        
        log.error('Connection limit exceeded', new Error('Connection limit exceeded'), {
          poolStats: currentStats,
          query: text.substring(0, 100),
          maxConnections: parseInt(process.env.DB_POOL_MAX || '30', 10),
        })
        
        // Try to close idle connections if we have retries left
        if (currentStats.idle > 0 && attempt < retries) {
          log.warn('Closing idle connections to free up space')
          try {
            // Import and use the diagnostic utility
            const { closeIdleConnections } = await import('./db-diagnostics')
            const closed = await closeIdleConnections(5) // Close up to 5 idle connections
            log.info(`Closed ${closed} idle connections`)
          } catch (cleanupError) {
            log.warn('Error closing idle connections', { error: cleanupError })
          }
          
          // Wait a bit for connections to be released and pool to stabilize
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue // Retry the query
        }
        
        // If this was the last attempt, return user-friendly error
        if (attempt === retries) {
          const friendlyError = new Error('データベース接続が上限に達しました。しばらく待ってから再試行してください。')
          Object.assign(friendlyError, { 
            code: '53300',
            originalError: errorMessage,
          })
          throw friendlyError
        }
      }
      
      // Handle network errors (AWS-specific) - retry with exponential backoff
      const isNetworkError = 
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ENOTFOUND' ||
        errorCode === 'ECONNRESET' ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('network')
      
      if (isNetworkError && attempt < retries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000) // Max 5 seconds
        
        // For ECONNRESET, the connection was closed by the server - ensure we get a fresh connection
        if (errorCode === 'ECONNRESET') {
          log.warn(`Connection reset by server (attempt ${attempt + 1}/${retries + 1}), waiting ${backoffMs}ms for fresh connection`, { 
            error: errorMessage,
            poolStats: {
              total: pool.totalCount,
              idle: pool.idleCount,
              waiting: pool.waitingCount,
            }
          })
          // Wait a bit longer for ECONNRESET to ensure pool removes the bad connection
          await new Promise(resolve => setTimeout(resolve, backoffMs + 500))
        } else {
        log.warn(`Network error (attempt ${attempt + 1}/${retries + 1}), retrying in ${backoffMs}ms`, { error: errorMessage })
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        }
        continue
      }
      
      // Handle SSL errors (AWS-specific)
      if (errorMessage.includes('SSL') || errorMessage.includes('TLS') || errorCode === '28000') {
        // If server doesn't support SSL, automatically disable SSL and recreate pool
        if (errorMessage.includes('does not support SSL') || errorMessage.includes('SSL is not enabled')) {
          if (!sslDisabled) {
            await recreatePoolWithoutSSL()
          }
          
          // Retry without SSL if we have retries left
          if (attempt < retries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt), 2000)
            log.warn(`Retrying without SSL (attempt ${attempt + 1}/${retries + 1}) in ${backoffMs}ms`)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            continue
          }
        }
        log.error('SSL/TLS error - check DB_SSL environment variable', new Error(errorMessage), {
          message: 'To disable SSL, set DB_SSL=false in your .env file'
        })
        const sslError = new Error('データベースSSL接続エラーが発生しました。設定を確認してください。')
        Object.assign(sslError, { 
          code: errorCode || 'SSL_ERROR',
          originalError: errorMessage,
        })
        throw sslError
      }
      
      // Handle authentication errors
      if (errorMessage.includes('password') || errorMessage.includes('authentication') || errorCode === '28P01') {
        log.error('Authentication error - check DATABASE_URL', new Error(errorMessage))
        const authError = new Error('データベース認証エラーが発生しました。接続情報を確認してください。')
        Object.assign(authError, { 
          code: errorCode || 'AUTH_ERROR',
          originalError: errorMessage,
        })
        throw authError
      }
      
      // Handle ECONNRESET after all retries exhausted
      if (errorCode === 'ECONNRESET' && attempt === retries) {
        log.error('Connection reset error after all retries', lastError, {
          text: text.substring(0, 100),
          duration: `${duration}ms`,
          poolStats: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          }
        })
        const connResetError = new Error('データベース接続がリセットされました。しばらく待ってから再試行してください。')
        Object.assign(connResetError, {
          code: 'ECONNRESET',
          originalError: errorMessage,
        })
        throw connResetError
      }
      
      // Log error and throw if no retries left
      log.error('Database query error', lastError, { 
        text: text.substring(0, 100),
        duration: `${duration}ms`,
        error: errorMessage,
        code: errorCode,
        attempt: attempt + 1,
        retriesLeft: retries - attempt
      })
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw lastError
      }
    }
  }
  
  // Should never reach here, but TypeScript requires it
  throw lastError || new Error('Unknown database error')
}

