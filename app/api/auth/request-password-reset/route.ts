import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { query } from "@/lib/db"
import { passwordResetRequestSchema, validateRequest } from "@/lib/validation"
import { badRequestResponse, handleError, successResponse } from "@/lib/api-errors"

// ユーザーがログイン画面からパスワードリセットを申請するエンドポイント
// Body: { email: string, newPassword: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = await validateRequest(passwordResetRequestSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { email, newPassword } = validation.data

    // 対象ユーザーを検索
    const userRes = await query<{ id: number }>(
      "SELECT id FROM users WHERE email = $1",
      [email],
    )

    // セキュリティ上、存在しなくても成功レスポンスを返す
    if (userRes.rows.length === 0) {
      return successResponse({
        message:
          "パスワードリセット要求を受け付けました。\n管理者に連絡して承認を依頼してください。",
      })
    }

    const user = userRes.rows[0]
    const pendingHash = await bcrypt.hash(newPassword, 10)

    // ユーザーに「保留中パスワード」を登録（管理者が承認するまで有効にならない）
    await query(
      `UPDATE users 
       SET pending_password_hash = $1,
           password_reset_requested_at = NOW()
       WHERE id = $2`,
      [pendingHash, user.id],
    )

    return successResponse({
      message:
        "パスワードリセット要求をサービスに送信しました。\n管理者に連絡して承認を依頼してください。",
    })
  } catch (error) {
    return handleError(error, "パスワードリセット要求の送信に失敗しました", "Request Password Reset")
  }
}


