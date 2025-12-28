import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/growth-survey-results/free-text - Get growth survey free text responses
 * Query params: 
 *   - userId (optional) - User ID (admin only, if not provided returns current user's responses)
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") // For admin to get specific user's responses

    // Get free text responses
    // Admin can see all or specific user's, regular users only their own
    let queryText = `
      SELECT 
        gsftr.uid,
        gsftr.gsid,
        gsftr.gqid as question_id,
        gsftr.answer_text,
        s.name as survey_name,
        gsq.question_text
      FROM growth_survey_free_text_responses gsftr
      LEFT JOIN surveys s ON gsftr.gsid = s.id
      LEFT JOIN growth_survey_questions gsq ON gsftr.gqid = gsq.id
      WHERE 1=1
    `

    const params: any[] = []
    let paramIndex = 1

    if (user.role === "admin" && userId) {
      // Admin requesting specific user's responses
      const userIdNum = parseInt(userId, 10)
      if (isNaN(userIdNum)) {
        return badRequestResponse("無効なuserIdです")
      }
      queryText += ` AND gsftr.uid = $${paramIndex++}`
      params.push(userIdNum)
    } else if (user.role !== "admin") {
      // Regular user can only see their own
      queryText += ` AND gsftr.uid = $${paramIndex++}`
      params.push(user.userId)
    }

    queryText += ` ORDER BY gsftr.gsid, gsftr.gqid`

    const result = await query<{
      uid: number
      gsid: number
      question_id: number
      answer_text: string
      survey_name: string
      question_text: string
    }>(queryText, params)

    const responses = result.rows.map((row) => ({
      userId: row.uid,
      surveyId: row.gsid,
      surveyName: row.survey_name || "",
      questionId: row.question_id,
      questionText: row.question_text || "",
      answerText: row.answer_text,
    }))

    return successResponse({ responses })
  } catch (error) {
    return handleError(error, "グロースサーベイ自由入力回答の取得に失敗しました", "Get growth survey free text responses")
  }
}

export const GET = withAuth(handleGet)

