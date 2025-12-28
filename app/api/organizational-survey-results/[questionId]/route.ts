import { type NextRequest } from "next/server"
import { withAuthParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { SurveyResultItem } from "@/lib/types"
import { getActiveOrganizationalSurvey } from "@/lib/growth-survey"

/**
 * PUT /api/organizational-survey-results/[questionId] - Save individual question response
 * Body: { surveyId: string, categoryId: number, score: number }
 */
async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> },
  user: { userId: number; email: string }
) {
  try {
    const { questionId } = await context.params
    const { surveyId, categoryId, score } = await request.json()

    if (!surveyId || !categoryId || score === undefined) {
      return badRequestResponse("surveyId、categoryId、scoreは必須です")
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

    // Get existing result or create empty one
    const existingResult = await query<{
      id: number
      response: SurveyResultItem[]
    }>(
      "SELECT id, response FROM organizational_survey_results WHERE uid = $1 AND osid = $2",
      [user.userId, surveyId]
    )

    let responseArray: SurveyResultItem[] = []
    let resultId: number

    if (existingResult.rows.length > 0) {
      // Update existing result
      resultId = existingResult.rows[0].id
      responseArray = existingResult.rows[0].response || []
      
      // Remove existing entry for this question if it exists (support both formats)
      responseArray = responseArray.filter((item: any) => (item.qid ?? item.questionId) !== questionIdNum)
    } else {
      // Create new result entry
      const newResult = await query<{ id: number }>(
        `INSERT INTO organizational_survey_results (uid, osid, response)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [user.userId, surveyId, JSON.stringify([])]
      )
      resultId = newResult.rows[0].id
    }

    // Add/update the question response (use shortened format)
    const newItem: SurveyResultItem = {
      qid: questionIdNum,
      cid: categoryId,
      s: score,
    }
    responseArray.push(newItem)

    // Get total number of problems/questions
    const totalProblemsResult = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM problems"
    )
    const totalProblems = totalProblemsResult.rows[0]?.count || 0

    // Get count of free text responses for this user and survey
    const freeTextCountResult = await query<{ count: number }>(
      `SELECT COUNT(DISTINCT qid) as count 
       FROM organizational_survey_free_text_responses 
       WHERE uid = $1 AND osid = $2`,
      [user.userId, surveyId]
    )
    const freeTextCount = freeTextCountResult.rows[0]?.count || 0

    // Calculate response rate: (answered questions including free text / total questions) * 100
    const singleChoiceCount = responseArray.length
    const totalAnsweredCount = singleChoiceCount + freeTextCount
    const responseRate =
      totalProblems > 0
        ? Math.round((totalAnsweredCount / totalProblems) * 100 * 100) / 100 // Round to 2 decimal places
        : 0.0
    // Cap at 100%
    const finalResponseRate = responseRate > 100 ? 100.0 : responseRate

    // Update the response array and response rate
    await query(
      `UPDATE organizational_survey_results 
       SET response = $1, response_rate = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(responseArray), finalResponseRate, resultId]
    )

    // Recalculate and update summary (convert to format expected by calculateCategoryScores)
    const { calculateCategoryScores } = await import("@/lib/survey-helpers")
    const normalizedArray = responseArray.map((item: any) => ({
      questionId: item.qid ?? item.questionId,
      categoryId: item.cid ?? item.categoryId,
      score: item.s ?? item.score,
    }))
    const categoryScores = calculateCategoryScores(normalizedArray)

    const summaryExisting = await query(
      "SELECT id FROM organizational_survey_summary WHERE uid = $1 AND osid = $2",
      [user.userId, surveyId]
    )

    if (summaryExisting.rows.length > 0) {
      await query(
        `UPDATE organizational_survey_summary 
         SET category1_score = $1,
             category2_score = $2,
             category3_score = $3,
             category4_score = $4,
             category5_score = $5,
             category6_score = $6,
             category7_score = $7,
             category8_score = $8,
             total_score = $9,
             updated_at = CURRENT_TIMESTAMP
         WHERE uid = $10 AND osid = $11`,
        [
          categoryScores.category1Score,
          categoryScores.category2Score,
          categoryScores.category3Score,
          categoryScores.category4Score,
          categoryScores.category5Score,
          categoryScores.category6Score,
          categoryScores.category7Score,
          categoryScores.category8Score,
          categoryScores.totalScore,
          user.userId,
          surveyId,
        ]
      )
    } else {
      await query(
        `INSERT INTO organizational_survey_summary (
          uid, osid,
          category1_score, category2_score, category3_score, category4_score,
          category5_score, category6_score, category7_score, category8_score,
          total_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          user.userId,
          surveyId,
          categoryScores.category1Score,
          categoryScores.category2Score,
          categoryScores.category3Score,
          categoryScores.category4Score,
          categoryScores.category5Score,
          categoryScores.category6Score,
          categoryScores.category7Score,
          categoryScores.category8Score,
          categoryScores.totalScore,
        ]
      )
    }

    return successResponse({
      message: "回答を保存しました",
      questionId: questionIdNum,
    })
  } catch (error) {
    return handleError(error, "回答の保存に失敗しました", "Save question response")
  }
}

/**
 * DELETE /api/organizational-survey-results/[questionId] - Remove question response
 * Query params: surveyId
 */
async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> },
  user: { userId: number; email: string }
) {
  try {
    const { questionId } = await context.params
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")

    if (!surveyId) {
      return badRequestResponse("surveyIdは必須です")
    }

    const questionIdNum = parseInt(questionId, 10)
    if (isNaN(questionIdNum)) {
      return badRequestResponse("無効なquestionIdです")
    }

    // Get existing result
    const existingResult = await query<{
      id: number
      response: SurveyResultItem[]
    }>(
      "SELECT id, response FROM organizational_survey_results WHERE uid = $1 AND osid = $2",
      [user.userId, surveyId]
    )

    if (existingResult.rows.length === 0) {
      return successResponse({ message: "回答が見つかりません" })
    }

    const responseArray = existingResult.rows[0].response || []
    // Remove the question response (support both formats)
    const updatedArray = responseArray.filter((item: any) => (item.qid ?? item.questionId) !== questionIdNum)

    // Get total number of problems/questions
    const totalProblemsResult = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM problems"
    )
    const totalProblems = totalProblemsResult.rows[0]?.count || 0

    // Get count of free text responses for this user and survey
    const freeTextCountResult = await query<{ count: number }>(
      `SELECT COUNT(DISTINCT qid) as count 
       FROM organizational_survey_free_text_responses 
       WHERE uid = $1 AND osid = $2`,
      [user.userId, surveyId]
    )
    const freeTextCount = freeTextCountResult.rows[0]?.count || 0

    // Calculate response rate: (answered questions including free text / total questions) * 100
    const singleChoiceCount = updatedArray.length
    const totalAnsweredCount = singleChoiceCount + freeTextCount
    const responseRate =
      totalProblems > 0
        ? Math.round((totalAnsweredCount / totalProblems) * 100 * 100) / 100 // Round to 2 decimal places
        : 0.0
    // Cap at 100%
    const finalResponseRate = responseRate > 100 ? 100.0 : responseRate

    // Update the response array and response rate
    await query(
      `UPDATE organizational_survey_results 
       SET response = $1, response_rate = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(updatedArray), finalResponseRate, existingResult.rows[0].id]
    )

    // Recalculate summary (convert to format expected by calculateCategoryScores)
    if (updatedArray.length > 0) {
      const { calculateCategoryScores } = await import("@/lib/survey-helpers")
      const normalizedArray = updatedArray.map((item: any) => ({
        questionId: item.qid ?? item.questionId,
        categoryId: item.cid ?? item.categoryId,
        score: item.s ?? item.score,
      }))
      const categoryScores = calculateCategoryScores(normalizedArray)

      await query(
        `UPDATE organizational_survey_summary 
         SET category1_score = $1,
             category2_score = $2,
             category3_score = $3,
             category4_score = $4,
             category5_score = $5,
             category6_score = $6,
             category7_score = $7,
             category8_score = $8,
             total_score = $9,
             updated_at = CURRENT_TIMESTAMP
         WHERE uid = $10 AND osid = $11`,
        [
          categoryScores.category1Score,
          categoryScores.category2Score,
          categoryScores.category3Score,
          categoryScores.category4Score,
          categoryScores.category5Score,
          categoryScores.category6Score,
          categoryScores.category7Score,
          categoryScores.category8Score,
          categoryScores.totalScore,
          user.userId,
          surveyId,
        ]
      )
    } else {
      // If no responses left, remove summary
      await query(
        "DELETE FROM organizational_survey_summary WHERE uid = $1 AND osid = $2",
        [user.userId, surveyId]
      )
    }

    return successResponse({ message: "回答を削除しました" })
  } catch (error) {
    return handleError(error, "回答の削除に失敗しました", "Delete question response")
  }
}

export const PUT = withAuthParams(handlePut)
export const DELETE = withAuthParams(handleDelete)

