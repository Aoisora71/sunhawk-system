import { type NextRequest } from "next/server"
import { withAdmin, withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import {
  fetchGrowthSurveyQuestions,
  getUserJobName,
  growthSurveyQuestionsTableExists,
} from "@/lib/growth-survey"
import { filterGrowthSurveyQuestionsByJob } from "@/lib/growth-survey-utils"
import { successResponse, handleError, badRequestResponse, notFoundResponse } from "@/lib/api-errors"
import type { GrowthSurveyQuestion } from "@/lib/types"

async function handleGet(request: NextRequest, user: { userId: number; role: string }) {
  try {
    const allQuestions = await fetchGrowthSurveyQuestions()
    const { searchParams } = new URL(request.url)
    const activeOnlyParam = searchParams.get("activeOnly") === "true"
    const jobFilter = searchParams.get("jobName")

    const effectiveActiveOnly = user.role === "admin" ? activeOnlyParam : true
    const jobName =
      user.role === "admin" ? (jobFilter && jobFilter.length > 0 ? jobFilter : null) : await getUserJobName(user.userId)

    const filteredQuestions = filterGrowthSurveyQuestionsByJob(allQuestions, jobName, {
      activeOnly: effectiveActiveOnly,
    })

    return successResponse({ questions: filteredQuestions as GrowthSurveyQuestion[] })
  } catch (error) {
    return handleError(error, "グロースサーベイ質問の取得に失敗しました", "Get growth survey questions")
  }
}

async function handlePost(request: NextRequest, user: { userId: number }) {
  try {
    const tableReady = await growthSurveyQuestionsTableExists()
    if (!tableReady) {
      return notFoundResponse("グロースサーベイ質問テーブル")
    }

    const body = await request.json()
    const { createGrowthSurveyQuestionSchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(createGrowthSurveyQuestionSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { questionText, category, weight, targetJobs: targetJobsInput, answers: answersInput, focusArea, answerType, questionType } = validation.data

    // For free_text questions, always set category and weight to null
    const finalQuestionType = questionType || 'single_choice'
    const finalCategory = finalQuestionType === 'free_text' ? null : (category?.trim() || null)
    // Handle weight: preserve 0, null for empty, and parse numeric values
    const finalWeight = finalQuestionType === 'free_text' 
      ? null 
      : (weight === null || weight === undefined || weight === '') 
        ? null 
        : parseFloat(String(weight))

    // Validate and format targetJobs and answers as JSONB
    const targetJobsJson = Array.isArray(targetJobsInput) && targetJobsInput.length > 0 ? JSON.stringify(targetJobsInput) : null
    const answersJson = Array.isArray(answersInput) && answersInput.length > 0 ? JSON.stringify(answersInput) : null

    // Get the maximum display_order to set the new question at the end
    const maxOrderResult = await query<{ max_order: number | null }>(
      `SELECT COALESCE(MAX(display_order), 0) as max_order FROM growth_survey_questions`
    )
    const nextOrder = (maxOrderResult.rows[0]?.max_order ?? 0) + 1

    const result = await query(
      `INSERT INTO growth_survey_questions (
        question_text,
        category,
        weight,
        target_jobs,
        answers,
        focus_area,
        answer_type,
        question_type,
        display_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        questionText.trim(),
        finalCategory,
        finalWeight,
        targetJobsJson,
        answersJson,
        focusArea?.trim() || null,
        answerType || "scale",
        finalQuestionType,
        nextOrder,
      ],
    )

    const row = result.rows[0]
    
    let parsedTargetJobs: string[] = []
    let parsedAnswers: { text: string; score: number | null }[] = []
    
    if (row.target_jobs) {
      try {
        parsedTargetJobs = Array.isArray(row.target_jobs) ? row.target_jobs : typeof row.target_jobs === 'string' ? JSON.parse(row.target_jobs) : []
      } catch {
        parsedTargetJobs = []
      }
    }
    
    if (row.answers) {
      try {
        parsedAnswers = Array.isArray(row.answers) ? row.answers : typeof row.answers === 'string' ? JSON.parse(row.answers) : []
      } catch {
        parsedAnswers = []
      }
    }

    return successResponse({
      question: {
        id: Number(row.id),
        questionText: row.question_text,
        category: row.category,
        weight: row.weight !== null && row.weight !== undefined ? row.weight : null,
        targetJobs: parsedTargetJobs,
        answers: parsedAnswers,
        focusArea: row.focus_area,
        answerType: row.answer_type,
        questionType: (row.question_type || 'single_choice') as 'single_choice' | 'free_text',
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    })
  } catch (error) {
    return handleError(error, "グロースサーベイ質問の登録に失敗しました", "Create growth survey question")
  }
}

export const GET = withAuth(handleGet)
export const POST = withAdmin(handlePost)

