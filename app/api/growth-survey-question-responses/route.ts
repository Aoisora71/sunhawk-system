import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { AdminUser } from "@/lib/middleware"
import { fetchGrowthSurveyQuestions } from "@/lib/growth-survey"
import { getGrowthSurveyOptions } from "@/lib/growth-survey-utils"

/**
 * GET /api/growth-survey-question-responses - Get detailed response statistics for each question
 * Query params: surveyId (required) - Survey ID
 * Returns: For each question, the count of users who selected each answer option
 */
async function handleGet(request: NextRequest, user: AdminUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyIdParam = searchParams.get("surveyId")

    if (!surveyIdParam) {
      return badRequestResponse("surveyIdは必須です")
    }

    const surveyId = parseInt(surveyIdParam, 10)
    if (isNaN(surveyId)) {
      return badRequestResponse("無効なsurveyIdです")
    }

    // Check which columns exist to support both old and new column names
    const columnCheck = await query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'growth_survey_responses' 
         AND column_name IN ('gqid', 'question_id', 'gsid', 'survey_id')`
    )
    const hasNewColumns = columnCheck.rows.some(r => r.column_name === 'gqid')
    const questionColumn = hasNewColumns ? 'gqid' : 'question_id'
    const surveyColumn = hasNewColumns ? 'gsid' : 'survey_id'

    // Get all questions for this survey (only single choice questions, exclude free text)
    const allQuestions = await fetchGrowthSurveyQuestions()
    const questions = allQuestions.filter(
      (q) => q.isActive && q.questionType === 'single_choice' && q.answerType !== 'text'
    )

    // Get all responses for this survey
    const responsesResult = await query<{
      gqid: number
      result: any[]
    }>(
      `SELECT 
         ${questionColumn} as gqid,
         result
       FROM growth_survey_responses
       WHERE ${surveyColumn} = $1`,
      [surveyId],
    )

    // Build a map of questionId -> array of user responses (uid and score pairs)
    const questionResponsesMap = new Map<number, Array<{ uid: number; score: number }>>()
    
    for (const row of responsesResult.rows) {
      const questionId = row.gqid
      let resultArray: Array<{ uid: number; s: number | null }> = []
      
      try {
        const parsed = Array.isArray(row.result)
          ? row.result
          : typeof row.result === 'string'
          ? JSON.parse(row.result)
          : []
        resultArray = parsed.map((entry: any) => ({
          uid: entry.uid ?? entry.employeeId ?? 0,
          s: entry.s ?? entry.score ?? null,
        }))
      } catch {
        continue
      }

      // Collect all user responses (non-null scores) for this question
      const userResponses = resultArray
        .filter((entry) => entry.s !== null && entry.uid > 0)
        .map((entry) => ({
          uid: entry.uid,
          score: entry.s as number,
        }))
      
      questionResponsesMap.set(questionId, userResponses)
    }

    // Build response statistics for each question
    const questionStats = questions.map((question) => {
      const options = getGrowthSurveyOptions(question)
      const userResponses = questionResponsesMap.get(question.id) || []
      
      // Count how many users selected each option
      const optionCounts = options.map((option) => {
        // Count unique users who selected this option (match by score)
        if (option.score === null) {
          return {
            label: option.label,
            score: option.score,
            count: 0,
          }
        }
        
        const matchingUsers = new Set<number>()
        userResponses.forEach((response) => {
          // Use small epsilon for floating point comparison
          if (Math.abs(response.score - option.score!) < 0.001) {
            matchingUsers.add(response.uid)
          }
        })
        
        return {
          label: option.label,
          score: option.score,
          count: matchingUsers.size,
        }
      })

      // Calculate total respondents (unique users who answered this question)
      const uniqueUserIds = new Set(userResponses.map((r) => r.uid))
      const totalRespondents = uniqueUserIds.size

      return {
        questionId: question.id,
        questionText: question.questionText,
        category: question.category || null,
        options: optionCounts,
        totalRespondents,
      }
    })

    return successResponse({
      surveyId,
      questions: questionStats,
    })
  } catch (error) {
    return handleError(error, "質問別回答状況の取得に失敗しました", "Get growth survey question responses")
  }
}

export const GET = withAdmin(handleGet)

