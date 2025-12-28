import { type NextRequest, NextResponse } from "next/server"
import { withAdmin, type AdminUser } from "@/lib/middleware"
import { handleError } from "@/lib/api-errors"
import { exec, spawn } from "child_process"
import { promisify } from "util"

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

async function handlePost(request: NextRequest, user: AdminUser) {
  try {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      return NextResponse.json(
        { success: false, error: "DATABASE_URLが設定されていません" },
        { status: 500 }
      )
    }

    // Check if pg_dump is available
    const pgDumpExists = await checkCommandExists("pg_dump")
    if (!pgDumpExists) {
      return NextResponse.json(
        {
          success: false,
          error: "pg_dumpコマンドが見つかりません。PostgreSQLクライアントツールがインストールされていることを確認してください。",
        },
        { status: 500 }
      )
    }

    // Parse database URL
    const dbConfig = parseDatabaseUrl(databaseUrl)
    
    // Build pg_dump command arguments (use array for better security)
    const dumpArgs: string[] = [
      "-h", dbConfig.host,
      "-p", dbConfig.port,
      "-U", dbConfig.user,
      "-d", dbConfig.database,
      "--no-owner", // Don't output commands to set ownership
      "--no-privileges", // Don't output commands to set privileges
      "--clean", // Include DROP commands
      "--if-exists", // Use IF EXISTS for DROP commands
      "-Fp", // Plain text format
    ]

    // SSL mode is handled via PGSSLMODE environment variable
    // No additional command line arguments needed for SSL

    // Set password as environment variable for pg_dump
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PGPASSWORD: dbConfig.password,
    }
    
    // For SSL connections, set additional environment variables
    if (dbConfig.ssl && (dbConfig.ssl === "require" || dbConfig.ssl === "prefer")) {
      env.PGSSLMODE = dbConfig.ssl
    }

    try {
      // Execute pg_dump using spawn for better argument handling
      const pgDumpProcess = spawn("pg_dump", dumpArgs, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stdout = ""
      let stderr = ""
      const timeout = setTimeout(() => {
        pgDumpProcess.kill("SIGTERM")
      }, 300000) // 5 minute timeout

      pgDumpProcess.stdout?.on("data", (data) => {
        stdout += data.toString()
      })

      pgDumpProcess.stderr?.on("data", (data) => {
        stderr += data.toString()
      })

      const exitCode = await new Promise<number>((resolve, reject) => {
        pgDumpProcess.on("close", (code) => {
          clearTimeout(timeout)
          resolve(code || 0)
        })
        pgDumpProcess.on("error", (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      if (exitCode !== 0) {
        throw new Error(`pg_dump exited with code ${exitCode}: ${stderr.substring(0, 500)}`)
      }

      // pg_dump writes progress messages and warnings to stderr
      // Check for actual errors even if exit code is 0
      const stderrLines = stderr ? stderr.split("\n") : []
      const errorLines = stderrLines.filter(
        (line) =>
          line.trim() &&
          !line.includes("WARNING") &&
          !line.includes("NOTICE") &&
          !line.includes("processing data") &&
          !line.includes("dumping") &&
          !line.includes("done") &&
          (line.toLowerCase().includes("error") || line.toLowerCase().includes("fatal"))
      )

      if (errorLines.length > 0) {
        const errorMessage = errorLines.join("\n")
        console.error("pg_dump errors:", errorMessage)
        throw new Error(`pg_dump実行中にエラーが発生しました: ${errorMessage.substring(0, 500)}`)
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").split(".")[0]
      const filename = `sunhawk-backup-${timestamp}.sql`

      // Return SQL dump as file download
      return new NextResponse(stdout, {
        status: 200,
        headers: {
          "Content-Type": "application/sql; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    } catch (spawnError: any) {
      // Handle execution errors
      if (spawnError.code === "ENOENT") {
        throw new Error("pg_dumpコマンドが見つかりません。PostgreSQLクライアントツールがインストールされていることを確認してください。")
      } else if (spawnError.signal === "SIGTERM") {
        throw new Error("バックアップ処理がタイムアウトしました。データベースサイズが大きすぎる可能性があります。")
      } else {
        throw new Error(`バックアップ処理中にエラーが発生しました: ${spawnError.message || String(spawnError)}`)
      }
    }
  } catch (error: any) {
    console.error("Database backup error:", error)
    return handleError(
      error,
      error.message || "データベースバックアップの作成に失敗しました",
      "Database backup"
    )
  }
}

export const POST = withAdmin(handlePost)
