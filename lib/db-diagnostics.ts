/**
 * Database connection pool diagnostics and utilities
 */

import { pool } from './db'

/**
 * Get current pool statistics
 */
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    active: pool.totalCount - pool.idleCount,
    max: parseInt(process.env.DB_POOL_MAX || '30', 10),
    usagePercent: Math.round((pool.totalCount / parseInt(process.env.DB_POOL_MAX || '30', 10)) * 100),
  }
}

/**
 * Force close idle connections
 * @param count - Number of idle connections to close (default: all but 2)
 */
export async function closeIdleConnections(count?: number): Promise<number> {
  const poolAny = pool as any
  let closed = 0
  
  try {
    if (poolAny._idle && poolAny._idle.length > 0) {
      const targetCount = count || Math.max(0, poolAny._idle.length - 2) // Keep at least 2
      const toClose = Math.min(targetCount, poolAny._idle.length)
      
      for (let i = 0; i < toClose && poolAny._idle.length > 0; i++) {
        const client = poolAny._idle.shift()
        if (client) {
          try {
            await client.end()
            closed++
          } catch (err) {
            // Ignore errors when closing
          }
        }
      }
    }
  } catch (error) {
    
  }
  
  return closed
}

/**
 * Check if pool is healthy
 */
export function isPoolHealthy(): { healthy: boolean; reason?: string; stats: ReturnType<typeof getPoolStats> } {
  const stats = getPoolStats()
  
  if (stats.total >= stats.max) {
    return {
      healthy: false,
      reason: `Pool at maximum capacity (${stats.total}/${stats.max})`,
      stats,
    }
  }
  
  if (stats.usagePercent >= 90) {
    return {
      healthy: false,
      reason: `Pool usage very high (${stats.usagePercent}%)`,
      stats,
    }
  }
  
  if (stats.waiting > 10) {
    return {
      healthy: false,
      reason: `Too many waiting requests (${stats.waiting})`,
      stats,
    }
  }
  
  return {
    healthy: true,
    stats,
  }
}

