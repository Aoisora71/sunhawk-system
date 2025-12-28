import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/organizational-survey-summary/department-category - Get department and category scores for organizational surveys
 * Query params: surveyId (required) - Filter by survey ID
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")

    if (!surveyId) {
      return successResponse({ departmentCategoryScores: [] })
    }

    // Admin only
    if (user.role !== "admin") {
      return successResponse({ departmentCategoryScores: [] })
    }

    const queryText = `
      SELECT 
        d.id as department_id,
        d.name as department_name,
        d.code as department_code,
        COALESCE(AVG(oss.category1_score), 0) as category1_avg,
        COALESCE(AVG(oss.category2_score), 0) as category2_avg,
        COALESCE(AVG(oss.category3_score), 0) as category3_avg,
        COALESCE(AVG(oss.category4_score), 0) as category4_avg,
        COALESCE(AVG(oss.category5_score), 0) as category5_avg,
        COALESCE(AVG(oss.category6_score), 0) as category6_avg,
        COALESCE(AVG(oss.category7_score), 0) as category7_avg,
        COALESCE(AVG(oss.category8_score), 0) as category8_avg,
        COALESCE(AVG(oss.total_score), 0) as total_avg,
        COUNT(DISTINCT oss.uid) as participant_count,
        s.name as survey_name
      FROM organizational_survey_summary oss
      LEFT JOIN users u ON oss.uid = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN surveys s ON oss.osid = s.id
      WHERE oss.osid = $1
        AND d.id IS NOT NULL
      GROUP BY d.id, d.name, d.code, s.name
      ORDER BY COALESCE(d.code, d.name) ASC
    `

    const result = await query<{
      department_id: number
      department_name: string
      department_code: string | null
      category1_avg: number
      category2_avg: number
      category3_avg: number
      category4_avg: number
      category5_avg: number
      category6_avg: number
      category7_avg: number
      category8_avg: number
      total_avg: number
      participant_count: number
      survey_name: string | null
    }>(queryText, [surveyId])

    const departmentCategoryScores = result.rows.map((row) => ({
      departmentId: row.department_id,
      departmentName: row.department_name,
      departmentCode: row.department_code || null,
      category1Avg: parseFloat(row.category1_avg.toString()),
      category2Avg: parseFloat(row.category2_avg.toString()),
      category3Avg: parseFloat(row.category3_avg.toString()),
      category4Avg: parseFloat(row.category4_avg.toString()),
      category5Avg: parseFloat(row.category5_avg.toString()),
      category6Avg: parseFloat(row.category6_avg.toString()),
      category7Avg: parseFloat(row.category7_avg.toString()),
      category8Avg: parseFloat(row.category8_avg.toString()),
      totalAvg: parseFloat(row.total_avg.toString()),
      participantCount: Number(row.participant_count),
    }))

    const surveyName = result.rows.length > 0 ? result.rows[0].survey_name : null

    return successResponse({ departmentCategoryScores, surveyName })
  } catch (error) {
    return handleError(error, "部署別・カテゴリ別スコアの取得に失敗しました", "Get department category scores")
  }
}

export const GET = withAuth(handleGet)

