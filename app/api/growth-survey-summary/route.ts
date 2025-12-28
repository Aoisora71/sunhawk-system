import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/growth-survey-summary - Get growth survey summaries
 * Query params: surveyId (optional) - Filter by survey ID
 *               forOrganization (optional) - If true, return all summaries for organization-wide analysis
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")
    const forOrganization = searchParams.get("forOrganization") === "true"

    let queryText = `
      SELECT 
        gss.id,
        gss.uid,
        gss.gsid,
        gss.cat1_score,
        gss.cat2_score,
        gss.cat3_score,
        gss.cat4_score,
        gss.cat5_score,
        gss.total_score,
        gss.created_at,
        gss.updated_at,
        s.start_date,
        s.end_date,
        s.name as survey_name
      FROM growth_survey_summary gss
      LEFT JOIN surveys s ON gss.gsid = s.id
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
      queryText += ` AND gsid = $${paramIndex++}`
      params.push(surveyId)
    }

    queryText += ` ORDER BY created_at DESC`

    const result = await query<{
      id: number
      uid: number
      gsid: number
      cat1_score: number
      cat2_score: number
      cat3_score: number
      cat4_score: number
      cat5_score: number
      total_score: number
      created_at: string
      updated_at: string
      start_date: string | null
      end_date: string | null
      survey_name: string | null
    }>(queryText, params)

    const summaries = result.rows.map((row) => ({
      id: row.id,
      userId: row.uid,
      surveyId: row.gsid,
      cat1Score: parseFloat(row.cat1_score.toString()),
      cat2Score: parseFloat(row.cat2_score.toString()),
      cat3Score: parseFloat(row.cat3_score.toString()),
      cat4Score: parseFloat(row.cat4_score.toString()),
      cat5Score: parseFloat(row.cat5_score.toString()),
      totalScore: parseFloat(row.total_score.toString()),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startDate: row.start_date,
      endDate: row.end_date,
      surveyName: row.survey_name,
    }))

    return successResponse({ summaries })
  } catch (error) {
    return handleError(error, "グロースサーベイ結果サマリーの取得に失敗しました", "Get growth survey summaries")
  }
}

export const GET = withAuth(handleGet)




