import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/organizational-survey-summary/statistics - Get organizational survey statistics
 * Query params: surveyId (required) - Filter by survey ID
 * Returns: overall averages and manager averages for calculating 識学サーベイ score
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")

    if (!surveyId) {
      return successResponse({
        overallAverageTotal: 0,
        overallAverageCategory1: 0,
        overallAverageCategory7: 0,
        managerAverageTotal: 0,
        managerAverageCategory1: 0,
        managerAverageCategory7: 0,
        overallCount: 0,
        managerCount: 0,
      })
    }

    // Admin only
    if (user.role !== "admin") {
      return successResponse({
        overallAverageTotal: 0,
        overallAverageCategory1: 0,
        overallAverageCategory7: 0,
        managerAverageTotal: 0,
        managerAverageCategory1: 0,
        managerAverageCategory7: 0,
        overallCount: 0,
        managerCount: 0,
      })
    }

    // Get overall statistics (all employees)
    const overallQuery = `
      SELECT 
        COALESCE(AVG(oss.total_score), 0) as avg_total,
        COALESCE(AVG(oss.category1_score), 0) as avg_category1,
        COALESCE(AVG(oss.category7_score), 0) as avg_category7,
        COUNT(*) as count
      FROM organizational_survey_summary oss
      WHERE oss.osid = $1
    `

    const overallResult = await query<{
      avg_total: number
      avg_category1: number
      avg_category7: number
      count: number
    }>(overallQuery, [surveyId])

    // Get manager statistics (jobs.code in (1, 2, 3))
    const managerQuery = `
      SELECT 
        COALESCE(AVG(oss.total_score), 0) as avg_total,
        COALESCE(AVG(oss.category1_score), 0) as avg_category1,
        COALESCE(AVG(oss.category7_score), 0) as avg_category7,
        COUNT(*) as count
      FROM organizational_survey_summary oss
      LEFT JOIN users u ON oss.uid = u.id
      LEFT JOIN jobs j ON u.job_id = j.id
      WHERE oss.osid = $1
        AND j.code IN ('1', '2', '3')
    `

    const managerResult = await query<{
      avg_total: number
      avg_category1: number
      avg_category7: number
      count: number
    }>(managerQuery, [surveyId])

    const overall = overallResult.rows[0] || {
      avg_total: 0,
      avg_category1: 0,
      avg_category7: 0,
      count: 0,
    }

    const manager = managerResult.rows[0] || {
      avg_total: 0,
      avg_category1: 0,
      avg_category7: 0,
      count: 0,
    }

    return successResponse({
      overallAverageTotal: parseFloat(overall.avg_total.toString()),
      overallAverageCategory1: parseFloat(overall.avg_category1.toString()),
      overallAverageCategory7: parseFloat(overall.avg_category7.toString()),
      managerAverageTotal: parseFloat(manager.avg_total.toString()),
      managerAverageCategory1: parseFloat(manager.avg_category1.toString()),
      managerAverageCategory7: parseFloat(manager.avg_category7.toString()),
      overallCount: Number(overall.count),
      managerCount: Number(manager.count),
    })
  } catch (error) {
    return handleError(error, "ソシキサーベイ統計の取得に失敗しました", "Get organizational survey statistics")
  }
}

export const GET = withAuth(handleGet)

