// Standardized API error handling

import { NextResponse } from 'next/server'
import { ApiResponse } from './types'
import { log } from './logger'

/**
 * Standard error response factory
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: string
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: message,
  }

  if (details && process.env.NODE_ENV === 'development') {
    response.details = details
  }

  return NextResponse.json(response, { status })
}

/**
 * Success response factory
 */
export function successResponse<T = any>(
  data: T,
  status: number = 200
): NextResponse<ApiResponse & T> {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status }
  )
}

/**
 * Not found error response
 */
export function notFoundResponse(resource: string = 'Resource'): NextResponse<ApiResponse> {
  return errorResponse(`${resource}が見つかりません`, 404)
}

/**
 * Unauthorized error response
 */
export function unauthorizedResponse(): NextResponse<ApiResponse> {
  return errorResponse('認証が必要です', 401)
}

/**
 * Forbidden error response
 */
export function forbiddenResponse(): NextResponse<ApiResponse> {
  return errorResponse('管理者権限が必要です', 403)
}

/**
 * Bad request error response
 */
export function badRequestResponse(message: string): NextResponse<ApiResponse> {
  return errorResponse(message, 400)
}

/**
 * Conflict error response (e.g., duplicate entry)
 */
export function conflictResponse(message: string): NextResponse<ApiResponse> {
  return errorResponse(message, 409)
}

/**
 * Internal server error response
 */
export function internalErrorResponse(
  message: string = 'サーバーエラーが発生しました',
  details?: string
): NextResponse<ApiResponse> {
  return errorResponse(message, 500, details)
}

/**
 * Sanitize error message to prevent information leakage
 */
function sanitizeError(error: any): string | undefined {
  if (!error) return undefined
  
  const message = error?.message || String(error)
  
  // Don't expose internal details in production
  if (process.env.NODE_ENV === 'production') {
    // Remove stack traces, file paths, and sensitive information
    return message
      .replace(/at\s+.*\n/g, '') // Remove stack trace lines
      .replace(/\/.*?\/node_modules\/.*/g, '') // Remove file paths
      .replace(/password|secret|key|token/gi, '[REDACTED]') // Remove sensitive keywords
      .substring(0, 200) // Limit length
  }
  
  return message
}

/**
 * Log and return error response
 */
export function handleError(
  error: any,
  defaultMessage: string = '処理に失敗しました',
  context?: string
): NextResponse<ApiResponse> {
  // Log full error details (server-side only)
  log.error(`${context || 'Error'}`, error instanceof Error ? error : new Error(String(error)), {
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
  })

  // Sanitize error details for client response
  const details = sanitizeError(error)
  return internalErrorResponse(defaultMessage, details)
}

