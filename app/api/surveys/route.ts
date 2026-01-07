import { type NextRequest } from "next/server"
import { withAdmin, type AdminUser } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { Survey } from "@/lib/types"

const SURVEY_TYPES = ["organizational", "growth"] as const

function normalizeSurveyType(value?: string | null): typeof SURVEY_TYPES[number] {
  const lower = (value || "").toLowerCase()
  return SURVEY_TYPES.includes(lower as typeof SURVEY_TYPES[number]) ? (lower as typeof SURVEY_TYPES[number]) : "organizational"
}

// GET /api/surveys - List all surveys
async function handleGet(request: NextRequest, user: AdminUser) {
  try {
    const result = await query(
      `SELECT id, name, start_date, end_date, status, survey_type, created_at, updated_at
       FROM surveys
       ORDER BY created_at DESC`
    )

    const surveys: Survey[] = result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status as 'active' | 'completed' | 'draft',
      surveyType: normalizeSurveyType(row.survey_type) as 'organizational' | 'growth',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return successResponse({ surveys })
  } catch (error) {
    return handleError(error, "サーベイ一覧の取得に失敗しました", "List surveys")
  }
}

// POST /api/surveys - Create new survey
async function handlePost(request: NextRequest, user: AdminUser) {
  try {
    const body = await request.json()
    const { createSurveySchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(createSurveySchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { name, startDate, endDate, surveyType } = validation.data
    const normalizedType = normalizeSurveyType(surveyType)

    const result = await query<{
      id: number
      name: string
      start_date: string
      end_date: string
      status: string
      survey_type: string
      created_at: string
    }>(
      `INSERT INTO surveys (name, start_date, end_date, status, survey_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, start_date, end_date, status, survey_type, created_at`,
      [name.trim(), startDate, endDate, "active", normalizedType, user.userId]
    )

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
      },
    })
  } catch (error) {
    return handleError(error, "サーベイの作成に失敗しました", "Create survey")
  }
}

export const GET = withAdmin(handleGet)
export const POST = withAdmin(handlePost)

