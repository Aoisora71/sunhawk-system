import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * PUT /api/notifications/read-all - Mark all notifications as read for the authenticated user
 */
async function handlePut(request: NextRequest, user: AuthenticatedUser) {
  try {
    const updateResult = await query<{ count: number }>(
      `UPDATE notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [user.userId]
    )

    return successResponse({
      message: `${updateResult.rows.length}件の通知を既読にしました`,
      markedAsRead: updateResult.rows.length,
    })
  } catch (error) {
    return handleError(error, "通知の一括既読処理に失敗しました", "Mark all notifications as read")
  }
}

export const PUT = withAuth(handlePut)

