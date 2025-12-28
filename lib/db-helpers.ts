// Database helper functions for common operations
import { query } from './db'
import { cache, cacheKeys } from './cache'

/**
 * Check if a table exists in the database (with caching)
 */
export async function tableExists(tableName: string): Promise<boolean> {
  // Cache table existence checks for 1 hour (tables rarely change)
  const cacheKey = cacheKeys.tableExists(tableName)
  const cached = cache.get<boolean>(cacheKey)
  
  if (cached !== null) {
    return cached
  }

  const result = await query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  )
  
  const exists = result.rows[0]?.exists === true
  cache.set(cacheKey, exists, 60 * 60 * 1000) // Cache for 1 hour
  return exists
}

/**
 * Convert database row to API response format
 * Handles common conversions like number to string for IDs
 */
export function formatRow<T extends Record<string, any>>(
  row: T,
  idFields: string[] = ['id']
): T {
  const formatted = { ...row }
  for (const field of idFields) {
    if (formatted[field] != null) {
      (formatted as any)[field] = (formatted[field] as any).toString()
    }
  }
  return formatted
}

/**
 * Format multiple rows for API response
 */
export function formatRows<T extends Record<string, any>>(
  rows: T[],
  idFields: string[] = ['id']
): T[] {
  return rows.map(row => formatRow(row, idFields))
}

/**
 * Parse integer from string or number safely
 */
export function parseIntSafe(value: string | number | null | undefined, defaultValue: number = 0): number {
  if (value == null) return defaultValue
  const parsed = typeof value === 'string' ? parseInt(value, 10) : value
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Parse float from string or number safely
 */
export function parseFloatSafe(value: string | number | null | undefined, defaultValue: number = 0): number {
  if (value == null) return defaultValue
  const parsed = typeof value === 'string' ? parseFloat(value) : value
  return isNaN(parsed) ? defaultValue : parsed
}

