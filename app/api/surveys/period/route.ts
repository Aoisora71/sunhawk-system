import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

const SURVEY_TYPES = ["organizational", "growth"] as const
const normalizeSurveyType = (value?: string | null): typeof SURVEY_TYPES[number] | null => {
  if (!value) return null
  const lower = value.toLowerCase()
  return SURVEY_TYPES.includes(lower as typeof SURVEY_TYPES[number]) ? (lower as typeof SURVEY_TYPES[number]) : null
}

// GET /api/surveys/period - Get the active survey period (public)
export async function GET(request: NextRequest) {
  let requestedType: string | null = null
  try {
    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get("type") || searchParams.get("surveyType")
    requestedType = normalizeSurveyType(typeParam)

    // Check if surveys table exists
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'surveys'
      )`
    )
    
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ 
        success: true,
        available: false,
        message: "サーベイ期間が設定されていません",
        surveyType: requestedType,
        nextStartDate: null,
      })
    }

    // Get the active survey (status = 'active' and within date range)
    // Use CURRENT_DATE to handle date comparisons correctly
    // end_date should include the entire day (end_date >= CURRENT_DATE means end_date is today or later)
    const params: (string | null)[] = []
    let paramIndex = 1
    let filterClause = ""
    if (requestedType) {
      filterClause = ` AND survey_type = $${paramIndex++}`
      params.push(requestedType)
    }

    // Compare dates properly: start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
    // This includes surveys where end_date is today (they are still active today)
    // Using ::date cast ensures we compare only the date part, ignoring time components
    const result = await query(
      `SELECT id, name, start_date, end_date, status, survey_type
       FROM surveys
       WHERE status = 'active'
         AND start_date::date <= CURRENT_DATE
         AND end_date::date >= CURRENT_DATE
         ${filterClause}
       ORDER BY created_at DESC
       LIMIT 1`,
      params
    )

    // Also find the next upcoming active survey
    const upcomingParams: (string | null)[] = []
    let upcomingParamIndex = 1
    let upcomingFilterClause = ""
    if (requestedType) {
      upcomingFilterClause = ` AND survey_type = $${upcomingParamIndex++}`
      upcomingParams.push(requestedType)
    }

    const nextRes = await query(
      `SELECT start_date
       FROM surveys
       WHERE status = 'active'
         AND start_date::date > CURRENT_DATE
         ${upcomingFilterClause}
       ORDER BY start_date ASC
       LIMIT 1`,
      upcomingParams
    )
    const nextStartDate = nextRes.rows[0]?.start_date || null

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        available: false,
        surveyType: requestedType,
        message: "サーベイのサーベイ期間ではありません。",
        nextStartDate,
      })
    }

    const survey = result.rows[0]

    return NextResponse.json({
      success: true,
      available: true,
      surveyType: survey.survey_type,
      survey: {
        id: survey.id.toString(),
        name: survey.name,
        startDate: survey.start_date,
        endDate: survey.end_date,
        status: survey.status,
        surveyType: survey.survey_type,
      },
      nextStartDate,
    })
  } catch (error) {
    const { handleError } = await import("@/lib/api-errors")
    return handleError(error, "サーベイ期間の取得に失敗しました", "Get survey period")
  }
}

