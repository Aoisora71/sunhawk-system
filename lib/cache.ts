/**
 * Simple in-memory cache for frequently accessed data
 * For production with 60+ concurrent users, consider using Redis
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL = 10 * 60 * 1000 // 10 minutes default (increased for 70 users)
  private maxSize = 1000 // Maximum cache entries to prevent memory issues

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Remove oldest expired entries first
      this.cleanup()
      
      // If still full, remove oldest entry
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value
        if (firstKey) {
          this.cache.delete(firstKey)
        }
      }
    }
    
    const expiresAt = Date.now() + (ttlMs || this.defaultTTL)
    this.cache.set(key, { data, expiresAt })
  }

  /**
   * Delete cached data
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries (should be called periodically)
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }
}

// Singleton instance
export const cache = new SimpleCache()

// Cleanup expired entries every 3 minutes (more frequent for 70 users)
// With proper cleanup for AWS/serverless environments
let cacheCleanupInterval: NodeJS.Timeout | null = null
if (typeof setInterval !== 'undefined') {
  cacheCleanupInterval = setInterval(() => {
    cache.cleanup()
  }, 3 * 60 * 1000)
}

// Cleanup interval on process termination (important for AWS/serverless)
if (typeof process !== 'undefined') {
  const cleanup = () => {
    if (cacheCleanupInterval) {
      clearInterval(cacheCleanupInterval)
      cacheCleanupInterval = null
    }
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('beforeExit', cleanup)
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  departments: () => 'departments:all',
  jobs: () => 'jobs:all',
  employees: (userId?: number) => userId ? `employees:user:${userId}` : 'employees:all',
  department: (id: number) => `department:${id}`,
  job: (id: number) => `job:${id}`,
  user: (id: number) => `user:${id}`,
  survey: (id: number) => `survey:${id}`,
  tableExists: (tableName: string) => `table:exists:${tableName}`,
  orgSurveySummary: (userId: number, surveyId?: string, forOrg?: boolean) => 
    `org_survey_summary:${userId}:${surveyId || 'all'}:${forOrg || false}`,
}

