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

    // Check if running column exists and get actual column names
    const columnCheck = await query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'surveys' 
         AND column_name IN ('running', 'survey_type', 'survey_t')`
    )
    const hasRunning = columnCheck.rows.some(r => r.column_name === 'running')
    const actualSurveyTypeColumn = columnCheck.rows.find(r => r.column_name === 'survey_type' || r.column_name === 'survey_t')?.column_name || 'survey_type'
    
    console.log('[Survey Period API] Column check:', {
      hasRunning,
      actualSurveyTypeColumn,
      allColumns: columnCheck.rows.map(r => r.column_name)
    })

    // Get the active survey (status = 'active' and within date range)
    // Use CURRENT_DATE to handle date comparisons correctly
    // end_date should include the entire day (end_date >= CURRENT_DATE means end_date is today or later)
    const params: (string | null)[] = []
    let paramIndex = 1
    let filterClause = ""
    if (requestedType) {
      filterClause = ` AND ${actualSurveyTypeColumn} = $${paramIndex++}`
      params.push(requestedType)
    }

    // Only allow participation in surveys with running = true
    // Do not check date range - only running = true surveys are available for participation
    let result: any = { rows: [] }
    
    if (hasRunning) {
      // Only look for running = true surveys (no date check, no fallback to date range)
      const runningQuery = `SELECT id, name, start_date, end_date, status, ${actualSurveyTypeColumn} as survey_type, running
        FROM surveys
        WHERE status = 'active'
          AND running = true
          ${filterClause}
        ORDER BY created_at DESC
        LIMIT 1`
      
      console.log('[Survey Period API] Running query:', runningQuery)
      console.log('[Survey Period API] Params:', params)
      
      result = await query(runningQuery, params)
      
      console.log('[Survey Period API] Running = true result rows:', result.rows.length)
      if (result.rows.length > 0) {
        console.log('[Survey Period API] Found running = true survey:', JSON.stringify(result.rows[0], null, 2))
      } else {
        // Debug: Check what surveys exist
        const debugQuery = `SELECT id, name, start_date, end_date, status, ${actualSurveyTypeColumn} as survey_type, running
          FROM surveys
          WHERE status = 'active'${filterClause}
          ORDER BY created_at DESC`
        const debugResult = await query(debugQuery, params)
        console.log('[Survey Period API] All active surveys:', JSON.stringify(debugResult.rows, null, 2))
        
        // Also check specifically for running = true surveys
        const runningCheckQuery = `SELECT id, name, start_date, end_date, status, ${actualSurveyTypeColumn} as survey_type, running
          FROM surveys
          WHERE status = 'active' AND running = true${filterClause}
          ORDER BY created_at DESC`
        const runningCheckResult = await query(runningCheckQuery, params)
        console.log('[Survey Period API] Running = true surveys (debug):', JSON.stringify(runningCheckResult.rows, null, 2))
      }
    } else {
      // If running column doesn't exist, return no available survey
      // This ensures backward compatibility while enforcing the new requirement
      console.log('[Survey Period API] Running column does not exist - returning no available survey')
    }

    // Also find the next upcoming active survey
    const upcomingParams: (string | null)[] = []
    let upcomingParamIndex = 1
    let upcomingFilterClause = ""
    if (requestedType) {
      upcomingFilterClause = ` AND ${actualSurveyTypeColumn} = $${upcomingParamIndex++}`
      upcomingParams.push(requestedType)
    }

    const nextRunningFilter = hasRunning ? ' AND (running IS NULL OR running IS TRUE)' : ''
    
    const nextRes = await query(
      `SELECT start_date
       FROM surveys
       WHERE status = 'active'
         AND start_date::date > CURRENT_DATE
         ${nextRunningFilter}
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

