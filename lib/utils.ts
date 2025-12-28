import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Logs errors only in development mode
 * In production, errors should be handled gracefully without logging to console
 */
export function logError(message: string, error?: unknown) {
  if (process.env.NODE_ENV === 'development') {
    if (error) {
          } else {
          }
  }
  // In production, you might want to send errors to an error tracking service
  // e.g., Sentry, LogRocket, etc.
}
