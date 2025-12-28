import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"
import { MAX_NOTIFICATIONS_PER_USER, pruneNotificationsForUser } from "@/lib/notifications"

/**
 * GET /api/notifications - Get notifications for the authenticated user
 * Query params: ?unreadOnly=true (optional)
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    await pruneNotificationsForUser(user.userId)
    let sql = `
      SELECT 
        n.id,
        n.user_id as "userId",
        n.survey_id as "surveyId",
        n.title,
        n.message,
        n.is_read as "isRead",
        n.created_at as "createdAt",
        n.read_at as "readAt",
        n.created_by as "createdBy",
        s.name as "surveyName"
      FROM notifications n
      LEFT JOIN surveys s ON n.survey_id = s.id
      WHERE n.user_id = $1
    `

    const params: any[] = [user.userId]

    if (unreadOnly) {
      sql += " AND n.is_read = false"
    }

    const limitParamPosition = params.length + 1
    sql += ` ORDER BY n.created_at DESC, n.id DESC LIMIT $${limitParamPosition}`
    params.push(MAX_NOTIFICATIONS_PER_USER)

    const result = await query(sql, params)

    const notifications = result.rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      surveyId: row.surveyId,
      title: row.title,
      message: row.message,
      isRead: row.isRead,
      createdAt: row.createdAt,
      readAt: row.readAt,
      createdBy: row.createdBy,
      surveyName: row.surveyName || null,
    }))

    return successResponse({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    })
  } catch (error) {
    return handleError(error, "通知の取得に失敗しました", "Get notifications")
  }
}

export const GET = withAuth(handleGet)

