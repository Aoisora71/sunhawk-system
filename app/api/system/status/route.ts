import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query, pool } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import os from "os"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

async function handleGet(request: NextRequest) {
  try {
    // Get system uptime
    const uptime = process.uptime()

    // Get memory usage
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryPercentage = (usedMemory / totalMemory) * 100

    // Get CPU usage
    // Note: CPU usage calculation requires sampling over time
    // For a simple implementation, we'll use load average as an approximation
    let cpuUsage = 0
    try {
      const loadAvg = os.loadavg()
      const cpuCount = os.cpus().length
      
      // Load average represents system load over 1, 5, and 15 minutes
      // We use 1-minute load average divided by CPU count as an approximation
      // This gives a rough estimate (0-1 range, multiply by 100 for percentage)
      const loadPercentage = (loadAvg[0] / cpuCount) * 100
      cpuUsage = Math.min(100, Math.max(0, loadPercentage))
    } catch (error) {
      console.error("Error calculating CPU usage:", error)
      cpuUsage = 0
    }

    // Get database connection status
    let dbStatus: "connected" | "disconnected" | "error" = "disconnected"
    let activeConnections = 0
    let poolSize = 0

    try {
      poolSize = pool.totalCount

      // Count active connections
      const result = await query<{ count: string }>(
        `SELECT count(*) as count 
         FROM pg_stat_activity 
         WHERE datname = current_database() 
         AND state = 'active'`
      )
      activeConnections = parseInt(result.rows[0]?.count || "0", 10)

      // Test connection with a simple query
      await query("SELECT 1")
      dbStatus = "connected"
    } catch (error) {
      console.error("Database connection check failed:", error)
      dbStatus = "error"
    }

    // Determine overall system status
    let systemStatus: "healthy" | "warning" | "error" = "healthy"
    // After try-catch, dbStatus can only be "connected" or "error"
    // The "disconnected" check is kept for type consistency but will never be true
    if (dbStatus === "error") {
      systemStatus = "error"
    } else if (memoryPercentage > 85 || cpuUsage > 85) {
      systemStatus = "warning"
    }

    const status = {
      status: systemStatus,
      uptime: Math.floor(uptime),
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round(memoryPercentage * 10) / 10,
      },
      cpu: {
        usage: Math.round(cpuUsage * 10) / 10,
      },
      database: {
        status: dbStatus,
        connections: activeConnections,
        poolSize: poolSize,
      },
      timestamp: new Date().toISOString(),
    }

    return successResponse({ status })
  } catch (error) {
    return handleError(error, "システム状態の取得に失敗しました", "Get system status")
  }
}

export const GET = withAdmin(handleGet)

