import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import {
  badRequestResponse,
  forbiddenResponse,
  handleError,
  successResponse,
} from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"
import type { GrowthSurveyAnswer, GrowthSurveyResponse } from "@/lib/types"
import { getAccessibleGrowthSurveyQuestionCount, getActiveGrowthSurvey, fetchGrowthSurveyQuestions } from "@/lib/growth-survey"
import { getGrowthSurveyOptions } from "@/lib/growth-survey-utils"

async function getTargetUserId(
  request: NextRequest,
  user: AuthenticatedUser,
): Promise<{ userId: number } | { error: ReturnType<typeof forbiddenResponse> | ReturnType<typeof badRequestResponse> }> {
  const { searchParams } = new URL(request.url)
  const requestedUserId = searchParams.get("userId")

  if (!requestedUserId) {
    return { userId: user.userId }
  }

  if (user.role !== "admin") {
    return { error: forbiddenResponse() }
  }

  const parsed = parseInt(requestedUserId, 10)
  if (Number.isNaN(parsed)) {
    return { error: badRequestResponse("無効なユーザーIDです") }
  }

  return { userId: parsed }
}

async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const target = await getTargetUserId(request, user)
    if ("error" in target) {
      return target.error
    }

    const activeSurvey = await getActiveGrowthSurvey()
    const baseTotal = await getAccessibleGrowthSurveyQuestionCount(target.userId, { activeOnly: true })

    if (!activeSurvey) {
      // No active growth survey; return empty response with zero totals
      const responsePayload: GrowthSurveyResponse = {
        userId: target.userId,
        responses: [],
        progressCount: 0,
        totalQuestions: baseTotal,
        completed: false,
        completedAt: null,
        createdAt: null,
        updatedAt: null,
      }
      return successResponse({ response: responsePayload })
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

    // Optimize: Fetch user job and question responses in parallel
    // Free text responses are also stored in growth_survey_responses, so we don't need to query growth_survey_free_text_responses separately
    const [questionResponsesResult, userJobResult, allQuestions, freeTextResponsesForDisplayResult] = await Promise.all([
      // Get all question responses for this survey (includes both single choice and free text)
      query<{
        gqid: number
        result: any[]
      }>(
        `SELECT 
           ${questionColumn} as gqid,
           result
         FROM growth_survey_responses
         WHERE ${surveyColumn} = $1`,
        [activeSurvey.id],
      ),
      // Get user's job name
      query<{ job_name: string | null }>(
        `SELECT j.name as job_name
         FROM users u
         LEFT JOIN jobs j ON j.id = u.job_id
         WHERE u.id = $1`,
        [target.userId],
      ),
      // Get all accessible questions for this user
      fetchGrowthSurveyQuestions(),
      // Get free text responses only for displaying the answer text (not for counting)
      query<{
        gqid: number
        answer_text: string
      }>(
        `SELECT gqid, answer_text
         FROM growth_survey_free_text_responses
         WHERE gsid = $1 AND uid = $2`,
        [activeSurvey.id, target.userId],
      ),
    ])

    const questionResponses = questionResponsesResult
    const freeTextResponsesForDisplay = freeTextResponsesForDisplayResult
    const userJobName = userJobResult.rows[0]?.job_name
    const accessibleQuestions = allQuestions.filter((q) => {
      if (!q.isActive) return false
      if (q.targetJobs.length > 0) {
        if (!userJobName || !q.targetJobs.includes(userJobName)) {
          return false
        }
      }
      return true
    })

    // Build responses array by checking which questions the user has answered
    const responses: GrowthSurveyAnswer[] = []
    let progressCount = 0

    for (const question of accessibleQuestions) {
      // Check both questionType (new) and answerType (legacy) for free text questions
      const isFreeTextQuestion = question.questionType === "free_text" || question.answerType === "text"
      
      // Check for response in growth_survey_responses table (works for both single choice and free text)
      const questionResponse = questionResponses.rows.find(
        (qr) => qr.gqid === question.id
      )

      if (questionResponse && questionResponse.result) {
        let resultArray: Array<{ uid: number; s: number | null; employeeId?: number; score?: number | null }> = []
        try {
          const parsed = Array.isArray(questionResponse.result)
            ? questionResponse.result
            : typeof questionResponse.result === 'string'
            ? JSON.parse(questionResponse.result)
            : []
          // Support both old format (employeeId, score) and new format (uid, s)
          resultArray = parsed.map((entry: any) => ({
            uid: entry.uid ?? entry.employeeId ?? 0,
            s: entry.s ?? entry.score ?? null,
          }))
        } catch {
          resultArray = []
        }

        // Find this user's entry in the result array
        const userEntry = resultArray.find((entry) => entry.uid === target.userId)

        if (userEntry) {
          progressCount++
          
          if (isFreeTextQuestion) {
            // For free text questions, get the answer text from growth_survey_free_text_responses for display
            const freeTextResponse = freeTextResponsesForDisplay.rows.find(
              (ftr) => ftr.gqid === question.id
            )
            
            responses.push({
              questionId: question.id,
              questionText: question.questionText,
              category: question.category ?? "",
              answer: freeTextResponse?.answer_text || "",
              score: null, // Free text questions have no score
              answerType: question.answerType,
              savedAt: new Date().toISOString(), // Approximate, could be improved
            })
          } else {
            // For single choice questions, reconstruct answer text from score and question options
            if (userEntry.s !== null) {
              let answerText = ""
              const options = getGrowthSurveyOptions(question)
              const matchedOption = options.find((option) => option.score === userEntry.s)
              answerText = matchedOption?.label || ""
              
              responses.push({
                questionId: question.id,
                questionText: question.questionText,
                category: question.category ?? "",
                answer: answerText,
                score: userEntry.s,
                answerType: question.answerType,
                savedAt: new Date().toISOString(), // Approximate, could be improved
              })
            }
          }
        }
      }
    }

    const answeredAll = baseTotal > 0 && progressCount >= baseTotal

    // Get completion timestamp from growth_survey_summary if completed
    let completedAt: string | null = null
    if (answeredAll) {
      const summaryResult = await query<{ updated_at: string }>(
        `SELECT updated_at
         FROM growth_survey_summary
         WHERE uid = $1 AND gsid = $2
         LIMIT 1`,
        [target.userId, activeSurvey.id]
      )
      if (summaryResult.rows.length > 0) {
        completedAt = summaryResult.rows[0].updated_at
      } else {
        // If no summary exists yet, use current time as fallback
        completedAt = new Date().toISOString()
      }
    }

    const responsePayload: GrowthSurveyResponse = {
      userId: target.userId,
      responses,
      progressCount,
      totalQuestions: baseTotal,
      completed: answeredAll,
      completedAt,
      createdAt: null,
      updatedAt: null,
    }

    return successResponse({ response: responsePayload })
  } catch (error) {
    return handleError(error, "グロースサーベイ回答の取得に失敗しました", "Get growth survey responses")
  }
}

async function handlePost(request: NextRequest, user: AuthenticatedUser) {
  try {
    const activeSurvey = await getActiveGrowthSurvey()
    if (!activeSurvey) {
      return badRequestResponse("現在、グロースサーベイのサーベイ期間ではありません")
    }

    // Check which column names to use
    const columnCheck = await query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'growth_survey_responses' 
         AND column_name IN ('gqid', 'question_id', 'gsid', 'survey_id')`
    )
    const hasNewColumns = columnCheck.rows.some(r => r.column_name === 'gqid')
    const questionColumn = hasNewColumns ? 'gqid' : 'question_id'
    const surveyColumn = hasNewColumns ? 'gsid' : 'survey_id'

    const totalQuestions = await getAccessibleGrowthSurveyQuestionCount(user.userId, { activeOnly: true }) || 0

    if (totalQuestions === 0) {
      return badRequestResponse("現在回答可能なグロースサーベイがありません")
    }

    // Count how many questions the user has answered
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
    const progressCount = parseInt(String(userAnsweredQuestions.rows[0]?.count || '0'), 10)

    if (progressCount < totalQuestions) {
      const remaining = totalQuestions - progressCount
      return badRequestResponse(`未回答の質問が${remaining}件あります`)
    }

    // All questions answered - survey is complete for this user
    // No need to update anything since completion is calculated dynamically
    return successResponse({ message: "グロースサーベイを提出しました" })
  } catch (error) {
    return handleError(error, "グロースサーベイの送信に失敗しました", "Submit growth survey")
  }
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

