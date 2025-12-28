import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/organizational-survey-summary/detailed - Get detailed survey summary with user info
 * Query params: surveyId (required) - Filter by survey ID
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")

    if (!surveyId) {
      return successResponse({ details: [] })
    }

    // Admin only
    if (user.role !== "admin") {
      return successResponse({ details: [] })
    }

    const queryText = `
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
        u.name as user_name,
        u.email,
        d.name as department_name,
        d.code as department_code,
        j.name as job_name,
        j.code as job_code,
        osr.response_rate,
        os.name as survey_name
      FROM organizational_survey_summary oss
      LEFT JOIN users u ON oss.uid = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN jobs j ON u.job_id = j.id
      LEFT JOIN organizational_survey_results osr ON oss.uid = osr.uid AND oss.osid = osr.osid
      LEFT JOIN surveys os ON oss.osid = os.id
      WHERE oss.osid = $1
      ORDER BY oss.updated_at DESC
    `

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
      user_name: string | null
      email: string | null
      department_name: string | null
      department_code: string | null
      job_name: string | null
      job_code: string | null
      response_rate: number | null
      survey_name: string | null
    }>(queryText, [surveyId])

    const details = result.rows.map((row) => ({
      id: row.id,
      userId: row.uid,
      surveyId: row.osid,
      userName: row.user_name || "",
      email: row.email || "",
      departmentName: row.department_name || "",
      departmentCode: row.department_code || null,
      jobName: row.job_name || "",
      jobCode: row.job_code || null,
      category1Score: parseFloat(row.category1_score.toString()),
      category2Score: parseFloat(row.category2_score.toString()),
      category3Score: parseFloat(row.category3_score.toString()),
      category4Score: parseFloat(row.category4_score.toString()),
      category5Score: parseFloat(row.category5_score.toString()),
      category6Score: parseFloat(row.category6_score.toString()),
      category7Score: parseFloat(row.category7_score.toString()),
      category8Score: parseFloat(row.category8_score.toString()),
      totalScore: parseFloat(row.total_score.toString()),
      responseRate: row.response_rate ? parseFloat(row.response_rate.toString()) : null,
      updatedAt: row.updated_at,
    }))

    const surveyName = result.rows.length > 0 ? result.rows[0].survey_name : null

    return successResponse({ details, surveyName })
  } catch (error) {
    return handleError(error, "詳細なサーベイ結果の取得に失敗しました", "Get detailed survey summary")
  }
}

export const GET = withAuth(handleGet)

