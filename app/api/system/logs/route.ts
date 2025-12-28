import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { successResponse, handleError } from "@/lib/api-errors"
import fs from "fs/promises"
import path from "path"

interface LogEntry {
  timestamp: string
  level: "info" | "warn" | "error" | "debug"
  message: string
  context?: Record<string, unknown>
}

async function handleGet(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const logType = searchParams.get("type") || "error" // error, out, or both

    const logs: LogEntry[] = []
    const logDir = path.join(process.cwd(), "logs")

    try {
      // Read error log
      if (logType === "error" || logType === "both") {
        try {
          const errorLogPath = path.join(logDir, "error.log")
          const errorLogContent = await fs.readFile(errorLogPath, "utf-8")
          const errorLines = errorLogContent.split("\n").filter((line) => line.trim())

          for (const line of errorLines.slice(-limit)) {
            try {
              // Try to parse as JSON first (structured logging)
              const parsed = JSON.parse(line)
              logs.push({
                timestamp: parsed.timestamp || new Date().toISOString(),
                level: parsed.level || "error",
                message: parsed.message || line,
                context: parsed.context,
              })
            } catch {
              // If not JSON, treat as plain text log
              const timestampMatch = line.match(/\[([^\]]+)\]/)
              logs.push({
                timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
                level: "error",
                message: line,
              })
            }
          }
        } catch (error: any) {
          if (error.code !== "ENOENT") {
            
          }
        }
      }

      // Read output log
      if (logType === "out" || logType === "both") {
        try {
          const outLogPath = path.join(logDir, "out.log")
          const outLogContent = await fs.readFile(outLogPath, "utf-8")
          const outLines = outLogContent.split("\n").filter((line) => line.trim())

          for (const line of outLines.slice(-limit)) {
            try {
              const parsed = JSON.parse(line)
              logs.push({
                timestamp: parsed.timestamp || new Date().toISOString(),
                level: parsed.level || "info",
                message: parsed.message || line,
                context: parsed.context,
              })
            } catch {
              const timestampMatch = line.match(/\[([^\]]+)\]/)
              logs.push({
                timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
                level: "info",
                message: line,
              })
            }
          }
        } catch (error: any) {
          if (error.code !== "ENOENT") {
            
          }
        }
      }

      // Sort by timestamp (newest first) and limit
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      const limitedLogs = logs.slice(0, limit)

      return successResponse({ logs: limitedLogs })
    } catch (error: any) {
      // If logs directory doesn't exist, return empty array
      if (error.code === "ENOENT") {
        return successResponse({ logs: [] })
      }
      throw error
    }
  } catch (error) {
    return handleError(error, "ログの取得に失敗しました", "Get system logs")
  }
}

export const GET = withAdmin(handleGet)



