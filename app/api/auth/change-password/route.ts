import { type NextRequest } from "next/server"
import bcrypt from "bcrypt"
import { query } from "@/lib/db"
import { changePasswordSchema, validateRequest } from "@/lib/validation"
import { withAuth } from "@/lib/middleware"
import { successResponse, badRequestResponse, handleError } from "@/lib/api-errors"

async function handlePost(
  request: NextRequest,
  user: { userId: number; email: string; role: string }
) {
  try {
    const body = await request.json()
    const validation = await validateRequest(changePasswordSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { currentPassword, newPassword } = validation.data

    // Get current user's password hash
    const userResult = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [user.userId]
    )

    if (userResult.rows.length === 0) {
      return badRequestResponse("ユーザーが見つかりません")
    }

    const passwordHash = userResult.rows[0].password_hash

    // Verify current password
    if (!passwordHash) {
      return badRequestResponse("パスワードが設定されていません")
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, passwordHash)
    if (!isCurrentPasswordValid) {
      return badRequestResponse("現在のパスワードが正しくありません")
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, passwordHash)
    if (isSamePassword) {
      return badRequestResponse("新しいパスワードは現在のパスワードと異なる必要があります")
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // Update password
    await query(
      `UPDATE users 
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newPasswordHash, user.userId]
    )

    return successResponse({
      message: "パスワードを変更しました",
    })
  } catch (error) {
    return handleError(error, "パスワードの変更に失敗しました", "Change password")
  }
}

export const POST = withAuth(handlePost)

