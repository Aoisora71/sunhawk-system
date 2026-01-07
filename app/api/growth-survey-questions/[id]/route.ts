import { type NextRequest } from "next/server"
import { withAdminParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse, notFoundResponse } from "@/lib/api-errors"
import type { GrowthSurveyQuestion } from "@/lib/types"

async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string },
) {
  try {
    const params = await context.params
    const questionId = params.id
    if (!questionId) {
      return badRequestResponse("IDが指定されていません")
    }

    const body = await request.json()
    const { updateGrowthSurveyQuestionSchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(updateGrowthSurveyQuestionSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { questionText, category, weight, targetJobs, answers, focusArea, answerType, isActive, questionType } = validation.data

    // For free_text questions, always set category and weight to null
    const finalCategory = questionType === 'free_text' ? null : (category?.trim() ?? null)
    // Handle weight: preserve 0, null for empty, and parse numeric values
    const finalWeight = questionType === 'free_text' 
      ? null 
      : (weight === null || weight === undefined || weight === '') 
        ? null 
        : parseFloat(String(weight))

    // Format targetJobs and answers as JSONB
    const targetJobsJson = Array.isArray(targetJobs) && targetJobs.length > 0 ? JSON.stringify(targetJobs) : null
    const answersJson = Array.isArray(answers) && answers.length > 0 ? JSON.stringify(answers) : null

    const result = await query(
      `UPDATE growth_survey_questions
      SET 
        question_text = COALESCE($1, question_text),
        category = $2,
        weight = $3,
        target_jobs = COALESCE($4::jsonb, target_jobs),
        answers = COALESCE($5::jsonb, answers),
        focus_area = COALESCE($6, focus_area),
        answer_type = COALESCE($7, answer_type),
        question_type = COALESCE($8, question_type),
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *`,
      [
        questionText?.trim() ?? null,
        finalCategory,
        finalWeight,
        targetJobsJson,
        answersJson,
        focusArea?.trim() ?? null,
        answerType ?? null,
        questionType ?? null,
        typeof isActive === "boolean" ? isActive : null,
        questionId,
      ],
    )

    if (!result.rowCount) {
      return notFoundResponse("質問")
    }

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
    return handleError(error, "グロースサーベイ質問の更新に失敗しました", "Update growth survey question")
  }
}

async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string },
) {
  try {
    const params = await context.params
    const questionId = params.id
    if (!questionId) {
      return badRequestResponse("IDが指定されていません")
    }

    const result = await query(`DELETE FROM growth_survey_questions WHERE id = $1`, [questionId])

    if (!result.rowCount) {
      return notFoundResponse("質問")
    }

    return successResponse({ message: "質問を削除しました" })
  } catch (error) {
    return handleError(error, "グロースサーベイ質問の削除に失敗しました", "Delete growth survey question")
  }
}

export const PUT = withAdminParams(handlePut)
export const DELETE = withAdminParams(handleDelete)

