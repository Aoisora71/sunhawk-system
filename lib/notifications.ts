import { query } from "@/lib/db"

export const MAX_NOTIFICATIONS_PER_USER = 5

export async function pruneNotificationsForUser(
  userId: number,
  maxNotifications = MAX_NOTIFICATIONS_PER_USER
) {
  if (!userId || maxNotifications < 0) {
    return
  }

  await query(
    `
      WITH ordered_notifications AS (
        SELECT id
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        OFFSET $2
      )
      DELETE FROM notifications
      WHERE id IN (SELECT id FROM ordered_notifications)
    `,
    [userId, maxNotifications]
  )
}

