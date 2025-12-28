import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api-errors"
import type { AuthenticatedUser } from "@/lib/middleware"
import { getActiveGrowthSurvey } from "@/lib/growth-survey"

/**
 * GET /api/growth-survey-category-scores - Get category scores for growth survey
 * Query params: surveyId (optional) - If provided, get scores for that survey. Otherwise, get active survey.
 * Returns the sum of total_score for each category based on survey results only
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyIdParam = searchParams.get("surveyId")
    
    let targetSurveyId: number | null = null
    
    // Initialize category scores with 0 (no additional/bonus points)
    const categoryScores: Record<string, number> = {
      "ルール": 0,
      "組織体制": 0,
      "評価制度": 0,
      "週報・会議": 0,
      "識学サーベイ": 1.5, // Base score for 識学サーベイ (calculated from organizational survey)
    }

    if (surveyIdParam) {
      targetSurveyId = parseInt(surveyIdParam, 10)
      if (Number.isNaN(targetSurveyId)) {
                // Return zero scores if surveyId is invalid
        return successResponse({ categories: categoryScores })
      }
          } else {
      const activeSurvey = await getActiveGrowthSurvey()
      if (!activeSurvey) {
                // Return zero scores if no active survey
        return successResponse({ categories: categoryScores })
      }
      targetSurveyId = activeSurvey.id
          }

    // Check which columns exist to support both old and new column names
    const columnCheck = await query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'growth_survey_responses' 
         AND column_name IN ('gqid', 'question_id', 'gsid', 'survey_id', 'cid', 'category')`
    )
    const hasNewColumns = columnCheck.rows.some(r => r.column_name === 'gqid')
    const surveyColumn = hasNewColumns ? 'gsid' : 'survey_id'
    const categoryColumn = columnCheck.rows.some(r => r.column_name === 'cid') ? 'cid' : 'category'

    // Get total_score sum grouped by category
        const result = await query<{
      category: string
      total_sum: number
    }>(
      `SELECT 
         ${categoryColumn} as category,
         COALESCE(SUM(total_score), 0) as total_sum
       FROM growth_survey_responses
       WHERE ${surveyColumn} = $1
         AND ${categoryColumn} IS NOT NULL
       GROUP BY ${categoryColumn}`,
      [targetSurveyId],
    )

    // Set category scores based on survey results only (no bonus points added)
    result.rows.forEach((row) => {
      const category = row.category
      if (category) {
        // Handle both "週報・会議" and "主保・会議"
        const normalizedCategory = category === "主保・会議" ? "週報・会議" : category
        if (categoryScores.hasOwnProperty(normalizedCategory)) {
          categoryScores[normalizedCategory] = Number(row.total_sum) || 0
        } else {
          // If category doesn't exist in initialized scores, add it
          categoryScores[normalizedCategory] = Number(row.total_sum) || 0
        }
      }
    })

    // Calculate 識学サーベイ score based on organizational survey statistics
    try {
      // Get the current active organizational survey
      const orgSurveyQuery = await query<{ id: number }>(
        `SELECT id FROM surveys 
         WHERE survey_type = 'organizational' 
           AND start_date <= CURRENT_DATE 
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         ORDER BY start_date DESC, created_at DESC
         LIMIT 1`
      )

      if (orgSurveyQuery.rows.length > 0) {
        const orgSurveyId = orgSurveyQuery.rows[0].id

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
        }>(overallQuery, [orgSurveyId])

        // Get manager statistics (jobs.code in ('1', '2', '3'))
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
        }>(managerQuery, [orgSurveyId])

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

        const overallAvgTotal = parseFloat(overall.avg_total.toString())
        const overallAvgCategory1 = parseFloat(overall.avg_category1.toString())
        const overallAvgCategory7 = parseFloat(overall.avg_category7.toString())
        const managerAvgTotal = parseFloat(manager.avg_total.toString())
        const managerAvgCategory1 = parseFloat(manager.avg_category1.toString())
        const managerAvgCategory7 = parseFloat(manager.avg_category7.toString())

        let shikigakuScore = 1.5 // Base score

        // Condition 1: 全体職員総平均60以上、かつ組織内位置認識・自己評価意識が両方とも60以上 → 1点
        if (overallAvgTotal >= 60 && overallAvgCategory1 >= 60 && overallAvgCategory7 >= 60) {
          shikigakuScore += 1.0
        }

        // Condition 2: 全体職員総平均65以上、かつ組織内位置認識・自己評価意識が両方とも65以上 → 1点
        if (overallAvgTotal >= 65 && overallAvgCategory1 >= 65 && overallAvgCategory7 >= 65) {
          shikigakuScore += 1.0
        }

        // Condition 3: 管理職の平均総点数65以上、かつ組織内位置認識・自己評価意識が両方とも65以上 → 1点
        if (managerAvgTotal >= 65 && managerAvgCategory1 >= 65 && managerAvgCategory7 >= 65) {
          shikigakuScore += 1.0
        }

        // Condition 4: 管理職の平均総点数65以上、かつ組織内位置認識・自己評価意識が両方とも65以上 → 1点
        // (Same as condition 3, but user requested it separately, so we add it again)
        if (managerAvgTotal >= 65 && managerAvgCategory1 >= 65 && managerAvgCategory7 >= 65) {
          shikigakuScore += 1.0
        }

        // Condition 5: 全体職員総平均70以上、管理職の合計80以上、かつ全体職員の組織内位置認識・自己評価意識の合計平均70以上 → 0.5点
        const overallAvgCategory1And7 = (overallAvgCategory1 + overallAvgCategory7) / 2
        if (overallAvgTotal >= 70 && managerAvgTotal >= 80 && overallAvgCategory1And7 >= 70) {
          shikigakuScore += 0.5
        }

        // Cap at 6.0 (maximum score)
        shikigakuScore = Math.min(shikigakuScore, 6.0)

        categoryScores["識学サーベイ"] = shikigakuScore
      } else {
        // Keep base score of 1.5 if conditions not met
      }
    } catch (error) {
      // Keep base score of 1.5 on error
    }

    return successResponse({ categories: categoryScores })
  } catch (error) {
    return handleError(error, "グロースサーベイカテゴリスコアの取得に失敗しました", "Get growth survey category scores")
  }
}

export const GET = withAuth(handleGet)

