import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { successResponse, handleError } from "@/lib/api-errors"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

async function handlePost(request: NextRequest) {
  try {
    // Check if PM2 is available and running
    let usePm2 = false
    try {
      await execAsync("pm2 --version")
      usePm2 = true
    } catch {
      // PM2 not available
    }

    // Log the restart request
    
    if (usePm2) {
      try {
        // Try to get PM2 process name from environment or use default
        const pm2Name = process.env.PM2_APP_NAME || "sunhawk-system"
        
        // Trigger PM2 restart (don't await, let it happen asynchronously)
        execAsync(`pm2 restart ${pm2Name}`, { timeout: 5000 }).catch((error) => {
                  })
        
        return successResponse({
          message: "システム再起動を開始しました（PM2経由）",
        })
      } catch (error: any) {
                // Continue to fallback method
      }
    }

    // If PM2 is not available or restart failed, use graceful shutdown
    // The process manager (systemd, Docker, etc.) should restart the process
    // Schedule graceful shutdown after a delay to allow response to be sent
    setTimeout(() => {
            process.exit(0)
    }, 2000)

    return successResponse({
      message: "システム再起動のリクエストを受け付けました",
      note: "プロセスを終了します。プロセスマネージャーが自動的に再起動します。",
    })
  } catch (error) {
    return handleError(error, "システム再起動に失敗しました", "Restart system")
  }
}

export const POST = withAdmin(handlePost)

