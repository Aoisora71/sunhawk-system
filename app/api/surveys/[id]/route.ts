import { type NextRequest } from "next/server"
import { withAdminParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse, notFoundResponse } from "@/lib/api-errors"
import type { Survey } from "@/lib/types"

const SURVEY_TYPES = ["organizational", "growth"] as const
const normalizeSurveyType = (value?: string | null): typeof SURVEY_TYPES[number] => {
  const lower = (value || "").toLowerCase()
  return SURVEY_TYPES.includes(lower as typeof SURVEY_TYPES[number]) ? (lower as typeof SURVEY_TYPES[number]) : "organizational"
}

// GET /api/surveys/[id] - Get single survey
async function handleGet(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  try {
    const { id } = await context.params

    const result = await query(
      `SELECT id, name, start_date, end_date, status, survey_type, created_at, updated_at
       FROM surveys
       WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return notFoundResponse("サーベイ")
    }

    const survey = result.rows[0]

    return successResponse({
      survey: {
        id: Number(survey.id),
        name: survey.name,
        startDate: survey.start_date,
        endDate: survey.end_date,
        status: survey.status as 'active' | 'completed' | 'draft',
        surveyType: normalizeSurveyType(survey.survey_type) as 'organizational' | 'growth',
        createdAt: survey.created_at,
        updatedAt: survey.updated_at,
      },
    })
  } catch (error) {
    return handleError(error, "サーベイの取得に失敗しました", "Get survey")
  }
}

// PUT /api/surveys/[id] - Update survey
async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { updateSurveySchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(updateSurveySchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { name, startDate, endDate, status, surveyType } = validation.data
    const normalizedType = normalizeSurveyType(surveyType)

    const result = await query<{
      id: number
      name: string
      start_date: string
      end_date: string
      status: string
      survey_type: string
      created_at: string
      updated_at: string
    }>(
      `UPDATE surveys 
       SET name = $1, start_date = $2, end_date = $3, status = $4, survey_type = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, name, start_date, end_date, status, survey_type, created_at, updated_at`,
      [name?.trim() || null, startDate, endDate, status || "active", normalizedType, id]
    )

    if (result.rows.length === 0) {
      return notFoundResponse("サーベイ")
    }

    const survey = result.rows[0]

    return successResponse({
      survey: {
        id: Number(survey.id),
        name: survey.name,
        startDate: survey.start_date,
        endDate: survey.end_date,
        status: survey.status as 'active' | 'completed' | 'draft',
        surveyType: normalizeSurveyType(survey.survey_type) as 'organizational' | 'growth',
        createdAt: survey.created_at,
        updatedAt: survey.updated_at,
      },
    })
  } catch (error) {
    return handleError(error, "サーベイの更新に失敗しました", "Update survey")
  }
}

// DELETE /api/surveys/[id] - Delete survey and all related data
async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  try {
    const { id } = await context.params
    const surveyId = parseInt(id, 10)

    if (Number.isNaN(surveyId)) {
      return badRequestResponse("無効なサーベイIDです")
    }

    // Check if survey exists
    const surveyCheck = await query(
      `SELECT id FROM surveys WHERE id = $1`,
      [surveyId]
    )

    if (surveyCheck.rows.length === 0) {
      return notFoundResponse("サーベイ")
    }

    // Delete related data explicitly (even though CASCADE should handle most of it)
    // This ensures all data is deleted even if some foreign key constraints are missing

    // 1. Delete notifications related to this survey
    await query(
      `DELETE FROM notifications WHERE survey_id = $1`,
      [surveyId]
    )

    // 2. Delete organizational survey free-text responses
    await query(
      `DELETE FROM organizational_survey_free_text_responses WHERE osid = $1`,
      [surveyId]
    )

    // 3. Delete organizational survey results
    await query(
      `DELETE FROM organizational_survey_results WHERE osid = $1`,
      [surveyId]
    )

    // 4. Delete organizational survey summary
    await query(
      `DELETE FROM organizational_survey_summary WHERE osid = $1`,
      [surveyId]
    )

    // 5. Delete growth survey free-text responses
    await query(
      `DELETE FROM growth_survey_free_text_responses WHERE gsid = $1`,
      [surveyId]
    )

    // 6. Delete growth survey responses
    await query(
      `DELETE FROM growth_survey_responses WHERE gsid = $1`,
      [surveyId]
    )

    // 7. Delete growth survey summary
    await query(
      `DELETE FROM growth_survey_summary WHERE gsid = $1`,
      [surveyId]
    )

    // 8. Delete survey progress records
    await query(
      `DELETE FROM survey_progress WHERE survey_id = $1`,
      [surveyId]
    )

    // 9. Finally, delete the survey itself
    // This will trigger CASCADE on any remaining foreign key constraints
    const result = await query(
      `DELETE FROM surveys WHERE id = $1 RETURNING id`,
      [surveyId]
    )

    if (result.rows.length === 0) {
      return handleError(new Error("Failed to delete survey"), "サーベイの削除に失敗しました", "Delete survey")
    }

    return successResponse({
      message: "サーベイと関連データを削除しました",
    })
  } catch (error) {
    return handleError(error, "サーベイの削除に失敗しました", "Delete survey")
  }
}

export const GET = withAdminParams(handleGet)
export const PUT = withAdminParams(handlePut)
export const DELETE = withAdminParams(handleDelete)

