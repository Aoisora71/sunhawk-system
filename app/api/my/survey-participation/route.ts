import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { handleError, successResponse } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

async function handleGet(_request: NextRequest, user: AuthenticatedUser) {
  try {
    const userId = user.userId

    // ソシキサーベイ参加状況
    // 1) 参加済みサーベイ数（サマリーテーブルベース）
    const orgRes = await query<{
      completed_count: string
    }>(
      `
      SELECT 
        COUNT(DISTINCT oss.osid) AS completed_count
      FROM organizational_survey_summary oss
      WHERE oss.uid = $1
    `,
      [userId],
    )

    // 2) 最終参加日（問題の指示通り organizational_survey_results.updated_at から取得）
    const orgLastRes = await query<{
      last_completed_at: string | null
    }>(
      `
      SELECT 
        MAX(updated_at) AS last_completed_at
      FROM organizational_survey_results
      WHERE uid = $1
    `,
      [userId],
    )

    const orgTotalRes = await query<{ total_count: string }>(
      `SELECT COUNT(*) AS total_count FROM surveys WHERE survey_type = 'organizational'`,
    )

    const orgRow = orgRes.rows[0]
    const orgLastRow = orgLastRes.rows[0]
    const orgTotalRow = orgTotalRes.rows[0]

    const orgCompleted = orgRow ? Number(orgRow.completed_count || "0") : 0
    const orgTotal = orgTotalRow ? Number(orgTotalRow.total_count || "0") : 0
    const orgLastCompletedAt = orgLastRow?.last_completed_at || null

    //グロースサーベイ参加状況
    const growthRes = await query<{
      completed_count: string
      last_completed_at: string | null
    }>(
      `
      SELECT 
        COUNT(DISTINCT gss.gsid) AS completed_count,
        MAX(
          COALESCE(s.end_date, gss.updated_at, gss.created_at)
        ) AS last_completed_at
      FROM growth_survey_summary gss
      LEFT JOIN surveys s ON gss.gsid = s.id
      WHERE gss.uid = $1
    `,
      [userId],
    )

    const growthTotalRes = await query<{ total_count: string }>(
      `SELECT COUNT(*) AS total_count FROM surveys WHERE survey_type = 'growth'`,
    )

    const growthRow = growthRes.rows[0]
    const growthTotalRow = growthTotalRes.rows[0]

    const growthCompleted = growthRow ? Number(growthRow.completed_count || "0") : 0
    const growthTotal = growthTotalRow ? Number(growthTotalRow.total_count || "0") : 0
    const growthLastCompletedAt = growthRow?.last_completed_at || null

    return successResponse({
      organizational: {
        completed: orgCompleted,
        total: orgTotal,
        lastCompletedAt: orgLastCompletedAt,
      },
      growth: {
        completed: growthCompleted,
        total: growthTotal,
        lastCompletedAt: growthLastCompletedAt,
      },
    })
  } catch (error) {
    return handleError(error, "サーベイ参加状況の取得に失敗しました", "Get survey participation")
  }
}

export const GET = withAuth(handleGet)


