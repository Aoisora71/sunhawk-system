/**
 * Structured Logging System
 * Replaces console.log/error/warn with structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: Error
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatLog(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(error && { error: { name: error.name, message: error.message, stack: error.stack } }),
    }
  }

  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // In development, use console with colors
      const colors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
      }
      const reset = '\x1b[0m'
      const levelUpper = entry.level.toUpperCase().padEnd(5)
      const color = colors[entry.level]
      
      if (entry.context) {
        console.log(`${color}${levelUpper}${reset} ${entry.message}`, entry.context)
      } else if (entry.error) {
        console.error(`${color}${levelUpper}${reset} ${entry.message}`, entry.error)
      } else {
        console.log(`${color}${levelUpper}${reset} ${entry.message}`)
      }
    } else {
      // In production, output as JSON for log aggregation
      console.log(JSON.stringify(entry))
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      this.output(this.formatLog('debug', message, context))
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.output(this.formatLog('info', message, context))
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.output(this.formatLog('warn', message, context))
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.output(this.formatLog('error', message, context, error))
  }
}

// Export singleton instance
export const logger = new Logger()

// Export convenience functions
export const log = {
  debug: (message: string, context?: Record<string, unknown>) => logger.debug(message, context),
  info: (message: string, context?: Record<string, unknown>) => logger.info(message, context),
  warn: (message: string, context?: Record<string, unknown>) => logger.warn(message, context),
  error: (message: string, error?: Error, context?: Record<string, unknown>) => logger.error(message, error, context),
}

