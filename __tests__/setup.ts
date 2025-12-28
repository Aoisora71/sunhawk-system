/**
 * Test setup and configuration
 */

// Mock environment variables for tests
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only-min-32-chars'

// Suppress console logs in tests unless DEBUG is set
if (!process.env.DEBUG) {
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn

  console.log = () => {}
  console.error = () => {}
  console.warn = () => {}
}

