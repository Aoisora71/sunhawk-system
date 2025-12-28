import { type NextRequest } from "next/server"
import { withAuthParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import {
  badRequestResponse,
  handleError,
  notFoundResponse,
  successResponse,
} from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"
import {
  getGrowthSurveyQuestionForUser,
  getAccessibleGrowthSurveyQuestionCount,
  getActiveGrowthSurvey,
} from "@/lib/growth-survey"
import { getGrowthSurveyOptions } from "@/lib/growth-survey-utils"

async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> },
  user: AuthenticatedUser,
) {
  try {
    const params = await context.params
    const questionIdNum = parseInt(params.questionId, 10)
    if (Number.isNaN(questionIdNum)) {
      return badRequestResponse("無効な質問IDです")
    }

    const { answerValue, answerText } = await request.json()

    const question = await getGrowthSurveyQuestionForUser(user.userId, questionIdNum)
    if (!question) {
      return notFoundResponse("質問")
    }

    let finalScore: number | null = null
    let finalAnswerText = ""

    // Check both questionType (new) and answerType (legacy) for free text questions
    const isFreeTextQuestion = question.questionType === "free_text" || question.answerType === "text"

    if (isFreeTextQuestion) {
      if (typeof answerText !== "string" || answerText.trim().length === 0) {
        return badRequestResponse("回答を入力してください")
      }
      finalAnswerText = answerText.trim()
      // For free text questions, score is 0 and not included in calculations
      finalScore = null
    } else {
      if (typeof answerValue !== "string" || answerValue.length === 0) {
        return badRequestResponse("回答を選択してください")
      }
      const options = getGrowthSurveyOptions(question)
      const matchedOption = options.find((option) => option.value === answerValue)
      if (!matchedOption) {
        return badRequestResponse("無効な選択肢です")
      }
      finalAnswerText = matchedOption.label
      finalScore = matchedOption.score ?? null
    }

    const activeSurvey = await getActiveGrowthSurvey()
    if (!activeSurvey) {
      return badRequestResponse("現在、グロースサーベイのサーベイ期間ではありません")
    }

    // Check which columns exist to support both old and new column names
    const columnCheck = await query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'growth_survey_responses' 
         AND column_name IN ('gqid', 'question_id', 'gsid', 'survey_id', 'cid', 'category')`
    )
    const hasNewColumns = columnCheck.rows.some(r => r.column_name === 'gqid')
    const questionColumn = hasNewColumns ? 'gqid' : 'question_id'
    const surveyColumn = hasNewColumns ? 'gsid' : 'survey_id'
    const categoryColumn = columnCheck.rows.some(r => r.column_name === 'cid') ? 'cid' : 'category'

    // Find or create the question response record
    const existing = await query<{
      id: number
      result: any[]
      total_score: number
    }>(
      `SELECT id, result, total_score
       FROM growth_survey_responses
       WHERE ${questionColumn} = $1 AND ${surveyColumn} = $2`,
      [questionIdNum, activeSurvey.id],
    )

    // Parse existing result array (using shortened field names: uid, s)
    let resultArray: Array<{ uid: number; s: number | null }> = []
    if (existing.rows.length > 0 && existing.rows[0].result) {
      try {
        const parsed = Array.isArray(existing.rows[0].result)
          ? existing.rows[0].result
          : typeof existing.rows[0].result === 'string'
          ? JSON.parse(existing.rows[0].result)
          : []
        // Support both old format (employeeId, score) and new format (uid, s)
        resultArray = parsed.map((entry: any) => ({
          uid: entry.uid ?? entry.employeeId ?? 0,
          s: entry.s ?? entry.score ?? null,
        }))
      } catch {
        resultArray = []
      }
    }

    // For free text questions, save to separate table and skip score calculation
    if (isFreeTextQuestion) {
      // Save free text answer to growth_survey_free_text_responses table
      const existingFreeText = await query<{ id: number }>(
        `SELECT id FROM growth_survey_free_text_responses 
         WHERE uid = $1 AND gsid = $2 AND gqid = $3`,
        [user.userId, activeSurvey.id, questionIdNum]
      )

      if (existingFreeText.rows.length > 0) {
        await query(
          `UPDATE growth_survey_free_text_responses 
           SET answer_text = $1, updated_at = CURRENT_TIMESTAMP
           WHERE uid = $2 AND gsid = $3 AND gqid = $4`,
          [finalAnswerText, user.userId, activeSurvey.id, questionIdNum]
        )
      } else {
        await query(
          `INSERT INTO growth_survey_free_text_responses (uid, gsid, gqid, answer_text)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, activeSurvey.id, questionIdNum, finalAnswerText]
        )
      }

      // For free text questions, total_score is 0 and not included in calculations
      // Still update growth_survey_responses for tracking purposes, but with null score
      // IMPORTANT: Remove existing entry for this user before adding new one to avoid duplicates
      resultArray = resultArray.filter((entry) => entry.uid !== user.userId)
      
      // Add new entry for this user (only store uid and null score for free text)
      resultArray.push({
        uid: user.userId,
        s: null,
      })

      const totalScore = 0

      if (existing.rows.length > 0) {
        await query(
          `UPDATE growth_survey_responses
           SET result = $1::jsonb,
               total_score = $2,
               ${categoryColumn} = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE ${questionColumn} = $4 AND ${surveyColumn} = $5`,
          [
            JSON.stringify(resultArray),
            totalScore,
            question.category ?? null,
            questionIdNum,
            activeSurvey.id,
          ],
        )
      } else {
        await query(
          `INSERT INTO growth_survey_responses (
             ${questionColumn},
             ${surveyColumn},
             ${categoryColumn},
             result,
             total_score
           ) VALUES ($1, $2, $3, $4::jsonb, $5)`,
          [
            questionIdNum,
            activeSurvey.id,
            question.category ?? null,
            JSON.stringify(resultArray),
            totalScore,
          ],
        )
      }
    } else {
      // For single choice questions, calculate scores normally
      // Remove existing entry for this employee
      resultArray = resultArray.filter((entry) => entry.uid !== user.userId)

      // Add new entry for this employee (only store uid and score, no answerText)
      resultArray.push({
        uid: user.userId,
        s: finalScore,
      })

      // Calculate total score
      // Sum of all scores (excluding free text questions which have null scores)
      const sumOfScores = resultArray.reduce((sum, entry) => {
        return sum + (entry.s ?? 0)
      }, 0)
      
      // Number of participants (excluding null scores)
      const participantCount = resultArray.filter(entry => entry.s !== null).length
      
      // Average score
      const averageScore = participantCount > 0 ? sumOfScores / participantCount : 0
      
      // If average score >= 0.85, use question weight; if < 0.85, use 0
      const totalScore = averageScore >= 0.85 
        ? (question.weight ?? 1.0) 
        : 0

      if (existing.rows.length > 0) {
        await query(
          `UPDATE growth_survey_responses
           SET result = $1::jsonb,
               total_score = $2,
               ${categoryColumn} = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE ${questionColumn} = $4 AND ${surveyColumn} = $5`,
          [
            JSON.stringify(resultArray),
            totalScore,
            question.category ?? null,
            questionIdNum,
            activeSurvey.id,
          ],
        )
      } else {
        await query(
          `INSERT INTO growth_survey_responses (
             ${questionColumn},
             ${surveyColumn},
             ${categoryColumn},
             result,
             total_score
           ) VALUES ($1, $2, $3, $4::jsonb, $5)`,
          [
            questionIdNum,
            activeSurvey.id,
            question.category ?? null,
            JSON.stringify(resultArray),
            totalScore,
          ],
        )
      }
    }

    // Calculate user's progress (count only from growth_survey_responses table)
    // Free text responses are also stored in growth_survey_responses, so we don't need to count from growth_survey_free_text_responses
    const totalQuestions = await getAccessibleGrowthSurveyQuestionCount(user.userId, { activeOnly: true }) || 0
    
    // Count all responses (both single choice and free text) from growth_survey_responses table only
    const userAnsweredQuestions = await query<{ count: number }>(
      `SELECT COUNT(DISTINCT ${questionColumn}) as count
       FROM growth_survey_responses
       WHERE ${surveyColumn} = $1
         AND EXISTS (
           SELECT 1 
           FROM jsonb_array_elements(result) AS elem
           WHERE (elem->>'uid')::integer = $2 OR (elem->>'employeeId')::integer = $2
         )`,
      [activeSurvey.id, user.userId],
    )
    
    const progressCount = parseInt(String(userAnsweredQuestions.rows[0]?.count || 0), 10)
    const answeredAll = totalQuestions > 0 && progressCount >= totalQuestions

    // Get completedAt if survey is completed
    let completedAt: string | null = null
    if (answeredAll) {
      const summaryResult = await query<{ updated_at: string }>(
        `SELECT updated_at
         FROM growth_survey_summary
         WHERE uid = $1 AND gsid = $2
         LIMIT 1`,
        [user.userId, activeSurvey.id]
      )
      if (summaryResult.rows.length > 0) {
        completedAt = summaryResult.rows[0].updated_at
      } else {
        // If no summary exists yet, use current time as fallback
        completedAt = new Date().toISOString()
      }
    }

    return successResponse({
      message: "回答を保存しました",
      progressCount,
      totalQuestions,
      completed: answeredAll,
      completedAt,
    })
  } catch (error) {
    return handleError(error, "回答の保存に失敗しました", "Save growth survey response")
  }
}

export const PUT = withAuthParams(handlePut)

