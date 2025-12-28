import { type NextRequest } from "next/server"
import { withAuthParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import { getActiveOrganizationalSurvey } from "@/lib/growth-survey"

/**
 * PUT /api/organizational-survey-results/[questionId]/free-text - Save free text answer
 * Body: { surveyId: string, answerText: string }
 */
async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> },
  user: { userId: number; email: string }
) {
  try {
    const { questionId } = await context.params
    const { surveyId, answerText } = await request.json()

    if (!surveyId || !answerText || typeof answerText !== 'string' || answerText.trim() === '') {
      return badRequestResponse("surveyIdとanswerTextは必須です")
    }

    // Check if survey is active and within period
    const activeSurvey = await getActiveOrganizationalSurvey()
    if (!activeSurvey || Number(activeSurvey.id) !== Number(surveyId)) {
      return badRequestResponse("現在、ソシキサーベイのサーベイ期間ではありません")
    }

    const questionIdNum = parseInt(questionId, 10)
    if (isNaN(questionIdNum)) {
      return badRequestResponse("無効なquestionIdです")
    }

    // Check if question exists and is a free text question
    const questionCheck = await query<{ question_type: string }>(
      "SELECT COALESCE(question_type, 'single_choice') as question_type FROM problems WHERE id = $1",
      [questionIdNum]
    )

    if (questionCheck.rows.length === 0) {
      return badRequestResponse("問題が見つかりません")
    }

    if (questionCheck.rows[0].question_type !== 'free_text') {
      return badRequestResponse("この問題は自由入力問題ではありません")
    }

    // Check if response already exists
    const existing = await query<{ id: number }>(
      "SELECT id FROM organizational_survey_free_text_responses WHERE uid = $1 AND osid = $2 AND qid = $3",
      [user.userId, surveyId, questionIdNum]
    )

    if (existing.rows.length > 0) {
      // Update existing response
      await query(
        `UPDATE organizational_survey_free_text_responses 
         SET answer_text = $1, updated_at = CURRENT_TIMESTAMP
         WHERE uid = $2 AND osid = $3 AND qid = $4`,
        [answerText.trim(), user.userId, surveyId, questionIdNum]
      )
    } else {
      // Insert new response
      await query(
        `INSERT INTO organizational_survey_free_text_responses (uid, osid, qid, answer_text)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, surveyId, questionIdNum, answerText.trim()]
      )
    }

    // Update response_rate in organizational_survey_results table
    // Get or create organizational_survey_results entry
    const existingResult = await query<{
      id: number
      response: any[]
    }>(
      "SELECT id, response FROM organizational_survey_results WHERE uid = $1 AND osid = $2",
      [user.userId, surveyId]
    )

    let resultId: number
    if (existingResult.rows.length > 0) {
      resultId = existingResult.rows[0].id
    } else {
      // Create new result entry if it doesn't exist
      const newResult = await query<{ id: number }>(
        `INSERT INTO organizational_survey_results (uid, osid, response)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [user.userId, surveyId, JSON.stringify([])]
      )
      resultId = newResult.rows[0].id
    }

    // Get total number of problems/questions
    const totalProblemsResult = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM problems"
    )
    const totalProblems = totalProblemsResult.rows[0]?.count || 0

    // Get count of single choice responses
    const singleChoiceResponse = existingResult.rows[0]?.response || []
    const singleChoiceCount = Array.isArray(singleChoiceResponse) ? singleChoiceResponse.length : 0

    // Get count of free text responses for this user and survey
    const freeTextCountResult = await query<{ count: number }>(
      `SELECT COUNT(DISTINCT qid) as count 
       FROM organizational_survey_free_text_responses 
       WHERE uid = $1 AND osid = $2`,
      [user.userId, surveyId]
    )
    const freeTextCount = freeTextCountResult.rows[0]?.count || 0

    // Calculate response rate: (answered questions including free text / total questions) * 100
    const totalAnsweredCount = singleChoiceCount + freeTextCount
    const responseRate =
      totalProblems > 0
        ? Math.round((totalAnsweredCount / totalProblems) * 100 * 100) / 100 // Round to 2 decimal places
        : 0.0
    // Cap at 100%
    const finalResponseRate = responseRate > 100 ? 100.0 : responseRate

    // Update response_rate
    await query(
      `UPDATE organizational_survey_results 
       SET response_rate = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [finalResponseRate, resultId]
    )

    return successResponse({
      message: "回答を保存しました",
      questionId: questionIdNum,
    })
  } catch (error) {
    return handleError(error, "回答の保存に失敗しました", "Save free text answer")
  }
}

export const PUT = withAuthParams(handlePut)


