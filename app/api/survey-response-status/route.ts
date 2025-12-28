import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"
import { parseFloatSafe } from "@/lib/db-helpers"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { AdminUser } from "@/lib/middleware"
import { getAccessibleGrowthSurveyQuestionCount, getUserJobName, fetchGrowthSurveyQuestions } from "@/lib/growth-survey"

/**
 * GET /api/survey-response-status - Get employee response status for a survey
 * Query params: surveyId (required) - Survey ID to check
 */
async function handleGet(request: NextRequest, user: AdminUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyIdParam = searchParams.get("surveyId")

    if (!surveyIdParam) {
      return badRequestResponse("surveyIdは必須です")
    }

    // Parse surveyId as integer
    const surveyId = parseInt(surveyIdParam, 10)
    if (isNaN(surveyId)) {
      return badRequestResponse("無効なsurveyIdです")
    }

    // Get survey type
    const surveyResult = await query<{
      survey_type: string
    }>(
      `SELECT survey_type FROM surveys WHERE id = $1`,
      [surveyId]
    )

    if (surveyResult.rows.length === 0) {
      return badRequestResponse("サーベイが見つかりません")
    }

    const surveyType = surveyResult.rows[0].survey_type === 'growth' ? 'growth' : 'organizational'

    // Get all employees
    const employeesResult = await query<{
      id: number
      name: string
      email: string
      department_id: number | null
      job_id: number | null
      role: string
    }>(
      `SELECT id, name, email, department_id, job_id, role
       FROM users
       WHERE role = 'employee' OR role = 'admin'
       ORDER BY name`
    )

    // Create a map of user_id -> response data
    const responseMap = new Map<number, { 
      responseRate: number; 
      createdAt: string; 
      updatedAt: string 
    }>()

    if (surveyType === 'organizational') {
      // ===== ORGANIZATIONAL SURVEY =====
      
      // Get single choice responses
      const singleChoiceResponsesResult = await query<{
        uid: number
        response: any[]
        created_at: string
        updated_at: string
      }>(
        `SELECT uid, response, created_at, updated_at
       FROM organizational_survey_results
         WHERE osid = $1`,
        [surveyId]
      )
      
      // Get free text responses
      const freeTextResponsesResult = await query<{
          uid: number
        qid: number
      }>(
        `SELECT DISTINCT uid, qid
         FROM organizational_survey_free_text_responses
         WHERE osid = $1`,
        [surveyId]
      )

      // Get total problems count (including free text questions)
      const totalProblemsResult = await query<{ count: number }>(
        "SELECT COUNT(*) as count FROM problems"
      )
      const totalProblems = totalProblemsResult.rows[0]?.count || 0

      console.log(`[Survey Response Status] Organizational Survey ${surveyId}: Total problems = ${totalProblems}`)

      // Create a map of user_id -> free text question IDs answered
      const freeTextAnswersMap = new Map<number, Set<number>>()
      for (const row of freeTextResponsesResult.rows) {
        if (!freeTextAnswersMap.has(row.uid)) {
          freeTextAnswersMap.set(row.uid, new Set())
        }
        freeTextAnswersMap.get(row.uid)!.add(row.qid)
      }

      // Process single choice responses and calculate response rate including free text
      for (const row of singleChoiceResponsesResult.rows) {
        const singleChoiceCount = Array.isArray(row.response) ? row.response.length : 0
        const freeTextCount = freeTextAnswersMap.get(row.uid)?.size || 0
        const totalAnsweredCount = singleChoiceCount + freeTextCount

        let responseRate = 0.0
        if (totalAnsweredCount > 0 && totalProblems > 0) {
          responseRate = Math.round((totalAnsweredCount / totalProblems) * 100 * 100) / 100
          if (responseRate > 100) responseRate = 100.0
        }

        responseMap.set(row.uid, {
          responseRate: responseRate,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
    }

      // Also include users who only answered free text questions (no single choice responses)
      for (const [uid, qids] of freeTextAnswersMap.entries()) {
        if (!responseMap.has(uid)) {
          const freeTextCount = qids.size
          let responseRate = 0.0
          if (freeTextCount > 0 && totalProblems > 0) {
            responseRate = Math.round((freeTextCount / totalProblems) * 100 * 100) / 100
            if (responseRate > 100) responseRate = 100.0
          }

          // Get created_at/updated_at from free text responses
          const latestFreeTextResult = await query<{
            created_at: string
            updated_at: string
          }>(
            `SELECT MAX(created_at) as created_at, MAX(updated_at) as updated_at
             FROM organizational_survey_free_text_responses
             WHERE osid = $1 AND uid = $2`,
            [surveyId, uid]
          )

          const latestRow = latestFreeTextResult.rows[0]
          responseMap.set(uid, {
            responseRate: responseRate,
            createdAt: latestRow?.created_at || new Date().toISOString(),
            updatedAt: latestRow?.updated_at || new Date().toISOString(),
          })
        }
      }

    } else {
      // ===== GROWTH SURVEY =====
      
      // Check which columns exist
      const columnCheck = await query<{ column_name: string }>(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = 'growth_survey_responses' 
           AND column_name IN ('gqid', 'question_id', 'gsid', 'survey_id')`
      )
      const hasNewColumns = columnCheck.rows.some(r => r.column_name === 'gqid')
      const questionColumn = hasNewColumns ? 'gqid' : 'question_id'
      const surveyColumn = hasNewColumns ? 'gsid' : 'survey_id'

      // Get all responses for this survey
      const growthResponsesResult = await query<{
        result: any[]
        created_at: string
        updated_at: string
      }>(
        `SELECT result, MIN(created_at) as created_at, MAX(updated_at) as updated_at
         FROM growth_survey_responses
         WHERE ${surveyColumn} = $1
         GROUP BY result`,
        [surveyId]
      )

      // Get all growth survey questions (active only, for calculating total)
      const allQuestions = await fetchGrowthSurveyQuestions()
      const activeQuestions = allQuestions.filter(q => q.isActive)

      // Get user responses grouped by user
      const userResponsesMap = new Map<number, {
        answeredCount: number
        createdAt: string
      updatedAt: string 
    }>()
    
      // Process responses to count answered questions per user
      for (const row of growthResponsesResult.rows) {
        if (!row.result || !Array.isArray(row.result)) continue

        // Extract unique user IDs from result array
        const userIds = new Set<number>()
        for (const item of row.result) {
          const uid = item.uid || item.employeeId
          if (uid) userIds.add(Number(uid))
        }

        // For each user, count how many questions they answered
        for (const userId of userIds) {
          if (!userResponsesMap.has(userId)) {
            userResponsesMap.set(userId, {
              answeredCount: 0,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            })
          }

          // Count distinct questions answered by this user
          const userAnsweredQuestions = new Set<number>()
          for (const item of row.result) {
            const itemUid = item.uid || item.employeeId
            if (itemUid && Number(itemUid) === userId && item.gqid) {
              userAnsweredQuestions.add(item.gqid)
            }
          }

          // Update answered count (this is per-response-row, so we need to aggregate properly)
          const current = userResponsesMap.get(userId)!
          current.answeredCount = Math.max(current.answeredCount, userAnsweredQuestions.size)
        }
      }

      // Get user job names in batch
      const userIds = employeesResult.rows.map(e => e.id)
      const userJobsResult = await query<{
        id: number
        job_name: string | null
      }>(
        `SELECT u.id, j.name as job_name
         FROM users u
         LEFT JOIN jobs j ON u.job_id = j.id
         WHERE u.id = ANY($1::integer[])`,
        [userIds]
      )
      const userJobMap = new Map<number, string | null>()
      for (const row of userJobsResult.rows) {
        userJobMap.set(row.id, row.job_name)
      }

      // Count answered questions per user
      // Important: Each row in growth_survey_responses represents one question,
      // and the result array contains responses from multiple users.
      // We need to count distinct question IDs per user, not per result array element.
      const userResponseCountsResult = await query<{
        uid: number
        answered_count: number
      }>(
        `SELECT 
           (elem->>'uid')::integer as uid,
           COUNT(DISTINCT gsr.${questionColumn}) as answered_count
         FROM growth_survey_responses gsr,
              jsonb_array_elements(gsr.result) AS elem
         WHERE gsr.${surveyColumn} = $1
           AND (elem->>'uid') IS NOT NULL
           AND ((elem->>'uid')::integer IS NOT NULL OR (elem->>'employeeId')::integer IS NOT NULL)
         GROUP BY (elem->>'uid')::integer`,
        [surveyId]
      )

      // Get latest timestamps per user
      const userTimestampsResult = await query<{
        uid: number
        created_at: string
        updated_at: string
      }>(
        `SELECT 
           (elem->>'uid')::integer as uid,
           MIN(gsr.created_at) as created_at,
           MAX(gsr.updated_at) as updated_at
         FROM growth_survey_responses gsr,
              jsonb_array_elements(gsr.result) AS elem
         WHERE gsr.${surveyColumn} = $1
           AND (elem->>'uid') IS NOT NULL
         GROUP BY (elem->>'uid')::integer`,
        [surveyId]
      )

      const userResponseCountsMap = new Map<number, number>()
      for (const row of userResponseCountsResult.rows) {
        userResponseCountsMap.set(row.uid, row.answered_count)
      }

      const userTimestampsMap = new Map<number, { createdAt: string; updatedAt: string }>()
      for (const row of userTimestampsResult.rows) {
        userTimestampsMap.set(row.uid, {
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
      }

      // Calculate response rate for each user based on their accessible questions
      for (const employee of employeesResult.rows) {
        const answeredCount = userResponseCountsMap.get(employee.id) || 0
        const timestamps = userTimestampsMap.get(employee.id)
        
        if (answeredCount > 0 || timestamps) {
          const jobName = userJobMap.get(employee.id) || null
          const accessibleQuestions = activeQuestions.filter(q => {
            if (!q.isActive) return false
            if (q.targetJobs.length > 0) {
              if (!jobName || !q.targetJobs.includes(jobName)) {
                return false
              }
            }
            return true
          })
          const totalAccessibleQuestions = accessibleQuestions.length

          let responseRate = 0.0
          if (answeredCount > 0 && totalAccessibleQuestions > 0) {
            responseRate = Math.round((answeredCount / totalAccessibleQuestions) * 100 * 100) / 100
            if (responseRate > 100) responseRate = 100.0
          }

          responseMap.set(employee.id, {
            responseRate: responseRate,
            createdAt: timestamps?.createdAt || new Date().toISOString(),
            updatedAt: timestamps?.updatedAt || new Date().toISOString(),
          })
        }
      }
    }
    
    console.log(`[Survey Response Status] Response map populated with ${responseMap.size} entries`)

    // Get department and job names
    const departmentsResult = await query<{ id: number; name: string }>(
      "SELECT id, name FROM departments"
    )
    const jobsResult = await query<{ id: number; name: string }>("SELECT id, name FROM jobs")

    const departmentsMap = new Map<number, string>()
    for (const dept of departmentsResult.rows) {
      departmentsMap.set(dept.id, dept.name)
    }

    const jobsMap = new Map<number, string>()
    for (const job of jobsResult.rows) {
      jobsMap.set(job.id, job.name)
    }

    // Combine employee data with response status
    const employeeStatuses = employeesResult.rows.map((emp) => {
      const response = responseMap.get(emp.id)
      const responseRate = response?.responseRate ?? 0.0
      
      // Debug logging
      if (response) {
        console.log(`[Survey Response Status] Employee ${emp.id} (${emp.name}): responseRate=${responseRate}, status calculation...`)
      } else {
        console.log(`[Survey Response Status] Employee ${emp.id} (${emp.name}): NO RESPONSE DATA FOUND in responseMap`)
      }
      
      // Determine status based on response rate
      // 0 or not in table = "Not Responded" (red)
      // 1-99.99 = "Responding" (yellow)
      // 100+ = "Responded" (green)
      let status: "not_responded" | "responding" | "responded"
      if (!response) {
        // User not found in organizational_survey_results table
        status = "not_responded"
      } else if (responseRate >= 100) {
        status = "responded"
      } else if (responseRate > 0) {
        status = "responding"
      } else {
        // responseRate === 0 but user exists in table
        status = "not_responded"
      }
      
      // Debug logging
      console.log(`[Survey Response Status] Employee ${emp.id} (${emp.name}): final status=${status}, responseRate=${responseRate}, hasResponse=${!!response}`)

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        departmentId: emp.department_id,
        departmentName: emp.department_id ? departmentsMap.get(emp.department_id) || "-" : "-",
        jobId: emp.job_id,
        jobName: emp.job_id ? jobsMap.get(emp.job_id) || "-" : "-",
        role: emp.role,
        responseRate: responseRate,
        status: status,
        respondedAt: response?.updatedAt || null,
      }
    })

    return successResponse({
      employees: employeeStatuses,
      totalEmployees: employeeStatuses.length,
      respondedCount: employeeStatuses.filter((e) => e.status === "responded").length,
      respondingCount: employeeStatuses.filter((e) => e.status === "responding").length,
      notRespondedCount: employeeStatuses.filter((e) => e.status === "not_responded").length,
    })
  } catch (error) {
    return handleError(error, "回答状況の取得に失敗しました", "Get survey response status")
  }
}

export const GET = withAdmin(handleGet)

