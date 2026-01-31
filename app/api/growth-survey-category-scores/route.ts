import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"
import { getActiveGrowthSurvey } from "@/lib/growth-survey"

/**
 * GET /api/growth-survey-category-scores - Get category scores for growth survey
 * Query params: surveyId (optional) - If provided, get scores for that survey. Otherwise, get active survey.
 * Returns the sum of total_score for each category based on survey results only
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyIdParam = searchParams.get("surveyId")
    
    let targetSurveyId: number | null = null
    
    // Initialize category scores: growth categories 0; ソシキサーベイ null until we find matching org survey
    const categoryScores: Record<string, number | null> = {
      "ルール": 0,
      "組織体制": 0,
      "評価制度": 0,
      "週報・会議": 0,
      "ソシキサーベイ": null,
    }

    if (surveyIdParam) {
      targetSurveyId = parseInt(surveyIdParam, 10)
      if (Number.isNaN(targetSurveyId)) {
        return successResponse({ categories: categoryScores })
      }
    } else {
      const activeSurvey = await getActiveGrowthSurvey()
      if (!activeSurvey) {
        return successResponse({ categories: categoryScores })
      }
      targetSurveyId = activeSurvey.id
    }

    // Check which columns exist to support both old and new column names
    const columnCheck = await query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'growth_survey_responses' 
         AND column_name IN ('gqid', 'question_id', 'gsid', 'survey_id', 'cid', 'category')`
    )
    const hasNewColumns = columnCheck.rows.some(r => r.column_name === 'gqid')
    const surveyColumn = hasNewColumns ? 'gsid' : 'survey_id'
    const categoryColumn = columnCheck.rows.some(r => r.column_name === 'cid') ? 'cid' : 'category'

    // Get total_score sum grouped by category
        const result = await query<{
      category: string
      total_sum: number
    }>(
      `SELECT 
         ${categoryColumn} as category,
         COALESCE(SUM(total_score), 0) as total_sum
       FROM growth_survey_responses
       WHERE ${surveyColumn} = $1
         AND ${categoryColumn} IS NOT NULL
       GROUP BY ${categoryColumn}`,
      [targetSurveyId],
    )

    // Set category scores based on survey results only (growth categories only; ソシキ is set below)
    result.rows.forEach((row) => {
      const category = row.category
      if (category) {
        const normalizedCategory = category === "主保・会議" ? "週報・会議" : category
        if (categoryScores.hasOwnProperty(normalizedCategory) && normalizedCategory !== "ソシキサーベイ") {
          categoryScores[normalizedCategory] = Number(row.total_sum) || 0
        }
      }
    })

    // ソシキサーベイ: organizational survey in the same period as this growth survey (exact start/end match)
    // Score mapping: 0-45 → 2, 46-54 → 3, 55-69 → 4, 70-84 → 5, 85-100 → 6
    try {
      const growthSurveyRow = await query<{ start_date: string | null; end_date: string | null }>(
        `SELECT start_date, end_date FROM surveys WHERE id = $1`,
        [targetSurveyId],
      )
      if (growthSurveyRow.rows.length > 0) {
        const startDate = growthSurveyRow.rows[0].start_date
        const endDate = growthSurveyRow.rows[0].end_date
        if (startDate != null && endDate != null) {
          const orgSurveyRow = await query<{ id: number }>(
            `SELECT id FROM surveys
             WHERE survey_type = 'organizational'
               AND (start_date::date) = ($1::date)
               AND (end_date::date) = ($2::date)
             LIMIT 1`,
            [startDate, endDate],
          )
          if (orgSurveyRow.rows.length > 0) {
            const orgSurveyId = orgSurveyRow.rows[0].id
            const avgRow = await query<{ avg_total: number }>(
              `SELECT COALESCE(AVG(total_score), 0) as avg_total
               FROM organizational_survey_summary WHERE osid = $1`,
              [orgSurveyId],
            )
            const avg = avgRow.rows[0] ? parseFloat(avgRow.rows[0].avg_total.toString()) : 0
            let points: number
            if (avg <= 45) points = 2
            else if (avg <= 54) points = 3
            else if (avg < 70) points = 4
            else if (avg <= 84) points = 5
            else points = 6
            categoryScores["ソシキサーベイ"] = points
          }
        }
      }
    } catch {
      // Leave ソシキサーベイ as null on error
    }

    return successResponse({ categories: categoryScores })
  } catch (error) {
    return handleError(error, "グロースサーベイカテゴリスコアの取得に失敗しました", "Get growth survey category scores")
  }
}

export const GET = withAuth(handleGet)

