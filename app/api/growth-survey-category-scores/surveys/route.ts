import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/growth-survey-category-scores/surveys - Get list of survey IDs that have response data
 * Returns survey IDs from growth_survey_responses table, sorted by most recent
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    // Check which columns exist to support both old and new column names
    const columnCheck = await query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'growth_survey_responses' 
         AND column_name IN ('gsid', 'survey_id')`
    )
    const hasNewColumns = columnCheck.rows.some(r => r.column_name === 'gsid')
    const surveyColumn = hasNewColumns ? 'gsid' : 'survey_id'

    // Get distinct survey IDs that have response data, ordered by most recent
    const result = await query<{
      survey_id: number
      max_created_at: string
    }>(
      `SELECT 
         ${surveyColumn} as survey_id,
         MAX(created_at) as max_created_at
       FROM growth_survey_responses
       WHERE ${surveyColumn} IS NOT NULL
       GROUP BY ${surveyColumn}
       ORDER BY max_created_at DESC, ${surveyColumn} DESC`,
    )

    const surveyIds = result.rows.map(row => Number(row.survey_id))

    

    return successResponse({ surveyIds })
  } catch (error) {
    return handleError(error, "グロースサーベイID一覧の取得に失敗しました", "Get growth survey IDs")
  }
}

export const GET = withAuth(handleGet)




