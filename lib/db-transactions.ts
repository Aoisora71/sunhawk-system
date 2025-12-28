/**
 * Database Transaction Management
 * Provides transaction support for multi-step database operations
 */

import { PoolClient } from 'pg'
import { pool, query } from './db'
import { log } from './logger'

/**
 * Execute a function within a database transaction
 * Automatically commits on success or rolls back on error
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    log.debug('Transaction started')
    
    const result = await callback(client)
    
    await client.query('COMMIT')
    log.debug('Transaction committed')
    
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    log.error('Transaction rolled back', error instanceof Error ? error : new Error(String(error)))
    throw error
  } finally {
    client.release()
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function executeInTransaction(
  queries: Array<{ text: string; params?: any[] }>
): Promise<void> {
  await withTransaction(async (client) => {
    for (const { text, params } of queries) {
      await client.query(text, params)
    }
  })
}

/**
 * Transaction wrapper for API route handlers
 */
export function withTransactionHandler<T extends Record<string, string>>(
  handler: (request: Request, context: { params: Promise<T> }, client: PoolClient) => Promise<Response>
) {
  return async (request: Request, context: { params: Promise<T> }) => {
    return withTransaction(async (client) => {
      return handler(request, context, client)
    })
  }
}

