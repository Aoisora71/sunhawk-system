import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import { cache, cacheKeys } from "@/lib/cache"
import type { AuthenticatedUser } from "@/lib/middleware"
import type { OrganizationalSurveySummary } from "@/lib/types"

/**
 * GET /api/organizational-survey-summary - Get survey summaries
 * Query params: surveyId (optional) - Filter by survey ID
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")
    const forOrganization = searchParams.get("forOrganization") === "true"

    // Check cache first (aggressive caching for 70 users)
    const cacheKey = `org_survey_summary:${user.userId}:${surveyId || 'all'}:${forOrganization}`
    const cached = cache.get<any>(cacheKey)
    if (cached !== null) {
      return successResponse({ summaries: cached })
    }

    let queryText = `
      SELECT 
        oss.id,
        oss.uid,
        oss.osid,
        oss.category1_score,
        oss.category2_score,
        oss.category3_score,
        oss.category4_score,
        oss.category5_score,
        oss.category6_score,
        oss.category7_score,
        oss.category8_score,
        oss.total_score,
        oss.created_at,
        oss.updated_at,
        s.start_date,
        s.end_date,
        s.name as survey_name
      FROM organizational_survey_summary oss
      LEFT JOIN surveys s ON oss.osid = s.id
      WHERE 1=1
    `

    const params: any[] = []
    let paramIndex = 1

    // Admin can see all, regular users only their own
    // Exception: forOrganization=true allows all users to see all scores (for organization chart display)
    if (user.role !== "admin" && !forOrganization) {
      queryText += ` AND uid = $${paramIndex++}`
      params.push(user.userId)
    }

    if (surveyId) {
      queryText += ` AND osid = $${paramIndex++}`
      params.push(surveyId)
    }

    queryText += ` ORDER BY created_at DESC`

    const result = await query<{
      id: number
      uid: number
      osid: number
      category1_score: number
      category2_score: number
      category3_score: number
      category4_score: number
      category5_score: number
      category6_score: number
      category7_score: number
      category8_score: number
      total_score: number
      created_at: string
      updated_at: string
      start_date: string | null
      end_date: string | null
      survey_name: string | null
    }>(queryText, params)

    const summaries: (OrganizationalSurveySummary & { startDate?: string | null; endDate?: string | null; surveyName?: string | null })[] = result.rows.map((row) => ({
      id: row.id,
      userId: row.uid,
      surveyId: row.osid,
      category1Score: parseFloat(row.category1_score.toString()),
      category2Score: parseFloat(row.category2_score.toString()),
      category3Score: parseFloat(row.category3_score.toString()),
      category4Score: parseFloat(row.category4_score.toString()),
      category5Score: parseFloat(row.category5_score.toString()),
      category6Score: parseFloat(row.category6_score.toString()),
      category7Score: parseFloat(row.category7_score.toString()),
      category8Score: parseFloat(row.category8_score.toString()),
      totalScore: parseFloat(row.total_score.toString()),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startDate: row.start_date,
      endDate: row.end_date,
      surveyName: row.survey_name,
    }))

    // Cache results - longer TTL for organization view (less frequently updated)
    const cacheTTL = forOrganization ? 5 * 60 * 1000 : 2 * 60 * 1000 // 5 min for org, 2 min for user
    cache.set(cacheKey, summaries, cacheTTL)

    return successResponse({ summaries })
  } catch (error) {
    return handleError(error, "サーベイ結果サマリーの取得に失敗しました", "Get survey summaries")
  }
}

export const GET = withAuth(handleGet)

