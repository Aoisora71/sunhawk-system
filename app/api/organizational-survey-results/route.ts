import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse, conflictResponse } from "@/lib/api-errors"
import { calculateCategoryScores } from "@/lib/survey-helpers"
import type { AuthenticatedUser } from "@/lib/middleware"
import type { SurveyResultItem, OrganizationalSurveyResult } from "@/lib/types"

/**
 * GET /api/organizational-survey-results - Get survey results
 * Query params: surveyId (optional) - Filter by survey ID
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")

    let queryText = `
      SELECT 
        id,
        uid,
        osid,
        response,
        response_rate,
        created_at,
        updated_at
      FROM organizational_survey_results
      WHERE 1=1
    `

    const params: any[] = []
    let paramIndex = 1

    // Admin can see all, regular users only their own
    if (user.role !== "admin") {
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
      response: SurveyResultItem[]
      response_rate: number | null
      created_at: string
      updated_at: string
    }>(queryText, params)

    // Convert response from shortened format (qid, cid, s) to SurveyResultItem format (questionId, categoryId, score)
    const results: OrganizationalSurveyResult[] = result.rows.map((row) => {
      const responseArray = Array.isArray(row.response) ? row.response : []
      const normalizedResponse = responseArray.map((item: any) => ({
        questionId: item.qid ?? item.questionId,
        categoryId: item.cid ?? item.categoryId,
        score: item.s ?? item.score,
      }))
      return {
        id: row.id,
        userId: row.uid,
        surveyId: row.osid,
        response: normalizedResponse as SurveyResultItem[],
        responseRate: row.response_rate ?? 0.0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })

    return successResponse({ results })
  } catch (error) {
    return handleError(error, "サーベイ結果の取得に失敗しました", "Get survey results")
  }
}

/**
 * POST /api/organizational-survey-results - Submit survey results
 * Body: { surveyId: string, response: SurveyResultItem[] }
 */
async function handlePost(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { surveyId, response } = await request.json()

    if (!surveyId || !response) {
      return badRequestResponse("surveyIdとresponseは必須です")
    }

    if (!Array.isArray(response)) {
      return badRequestResponse("responseは配列である必要があります")
    }

    // Validate response structure (support both old and new format)
    for (const item of response) {
      const qid = item.qid ?? item.questionId
      const cid = item.cid ?? item.categoryId
      const s = item.s ?? item.score
      if (
        typeof qid !== "number" ||
        typeof cid !== "number" ||
        typeof s !== "number"
      ) {
        return badRequestResponse(
          "responseの各項目はqid（またはquestionId）、cid（またはcategoryId）、s（またはscore）（すべて数値）を含む必要があります"
        )
      }
    }

    // Convert to shortened format for storage
    const normalizedResponse = response.map((item) => ({
      qid: item.qid ?? item.questionId,
      cid: item.cid ?? item.categoryId,
      s: item.s ?? item.score,
    }))

    // Check if result already exists for this user and survey
    const existing = await query(
      "SELECT id FROM organizational_survey_results WHERE uid = $1 AND osid = $2",
      [user.userId, surveyId]
    )

    let resultId: number

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
    const singleChoiceCount = response.length
    const totalAnsweredCount = singleChoiceCount + freeTextCount
    const responseRate =
      totalProblems > 0
        ? Math.round((totalAnsweredCount / totalProblems) * 100 * 100) / 100 // Round to 2 decimal places
        : 0.0
    // Cap at 100%
    const finalResponseRate = responseRate > 100 ? 100.0 : responseRate

    if (existing.rows.length > 0) {
      // Update existing result
      const result = await query<{
        id: number
        user_id: number
        survey_id: number
        response: SurveyResultItem[]
        created_at: string
        updated_at: string
      }>(
        `UPDATE organizational_survey_results 
         SET response = $1, response_rate = $2, updated_at = CURRENT_TIMESTAMP
         WHERE uid = $3 AND osid = $4
         RETURNING id, uid, osid, response, created_at, updated_at`,
        [JSON.stringify(normalizedResponse), finalResponseRate, user.userId, surveyId]
      )

      if (result.rows.length === 0) {
        return handleError(new Error("Failed to update survey result"), "サーベイ結果の更新に失敗しました")
      }

      resultId = result.rows[0].id
    } else {
      // Create new result
      const result = await query<{
        id: number
        user_id: number
        survey_id: number
        response: SurveyResultItem[]
        created_at: string
        updated_at: string
      }>(
        `INSERT INTO organizational_survey_results (uid, osid, response, response_rate)
         VALUES ($1, $2, $3, $4)
         RETURNING id, uid, osid, response, created_at, updated_at`,
        [user.userId, surveyId, JSON.stringify(normalizedResponse), finalResponseRate]
      )

      if (result.rows.length === 0) {
        return handleError(new Error("Failed to create survey result"), "サーベイ結果の作成に失敗しました")
      }

      resultId = result.rows[0].id
    }

    // Calculate category scores from response data (use normalized format)
    const categoryScores = calculateCategoryScores(normalizedResponse.map((item: any) => ({
      questionId: item.qid,
      categoryId: item.cid,
      score: item.s,
    })))

    // Insert or update summary in organizational_survey_summary table
    const summaryExisting = await query(
      "SELECT id FROM organizational_survey_summary WHERE uid = $1 AND osid = $2",
      [user.userId, surveyId]
    )

    if (summaryExisting.rows.length > 0) {
      // Update existing summary
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
      // Create new summary
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
      message: "サーベイ結果を保存しました",
      resultId: resultId.toString(),
    })
  } catch (error: any) {
    if (error?.code === "23505") {
      return conflictResponse("このサーベイ結果は既に登録されています")
    }
    return handleError(error, "サーベイ結果の送信に失敗しました", "Submit survey results")
  }
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

