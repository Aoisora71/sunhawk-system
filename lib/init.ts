/**
 * Application initialization
 * Call this at app startup to validate environment and initialize services
 */

import { initEnvironment } from './env-validation'

let initialized = false

/**
 * Initialize the application
 * Should be called once at startup
 */
export function initializeApp(): void {
  if (initialized) {
    return
  }

  try {
    // Validate environment variables
    initEnvironment()
    
    initialized = true
    
  } catch (error) {
    
    if (process.env.NODE_ENV === 'production') {
      // Fail fast in production
      throw error
    }
  }
}

/**
 * Check if application is initialized
 */
export function isInitialized(): boolean {
  return initialized
}

