/**
 * Server-side Pagination Utilities
 * Provides pagination helpers for API routes
 */

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit)

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  }
}

/**
 * Get pagination SQL clauses
 */
export function getPaginationSQL(params: PaginationParams): {
  limitClause: string
  offsetClause: string
  params: number[]
} {
  return {
    limitClause: 'LIMIT $1',
    offsetClause: 'OFFSET $2',
    params: [params.limit, params.offset],
  }
}

/**
 * Apply pagination to a SQL query
 * Handles parameter numbering correctly
 */
export function applyPaginationToQuery(
  baseQuery: string,
  pagination: PaginationParams,
  existingParams: any[] = []
): string {
  const paramOffset = existingParams.length
  return `${baseQuery} LIMIT $${paramOffset + 1} OFFSET $${paramOffset + 2}`
}

/**
 * Parse pagination from URLSearchParams
 */
export function parsePaginationParamsFromSearchParams(
  searchParams: URLSearchParams,
  defaultLimit: number = 20,
  maxLimit: number = 100
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit), 10))
  )
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Parse pagination from NextRequest
 */
export function parsePaginationParams(
  request: { nextUrl: { searchParams: URLSearchParams } },
  defaultLimit: number = 20,
  maxLimit: number = 100
): PaginationParams {
  return parsePaginationParamsFromSearchParams(
    request.nextUrl.searchParams,
    defaultLimit,
    maxLimit
  )
}

/**
 * Count total records (for pagination)
 */
export async function countRecords(
  countQuery: string,
  countParams: any[] = []
): Promise<number> {
  const { query } = await import('./db')
  const result = await query<{ count: string }>(countQuery, countParams)
  return parseInt(result.rows[0]?.count || '0', 10)
}
