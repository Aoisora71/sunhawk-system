import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { AdminUser } from "@/lib/middleware"

/**
 * GET /api/organizational-survey-detailed-responses - Get detailed responses by employee, question, survey, department, and category
 * Query params: 
 *   - surveyIds: comma-separated list of survey IDs (required)
 *   - departmentIds: comma-separated list of department IDs (optional)
 *   - categoryId: single category ID (required)
 * 
 * Returns: For each employee in selected surveys/departments, their answers to questions in the selected category
 */
async function handleGet(request: NextRequest, user: AdminUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyIdsParam = searchParams.get("surveyIds")
    const departmentIdsParam = searchParams.get("departmentIds")
    const categoryIdParam = searchParams.get("categoryId")

    if (!surveyIdsParam) {
      return badRequestResponse("surveyIdsは必須です")
    }

    if (!categoryIdParam) {
      return badRequestResponse("categoryIdは必須です")
    }

    const surveyIds = surveyIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    const departmentIds = departmentIdsParam 
      ? departmentIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
      : []
    const categoryId = parseInt(categoryIdParam, 10)

    if (surveyIds.length === 0) {
      return badRequestResponse("有効なsurveyIdsが必要です")
    }

    if (isNaN(categoryId)) {
      return badRequestResponse("有効なcategoryIdが必要です")
    }

    // Get problems in the selected category (only single choice questions)
    const problemsResult = await query<{
      id: number
      question_text: string
      answer1_score: number
      answer2_score: number
      answer3_score: number
      answer4_score: number
      answer5_score: number
      answer6_score: number
    }>(
      `SELECT 
        id,
        question_text,
        answer1_score,
        answer2_score,
        answer3_score,
        answer4_score,
        answer5_score,
        answer6_score
      FROM problems
      WHERE category_id = $1
        AND COALESCE(question_type, 'single_choice') = 'single_choice'
      ORDER BY COALESCE(display_order, id) ASC`,
      [categoryId]
    )

    const problems = problemsResult.rows.map(row => ({
      id: Number(row.id),
      questionText: row.question_text,
      answerScores: [
        parseFloat(row.answer1_score.toString()),
        parseFloat(row.answer2_score.toString()),
        parseFloat(row.answer3_score.toString()),
        parseFloat(row.answer4_score.toString()),
        parseFloat(row.answer5_score.toString()),
        parseFloat(row.answer6_score.toString()),
      ],
    }))

    if (problems.length === 0) {
      return successResponse({
        surveyIds,
        departmentIds,
        categoryId,
        employees: [],
        problems: [],
      })
    }

    // Build WHERE clause for surveys
    const surveyPlaceholders = surveyIds.map((_, idx) => `$${idx + 1}`).join(',')
    let queryParams: any[] = [...surveyIds]
    let paramIndex = surveyIds.length + 1

    // Build WHERE clause for departments (if specified)
    let departmentFilter = ''
    let employeeQueryParams: any[] = []
    if (departmentIds.length > 0) {
      const deptPlaceholders = departmentIds.map((_, idx) => `$${idx + 1}`).join(',')
      departmentFilter = ` AND u.department_id IN (${deptPlaceholders})`
      employeeQueryParams = [...departmentIds]
    }

    // Build WHERE clause for job positions (if specified)
    const jobIdsParam = searchParams.get("jobIds")
    const jobIds = jobIdsParam 
      ? jobIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
      : []
    let jobFilter = ''
    if (jobIds.length > 0) {
      const jobPlaceholders = jobIds.map((_, idx) => `$${employeeQueryParams.length + idx + 1}`).join(',')
      jobFilter = ` AND u.job_id IN (${jobPlaceholders})`
      employeeQueryParams = [...employeeQueryParams, ...jobIds]
    }

    // Get all employees in selected departments
    const employeesResult = await query<{
      id: number
      name: string
      email: string
      department_id: number | null
      department_name: string | null
      department_code: string | null
      job_id: number | null
      job_name: string | null
    }>(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.department_id,
        d.name as department_name,
        d.code as department_code,
        u.job_id,
        j.name as job_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN jobs j ON u.job_id = j.id
      WHERE (u.role = 'employee' OR u.role = 'admin')${departmentFilter}${jobFilter}
      ORDER BY COALESCE(d.code, d.name), u.name`,
      employeeQueryParams
    )

    const employees = employeesResult.rows.map(row => ({
      id: Number(row.id),
      name: row.name,
      email: row.email,
      departmentId: row.department_id ? Number(row.department_id) : null,
      departmentName: row.department_name || null,
      departmentCode: row.department_code || null,
      jobId: row.job_id ? Number(row.job_id) : null,
      jobName: row.job_name || null,
    }))

    // Get single choice responses for selected surveys
    const responsesResult = await query<{
      uid: number
      osid: number
      response: any[]
    }>(
      `SELECT 
        uid,
        osid,
        response
      FROM organizational_survey_results
      WHERE osid = ANY($1::integer[])`,
      [surveyIds]
    )

    // Get free text responses for selected surveys
    const freeTextResponsesResult = await query<{
      uid: number
      osid: number
      qid: number
      answer_text: string
    }>(
      `SELECT 
        uid,
        osid,
        qid,
        answer_text
      FROM organizational_survey_free_text_responses
      WHERE osid = ANY($1::integer[])`,
      [surveyIds]
    )

    // Build a map: (surveyId, userId, questionId) -> answer
    const responseMap = new Map<string, { score: number | null; answerText: string | null; answerIndex: number | null }>()
    
    // Process single choice responses
    for (const row of responsesResult.rows) {
      const userId = Number(row.uid)
      const surveyId = Number(row.osid)
      let responseArray: Array<{ qid?: number; questionId?: number; s?: number; score?: number }> = []
      
      try {
        const parsed = Array.isArray(row.response) ? row.response : []
        responseArray = parsed.map((item: any) => ({
          qid: item.qid ?? item.questionId,
          s: item.s ?? item.score,
        }))
      } catch {
        continue
      }

      for (const item of responseArray) {
        const questionId = item.qid ?? item.questionId
        if (!questionId || item.s === undefined) continue
        
        const key = `${surveyId}:${userId}:${questionId}`
        // Find which answer index (1-6) corresponds to this score
        const problem = problems.find(p => p.id === questionId)
        if (problem) {
          const answerIndex = problem.answerScores.findIndex((score, idx) => Math.abs(score - item.s!) < 0.001)
          responseMap.set(key, {
            score: item.s,
            answerText: null,
            answerIndex: answerIndex >= 0 ? answerIndex + 1 : null,
          })
        }
      }
    }

    // Process free text responses
    for (const row of freeTextResponsesResult.rows) {
      const userId = Number(row.uid)
      const surveyId = Number(row.osid)
      const questionId = Number(row.qid)
      const key = `${surveyId}:${userId}:${questionId}`
      responseMap.set(key, {
        score: null,
        answerText: row.answer_text,
        answerIndex: null,
      })
    }

    // Build response data structure
    const employeeResponses = employees.map(employee => {
      const surveyResponses = surveyIds.map(surveyId => {
        const questionResponses = problems.map(problem => {
          const key = `${surveyId}:${employee.id}:${problem.id}`
          const response = responseMap.get(key)
          
          return {
            questionId: problem.id,
            questionText: problem.questionText,
            score: response?.score ?? null,
            answerText: response?.answerText ?? null,
            answerIndex: response?.answerIndex ?? null, // 1-6 for single choice
          }
        })

        return {
          surveyId,
          questions: questionResponses,
        }
      })

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        departmentId: employee.departmentId,
        departmentName: employee.departmentName,
        departmentCode: employee.departmentCode,
        jobId: employee.jobId,
        jobName: employee.jobName,
        surveys: surveyResponses,
      }
    })

    return successResponse({
      surveyIds,
      departmentIds,
      jobIds: jobIds.length > 0 ? jobIds : undefined,
      categoryId,
      employees: employeeResponses,
      problems: problems.map(p => ({
        id: p.id,
        questionText: p.questionText,
      })),
    })
  } catch (error) {
    return handleError(error, "詳細回答データの取得に失敗しました", "Get organizational survey detailed responses")
  }
}

export const GET = withAdmin(handleGet)

