import { type NextRequest, NextResponse } from "next/server"
import { withAuthParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse, notFoundResponse } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * PUT /api/notifications/[id]/read - Mark a notification as read
 */
async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: AuthenticatedUser
) {
  try {
    const params = await context.params
    const notificationId = parseInt(params.id, 10)

    if (isNaN(notificationId)) {
      return badRequestResponse("無効な通知IDです")
    }

    // Verify the notification belongs to the user
    const checkResult = await query<{ id: number; is_read: boolean }>(
      `SELECT id, is_read
       FROM notifications
       WHERE id = $1 AND user_id = $2`,
      [notificationId, user.userId]
    )

    if (checkResult.rows.length === 0) {
      return notFoundResponse("通知が見つかりません")
    }

    const notification = checkResult.rows[0]

    // If already read, return success
    if (notification.is_read) {
      return successResponse({
        message: "通知は既に既読になっています",
        notification: {
          id: notification.id,
          isRead: true,
        },
      })
    }

    // Mark as read
    const updateResult = await query<{
      id: number
      is_read: boolean
      read_at: string
    }>(
      `UPDATE notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_read, read_at`,
      [notificationId, user.userId]
    )

    return successResponse({
      message: "通知を既読にしました",
      notification: {
        id: updateResult.rows[0].id,
        isRead: updateResult.rows[0].is_read,
        readAt: updateResult.rows[0].read_at,
      },
    })
  } catch (error) {
    return handleError(error, "通知の既読処理に失敗しました", "Mark notification as read")
  }
}

export const PUT = withAuthParams(handlePut)

