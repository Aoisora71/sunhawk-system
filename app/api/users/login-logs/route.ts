import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/middleware"

export async function GET(request: NextRequest) {
  try {
    // Verify admin authorization
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: "管理者のみがログインログを詳細できます" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "1000")
    const userId = searchParams.get("userId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let logsQuery = `
      SELECT 
        ll.id,
        ll.user_id,
        u.name as user_name,
        ll.email,
        ll.login_at,
        ll.ip_address,
        ll.user_agent,
        ll.login_status,
        ll.failure_reason
      FROM login_logs ll
      LEFT JOIN users u ON ll.user_id = u.id
      WHERE 1=1
    `

    const values: any[] = []
    let paramIndex = 1

    if (userId) {
      logsQuery += ` AND ll.user_id = $${paramIndex++}`
      values.push(userId)
    }

    if (startDate) {
      logsQuery += ` AND ll.login_at >= $${paramIndex++}::timestamp`
      values.push(startDate.trim())
    }

    if (endDate) {
      logsQuery += ` AND ll.login_at <= $${paramIndex++}::timestamp`
      values.push(endDate.trim())
    }

    logsQuery += ` ORDER BY ll.login_at DESC LIMIT $${paramIndex}`
    values.push(limit)

    const result = await query(logsQuery, values)

    const logs = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      email: row.email,
      loginAt: row.login_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      loginStatus: row.login_status,
      failureReason: row.failure_reason,
    }))

    return NextResponse.json({
      success: true,
      logs,
    })
  } catch (error) {
    console.error("Get login logs error:", error)
    return NextResponse.json({ error: "ログインログの取得に失敗しました" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authorization
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: "管理者のみがログインログを削除できます" }, { status: 403 })
    }

    // Delete all login logs
    await query("DELETE FROM login_logs", [])

    return NextResponse.json({
      success: true,
      message: "ログイン履歴を初期化しました",
    })
  } catch (error) {
    console.error("Delete login logs error:", error)
    return NextResponse.json({ error: "ログインログの削除に失敗しました" }, { status: 500 })
  }
}

