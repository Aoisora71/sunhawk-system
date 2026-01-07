import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/organizational-survey-results/free-text - Get free text responses for a survey
 * Query params: surveyId (required) - Survey ID
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")
    const userId = searchParams.get("userId") // For admin to get specific user's responses

    if (!surveyId) {
      return badRequestResponse("surveyIdは必須です")
    }

    const surveyIdNum = parseInt(surveyId, 10)
    if (isNaN(surveyIdNum)) {
      return badRequestResponse("無効なsurveyIdです")
    }

    // Get free text responses for this user and survey
    // Admin can see all or specific user's, regular users only their own
    let queryText = `
      SELECT 
        osftr.uid,
        osftr.osid,
        osftr.qid as question_id,
        osftr.answer_text,
        s.name as survey_name,
        p.question_text
      FROM organizational_survey_free_text_responses osftr
      LEFT JOIN surveys s ON osftr.osid = s.id
      LEFT JOIN problems p ON osftr.qid = p.id
      WHERE osftr.osid = $1
    `

    const params: any[] = [surveyIdNum]
    let paramIndex = 2

    if (user.role === "admin" && userId) {
      // Admin requesting specific user's responses
      const userIdNum = parseInt(userId, 10)
      if (isNaN(userIdNum)) {
        return badRequestResponse("無効なuserIdです")
      }
      queryText += ` AND osftr.uid = $${paramIndex++}`
      params.push(userIdNum)
    } else if (user.role !== "admin") {
      // Regular user can only see their own
      queryText += ` AND osftr.uid = $${paramIndex++}`
      params.push(user.userId)
    }

    queryText += ` ORDER BY osftr.qid`

    const result = await query<{
      uid: number
      osid: number
      question_id: number
      answer_text: string
      survey_name: string
      question_text: string
    }>(queryText, params)

    const responses = result.rows.map((row) => ({
      userId: row.uid,
      surveyId: row.osid,
      surveyName: row.survey_name || "",
      questionId: row.question_id,
      questionText: row.question_text || "",
      answerText: row.answer_text,
    }))

    return successResponse({ responses })
  } catch (error) {
    return handleError(error, "自由入力回答の取得に失敗しました", "Get free text responses")
  }
}

export const GET = withAuth(handleGet)





