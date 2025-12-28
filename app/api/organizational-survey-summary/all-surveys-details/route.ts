import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/organizational-survey-summary/all-surveys-details - Get all survey details with employee and department data
 * Returns all organizational surveys with their participants, scores, and department information
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    // Admin only
    if (user.role !== "admin") {
      return successResponse({ surveys: [] })
    }

    // Get all surveys
    const surveysQuery = await query<{
      id: number
      name: string
      start_date: string
      end_date: string
      status: string
      survey_type: string
      created_at: string
      updated_at: string
    }>(`
      SELECT id, name, start_date, end_date, status, survey_type, created_at, updated_at
      FROM surveys
      WHERE survey_type = 'organizational'
      ORDER BY start_date DESC, created_at DESC
    `)

    // Get all summaries with user and department info
    const summariesQuery = await query<{
      id: number
      uid: number
      osid: number
      category1_score: number
      category2_score: number
      category3_score: number
      category4_score: number
      category5_score: number
      category6_score: number
      category7_score: number
      category8_score: number
      total_score: number
      created_at: string
      updated_at: string
      user_name: string | null
      email: string | null
      department_id: number | null
      department_name: string | null
      department_code: string | null
      job_name: string | null
      job_code: string | null
      response_rate: number | null
    }>(`
      SELECT 
        oss.id,
        oss.uid,
        oss.osid,
        oss.category1_score,
        oss.category2_score,
        oss.category3_score,
        oss.category4_score,
        oss.category5_score,
        oss.category6_score,
        oss.category7_score,
        oss.category8_score,
        oss.total_score,
        oss.created_at,
        oss.updated_at,
        u.name as user_name,
        u.email,
        d.id as department_id,
        d.name as department_name,
        d.code as department_code,
        j.name as job_name,
        j.code as job_code,
        osr.response_rate
      FROM organizational_survey_summary oss
      LEFT JOIN users u ON oss.uid = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN jobs j ON u.job_id = j.id
      LEFT JOIN organizational_survey_results osr ON oss.uid = osr.uid AND oss.osid = osr.osid
      ORDER BY oss.osid DESC, oss.updated_at DESC
    `)

    // Group summaries by survey ID
    const summariesBySurvey = new Map<number, any[]>()
    summariesQuery.rows.forEach((row) => {
      const surveyId = row.osid
      if (!summariesBySurvey.has(surveyId)) {
        summariesBySurvey.set(surveyId, [])
      }
      summariesBySurvey.get(surveyId)!.push({
        id: row.id,
        userId: row.uid,
        userName: row.user_name || "",
        email: row.email || "",
        departmentId: row.department_id,
        departmentName: row.department_name || "",
        departmentCode: row.department_code || null,
        jobName: row.job_name || "",
        jobCode: row.job_code || null,
        category1Score: parseFloat(row.category1_score.toString()),
        category2Score: parseFloat(row.category2_score.toString()),
        category3Score: parseFloat(row.category3_score.toString()),
        category4Score: parseFloat(row.category4_score.toString()),
        category5Score: parseFloat(row.category5_score.toString()),
        category6Score: parseFloat(row.category6_score.toString()),
        category7Score: parseFloat(row.category7_score.toString()),
        category8Score: parseFloat(row.category8_score.toString()),
        totalScore: parseFloat(row.total_score.toString()),
        responseRate: row.response_rate ? parseFloat(row.response_rate.toString()) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    })

    // Build response with survey details - only include surveys with participants
    const surveys = surveysQuery.rows
      .map((survey) => {
        const summaries = summariesBySurvey.get(survey.id) || []
        
        // Skip surveys without participants
        if (summaries.length === 0) {
          return null
        }
      
      // Calculate department aggregates
      const departmentMap = new Map<number, {
        departmentId: number
        departmentName: string
        departmentCode: string | null
        participantCount: number
        totalScoreSum: number
        category1Sum: number
        category2Sum: number
        category3Sum: number
        category4Sum: number
        category5Sum: number
        category6Sum: number
        category7Sum: number
        category8Sum: number
      }>()

      summaries.forEach((summary) => {
        if (summary.departmentId) {
          if (!departmentMap.has(summary.departmentId)) {
            departmentMap.set(summary.departmentId, {
              departmentId: summary.departmentId,
              departmentName: summary.departmentName,
              departmentCode: summary.departmentCode,
              participantCount: 0,
              totalScoreSum: 0,
              category1Sum: 0,
              category2Sum: 0,
              category3Sum: 0,
              category4Sum: 0,
              category5Sum: 0,
              category6Sum: 0,
              category7Sum: 0,
              category8Sum: 0,
            })
          }
          const dept = departmentMap.get(summary.departmentId)!
          dept.participantCount++
          dept.totalScoreSum += summary.totalScore
          dept.category1Sum += summary.category1Score
          dept.category2Sum += summary.category2Score
          dept.category3Sum += summary.category3Score
          dept.category4Sum += summary.category4Score
          dept.category5Sum += summary.category5Score
          dept.category6Sum += summary.category6Score
          dept.category7Sum += summary.category7Score
          dept.category8Sum += summary.category8Score
        }
      })

      const departments = Array.from(departmentMap.values()).map((dept) => ({
        departmentId: dept.departmentId,
        departmentName: dept.departmentName,
        departmentCode: dept.departmentCode,
        participantCount: dept.participantCount,
        averageTotalScore: dept.participantCount > 0 ? dept.totalScoreSum / dept.participantCount : 0,
        averageCategory1: dept.participantCount > 0 ? dept.category1Sum / dept.participantCount : 0,
        averageCategory2: dept.participantCount > 0 ? dept.category2Sum / dept.participantCount : 0,
        averageCategory3: dept.participantCount > 0 ? dept.category3Sum / dept.participantCount : 0,
        averageCategory4: dept.participantCount > 0 ? dept.category4Sum / dept.participantCount : 0,
        averageCategory5: dept.participantCount > 0 ? dept.category5Sum / dept.participantCount : 0,
        averageCategory6: dept.participantCount > 0 ? dept.category6Sum / dept.participantCount : 0,
        averageCategory7: dept.participantCount > 0 ? dept.category7Sum / dept.participantCount : 0,
        averageCategory8: dept.participantCount > 0 ? dept.category8Sum / dept.participantCount : 0,
      }))

      // Calculate overall averages
      const totalParticipants = summaries.length
      const overallAverage = totalParticipants > 0
        ? summaries.reduce((sum, s) => sum + s.totalScore, 0) / totalParticipants
        : 0

      return {
        surveyId: survey.id,
        surveyName: survey.name,
        startDate: survey.start_date,
        endDate: survey.end_date,
        status: survey.status,
        createdAt: survey.created_at,
        updatedAt: survey.updated_at,
        totalParticipants,
        overallAverageScore: overallAverage,
        departments,
        participants: summaries,
      }
      })
      .filter((survey) => survey !== null)

    return successResponse({ surveys })
  } catch (error) {
    return handleError(error, "全サーベイ詳細データの取得に失敗しました", "Get all surveys details")
  }
}

export const GET = withAuth(handleGet)

