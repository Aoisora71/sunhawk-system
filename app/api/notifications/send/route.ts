import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { AdminUser } from "@/lib/middleware"
import { pruneNotificationsForUser } from "@/lib/notifications"

/**
 * POST /api/notifications/send - Send notifications to employees
 * Body: { surveyId: string, userIds: number[], message?: string }
 */
async function handlePost(request: NextRequest, user: AdminUser) {
  try {
    const body = await request.json()
    
    // Validate input
    if (!body.surveyId || !body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
      return badRequestResponse("surveyIdとuserIdsは必須です")
    }

    const { surveyId, userIds, message } = body

    // Validate userIds are numbers
    if (!userIds.every((id: unknown) => typeof id === 'number' && Number.isInteger(id))) {
      return badRequestResponse("userIdsは数値の配列である必要があります")
    }

    // Get survey details
    const surveyResult = await query<{
      id: number
      name: string
      start_date: string
      end_date: string
    }>(
      `SELECT id, name, start_date, end_date
       FROM surveys
       WHERE id = $1`,
      [surveyId]
    )

    if (surveyResult.rows.length === 0) {
      return badRequestResponse("サーベイが見つかりません")
    }

    const survey = surveyResult.rows[0]

    const formatMonthDay = (isoDate: string) => {
      const d = new Date(isoDate)
      if (Number.isNaN(d.getTime())) return isoDate
      const month = d.getMonth() + 1
      const day = d.getDate()
      return `${month}月${day}日`
    }

    // Get user emails
    const usersResult = await query<{
      id: number
      name: string
      email: string
    }>(
      `SELECT id, name, email
       FROM users
       WHERE id = ANY($1::int[])
         AND role <> 'admin'`,
      [userIds]
    )

    if (usersResult.rows.length === 0) {
      return badRequestResponse("通知を送信できる従業員が見つかりません（管理者は対象外です）")
    }

    const defaultMessage = `ソシキサーベイ「${survey.name}」への回答をお願いいたします。\n\nサーベイ期間: ${formatMonthDay(
      survey.start_date,
    )} ～ ${formatMonthDay(survey.end_date)}\n\n`

    const notificationMessage = message || defaultMessage
    const notificationTitle = "ソシキサーベイの回答をお願いします"

    // Insert notifications into database
    const insertedNotifications = []
    for (const u of usersResult.rows) {
      const insertResult = await query<{ id: number }>(
        `INSERT INTO notifications (user_id, survey_id, title, message, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [u.id, surveyId, notificationTitle, notificationMessage, user.userId]
      )

      insertedNotifications.push({
        id: insertResult.rows[0].id,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        message: notificationMessage,
        sentAt: new Date().toISOString(),
      })

      await pruneNotificationsForUser(u.id)
    }

    // TODO: Implement actual email sending here
    // Example: await sendEmail(user.email, notificationTitle, notificationMessage)

    
    return successResponse({
      message: `${insertedNotifications.length}名の従業員に通知を送信しました`,
      notificationsSent: insertedNotifications.length,
      notifications: insertedNotifications,
    })
  } catch (error) {
    return handleError(error, "通知の送信に失敗しました", "Send notifications")
  }
}

export const POST = withAdmin(handlePost)

