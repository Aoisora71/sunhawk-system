import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { successResponse, handleError } from "@/lib/api-errors"
import { exec, spawn } from "child_process"
import { promisify } from "util"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

const execAsync = promisify(exec)

function parseDatabaseUrl(url: string) {
  try {
    // Handle postgres:// and postgresql:// URLs
    // Decode URL-encoded characters in the connection string
    const decodedUrl = decodeURIComponent(url)
    const normalizedUrl = decodedUrl.replace(/^postgres:\/\//, "postgresql://")
    const urlObj = new URL(normalizedUrl)
    
    // Decode username and password in case they contain special characters
    const username = decodeURIComponent(urlObj.username)
    const password = urlObj.password ? decodeURIComponent(urlObj.password) : ""
    const database = urlObj.pathname.slice(1) // Remove leading '/'
    
    return {
      host: urlObj.hostname,
      port: urlObj.port || "5432",
      database: database || "sunhawk_system",
      user: username,
      password: password,
      // Check if SSL is required (common in AWS/Azure databases)
      ssl: urlObj.searchParams.get("sslmode") || (urlObj.hostname.includes(".amazonaws.com") || urlObj.hostname.includes(".rds.amazonaws.com") ? "require" : null),
    }
  } catch (error: any) {
    throw new Error(`無効なDATABASE_URL形式です: ${error.message}`)
  }
}

async function checkCommandExists(command: string): Promise<boolean> {
  try {
    // Check if command exists using 'which' (Unix) or 'where' (Windows)
    const checkCommand = process.platform === "win32" ? `where ${command}` : `which ${command}`
    await execAsync(checkCommand)
    return true
  } catch {
    return false
  }
}

async function handlePost(request: NextRequest) {
  let tempFilePath: string | null = null

  try {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      return handleError(
        new Error("DATABASE_URLが設定されていません"),
        "DATABASE_URLが設定されていません",
        "Restore database"
      )
    }

    // Check if psql is available
    const psqlExists = await checkCommandExists("psql")
    if (!psqlExists) {
      return handleError(
        new Error("psqlコマンドが見つかりません"),
        "psqlコマンドが見つかりません。PostgreSQLクライアントツールがインストールされていることを確認してください。",
        "Restore database"
      )
    }

    // Parse database URL
    const dbConfig = parseDatabaseUrl(databaseUrl)

    // Get the uploaded file from form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return handleError(
        new Error("ファイルが指定されていません"),
        "復元ファイルを指定してください",
        "Restore database"
      )
    }

    // Validate file type
    if (!file.name.endsWith(".sql")) {
      return handleError(
        new Error("無効なファイル形式です"),
        ".sqlファイルを指定してください",
        "Restore database"
      )
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      return handleError(
        new Error("ファイルサイズが大きすぎます"),
        "ファイルサイズは500MB以下である必要があります",
        "Restore database"
      )
    }

    // Save uploaded file to temporary location
    // Use a safe filename to avoid path injection
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const tempDir = tmpdir()
    tempFilePath = join(tempDir, `restore-${Date.now()}-${safeFileName}`)
    
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(tempFilePath, buffer)

    // Build psql command arguments (use array for better security)
    const restoreArgs: string[] = [
      "-h", dbConfig.host,
      "-p", dbConfig.port,
      "-U", dbConfig.user,
      "-d", dbConfig.database,
      "-f", tempFilePath,
      "-v", "ON_ERROR_STOP=1", // Stop on error
      "-q", // Quiet mode (less verbose output)
    ]

    // SSL mode is handled via PGSSLMODE environment variable
    // No additional command line arguments needed for SSL

    // Set password as environment variable for psql
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PGPASSWORD: dbConfig.password,
    }
    
    // For SSL connections, set additional environment variables
    if (dbConfig.ssl && (dbConfig.ssl === "require" || dbConfig.ssl === "prefer")) {
      env.PGSSLMODE = dbConfig.ssl
    }

    try {
      // Execute psql using spawn for better argument handling
      const psqlProcess = spawn("psql", restoreArgs, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stdout = ""
      let stderr = ""
      const timeout = setTimeout(() => {
        psqlProcess.kill("SIGTERM")
      }, 600000) // 10 minute timeout for restore

      psqlProcess.stdout?.on("data", (data) => {
        stdout += data.toString()
      })

      psqlProcess.stderr?.on("data", (data) => {
        stderr += data.toString()
      })

      const exitCode = await new Promise<number>((resolve, reject) => {
        psqlProcess.on("close", (code) => {
          clearTimeout(timeout)
          resolve(code || 0)
        })
        psqlProcess.on("error", (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      if (exitCode !== 0) {
        throw new Error(`psql exited with code ${exitCode}: ${stderr.substring(0, 500)}`)
      }

      // psql writes warnings and notices to stderr
      // Check for actual errors even if exit code is 0
      const stderrLines = stderr ? stderr.split("\n") : []
      const errorLines = stderrLines.filter(
        (line) =>
          line.trim() &&
          !line.includes("WARNING") &&
          !line.includes("NOTICE") &&
          !line.includes("INFO") &&
          !line.toLowerCase().includes("psql:") && // psql info messages
          !line.match(/^[A-Z_]+=/) && // Variable assignments
          (line.toLowerCase().includes("error") || line.toLowerCase().includes("fatal"))
      )

      if (errorLines.length > 0) {
        const errorMessage = errorLines.join("\n")
                throw new Error(`データベース復元中にエラーが発生しました: ${errorMessage.substring(0, 500)}`)
      }

      // Clean up temporary file
      if (tempFilePath) {
        try {
          await unlink(tempFilePath)
        } catch (cleanupError) {
                    // Don't fail the restore if cleanup fails
        }
      }

      return successResponse({
        message: "データベースの復元が完了しました",
        details: stdout ? stdout.substring(0, 500) : undefined, // Limit response size
      })
    } catch (spawnError: any) {
      // Handle execution errors
      if (spawnError.code === "ENOENT") {
        throw new Error("psqlコマンドが見つかりません。PostgreSQLクライアントツールがインストールされていることを確認してください。")
      } else if (spawnError.signal === "SIGTERM") {
        throw new Error("復元処理がタイムアウトしました。ファイルサイズが大きすぎる可能性があります。")
      } else {
        throw new Error(`復元処理中にエラーが発生しました: ${spawnError.message || String(spawnError)}`)
      }
    }
  } catch (error: any) {
    // Clean up temporary file on error
    if (tempFilePath) {
      try {
        await unlink(tempFilePath).catch(() => {})
      } catch (cleanupError) {
              }
    }

        return handleError(
      error,
      error.message || "データベースの復元に失敗しました",
      "Restore database"
    )
  }
}

export const POST = withAdmin(handlePost)
