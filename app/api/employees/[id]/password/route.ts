import { type NextRequest } from "next/server"
import { withAdminParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse, notFoundResponse } from "@/lib/api-errors"

// POST /api/employees/[id]/password - 承認済みの保留中パスワードを本番パスワードとして反映
async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  try {
    const params = await context.params
    const employeeId = params.id

    // 保留中パスワードを取得
    const employeeCheck = await query<{
      id: number
      pending_password_hash: string | null
    }>("SELECT id, pending_password_hash FROM users WHERE id = $1", [employeeId])

    if (employeeCheck.rows.length === 0) {
      return notFoundResponse("従業員")
    }

    const employee = employeeCheck.rows[0]

    if (!employee.pending_password_hash) {
      return badRequestResponse("この従業員には保留中のパスワードリセット要求がありません")
    }

    // 保留中パスワードを本番パスワードとして反映し、保留情報をクリア
    await query(
      `UPDATE users 
       SET password_hash = $1,
           pending_password_hash = NULL,
           password_reset_requested_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [employee.pending_password_hash, employeeId],
    )

    return successResponse({
      message: "パスワードリセット要求を承認し、パスワードを更新しました",
    })
  } catch (error) {
    return handleError(error, "パスワードの更新に失敗しました", "Approve password reset")
  }
}

export const POST = withAdminParams(handlePost)

