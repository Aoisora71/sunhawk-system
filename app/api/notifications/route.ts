import { type NextRequest } from "next/server"
import { withAdmin, withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AdminUser, AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/notifications - Get notifications for the authenticated user
 * Query params: unreadOnly (optional) - If true, only return unread notifications
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"

    let queryText = `
      SELECT 
        id,
        user_id,
        survey_id,
        title,
        message,
        COALESCE(is_read, false) as is_read,
        COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
        read_at,
        created_by
      FROM notifications
      WHERE user_id = $1
    `

    const params: any[] = [user.userId]

    if (unreadOnly) {
      queryText += ` AND COALESCE(is_read, false) = false`
    }

    queryText += ` ORDER BY COALESCE(created_at, CURRENT_TIMESTAMP) DESC, id DESC LIMIT 50`

    const result = await query<{
      id: number
      user_id: number
      survey_id: number | null
      title: string
      message: string
      is_read: boolean
      created_at: string
      read_at: string | null
      created_by: number | null
    }>(queryText, params)

    const notifications = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      surveyId: row.survey_id,
      title: row.title,
      message: row.message,
      isRead: row.is_read,
      createdAt: row.created_at,
      readAt: row.read_at,
      createdBy: row.created_by,
    }))

    // Count unread notifications
    const unreadResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND COALESCE(is_read, false) = false`,
      [user.userId]
    )

    const unreadCount = unreadResult.rows[0]?.count || 0

    return successResponse({
      notifications,
      unreadCount: Number(unreadCount),
    })
  } catch (error) {
    return handleError(error, "通知の取得に失敗しました", "Get notifications")
  }
}

/**
 * DELETE /api/notifications - Delete all notifications
 */
async function handleDelete(request: NextRequest, user: AdminUser) {
  try {
    // Delete all notifications
    await query(`DELETE FROM notifications`)

    return successResponse({
      message: "通知履歴をすべて削除しました",
    })
  } catch (error) {
    return handleError(error, "通知履歴の削除に失敗しました", "Delete notifications")
  }
}

export const GET = withAuth(handleGet)
export const DELETE = withAdmin(handleDelete)
