import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"
import type { AdminUser } from "@/lib/middleware"
import { fetchGrowthSurveyQuestions } from "@/lib/growth-survey"
import { getGrowthSurveyOptions } from "@/lib/growth-survey-utils"

/**
 * GET /api/growth-survey-detailed-responses
 * Query params: surveyIds (comma), departmentIds (comma, optional), jobIds (comma, optional)
 * Returns: questions (display_order), surveys, and rows (employee × survey) with answer text per question
 */
async function handleGet(request: NextRequest, user: AdminUser) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyIdsParam = searchParams.get("surveyIds")
    const departmentIdsParam = searchParams.get("departmentIds")
    const jobIdsParam = searchParams.get("jobIds")

    if (!surveyIdsParam) {
      return badRequestResponse("surveyIdsは必須です")
    }

    const surveyIds = surveyIdsParam.split(",").map((id) => parseInt(id.trim(), 10)).filter((id) => !Number.isNaN(id))
    const departmentIds = departmentIdsParam
      ? departmentIdsParam.split(",").map((id) => parseInt(id.trim(), 10)).filter((id) => !Number.isNaN(id))
      : []
    const jobIds = jobIdsParam
      ? jobIdsParam.split(",").map((id) => parseInt(id.trim(), 10)).filter((id) => !Number.isNaN(id))
      : []

    if (surveyIds.length === 0) {
      return badRequestResponse("有効なsurveyIdsが必要です")
    }

    // Questions in display_order (all active: single_choice and free_text)
    const allQuestions = await fetchGrowthSurveyQuestions()
    const questions = allQuestions.filter((q) => q.isActive).map((q) => {
      const options = getGrowthSurveyOptions(q)
      const answersTexts = options.length > 0
        ? options.map((o) => o.label)
        : q.questionType === "free_text" || q.answerType === "text"
          ? ["(自由記述)"]
          : []
      return {
        id: q.id,
        questionText: q.questionText,
        questionType: (q.questionType || "single_choice") as "single_choice" | "free_text",
        answersTexts,
      }
    })

    // Survey names
    const surveysResult = await query<{ id: number; name: string }>(
      `SELECT id, name FROM surveys WHERE id = ANY($1::integer[]) ORDER BY id`,
      [surveyIds],
    )
    const surveys = surveysResult.rows.map((r) => ({ id: Number(r.id), name: r.name }))

    // Employees filter (same param pattern as organizational-survey-detailed-responses)
    let departmentFilter = ""
    let jobFilter = ""
    const employeeParams: number[] = []
    if (departmentIds.length > 0) {
      const deptPlaceholders = departmentIds.map((_, i) => `$${i + 1}`).join(",")
      departmentFilter = ` AND u.department_id IN (${deptPlaceholders})`
      employeeParams.push(...departmentIds)
    }
    if (jobIds.length > 0) {
      const jobPlaceholders = jobIds.map((_, i) => `$${employeeParams.length + i + 1}`).join(",")
      jobFilter = ` AND u.job_id IN (${jobPlaceholders})`
      employeeParams.push(...jobIds)
    }

    const employeesResult = await query<{
      id: number
      name: string
      department_id: number | null
      department_name: string | null
      job_id: number | null
      job_name: string | null
    }>(
      `SELECT u.id, u.name, u.department_id, d.name as department_name, u.job_id, j.name as job_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN jobs j ON u.job_id = j.id
       WHERE (u.role = 'employee' OR u.role = 'admin')${departmentFilter}${jobFilter}
       ORDER BY COALESCE(d.name, ''), COALESCE(j.name, ''), u.name`,
      employeeParams,
    )
    const employees = employeesResult.rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      departmentName: r.department_name ?? "",
      jobName: r.job_name ?? "",
    }))

    // Column names for growth_survey_responses
    const columnCheck = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'growth_survey_responses'
         AND column_name IN ('gqid', 'question_id', 'gsid', 'survey_id')`,
    )
    const hasNewColumns = columnCheck.rows.some((r) => r.column_name === "gqid")
    const questionCol = hasNewColumns ? "gqid" : "question_id"
    const surveyCol = hasNewColumns ? "gsid" : "survey_id"

    // All responses for selected surveys (single choice + free text placeholder)
    const responsesResult = await query<{ gqid: number; gsid: number; result: unknown }>(
      `SELECT ${questionCol} as gqid, ${surveyCol} as gsid, result
       FROM growth_survey_responses
       WHERE ${surveyCol} = ANY($1::integer[])`,
      [surveyIds],
    )

    // Free text responses
    const freeTextResult = await query<{ uid: number; gsid: number; gqid: number; answer_text: string }>(
      `SELECT uid, gsid, gqid, answer_text
       FROM growth_survey_free_text_responses
       WHERE gsid = ANY($1::integer[])`,
      [surveyIds],
    )

    // Map (surveyId, userId, questionId) -> answerText
    const answerMap = new Map<string, string>()

    for (const row of responsesResult.rows) {
      const surveyId = Number(row.gsid)
      const questionId = Number(row.gqid)
      const q = questions.find((qu) => qu.id === questionId)
      if (!q) continue

      let arr: Array<{ uid: number; s: number | null }> = []
      try {
        const raw = row.result
        const parsed = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : []
        arr = parsed.map((e: { uid?: number; employeeId?: number; s?: number | null; score?: number | null }) => ({
          uid: e.uid ?? e.employeeId ?? 0,
          s: e.s ?? e.score ?? null,
        }))
      } catch {
        continue
      }

      for (const entry of arr) {
        const uid = entry.uid
        if (!uid) continue
        const key = `${surveyId}:${uid}:${questionId}`
        if (q.questionType === "free_text" || q.answersTexts[0] === "(自由記述)") {
          // Free text: will be filled from free_text table
          if (!answerMap.has(key)) answerMap.set(key, "")
        } else {
          // Single choice: match score to option label
          const options = getGrowthSurveyOptions(allQuestions.find((x) => x.id === questionId)!)
          const opt = options.find((o) => o.score != null && Math.abs((o.score ?? 0) - (entry.s ?? 0)) < 0.001)
          answerMap.set(key, opt ? opt.label : entry.s === null ? "スキップ" : String(entry.s))
        }
      }
    }

    for (const row of freeTextResult.rows) {
      const key = `${row.gsid}:${row.uid}:${row.gqid}`
      answerMap.set(key, row.answer_text ?? "")
    }

    // Build rows: one per (employee, survey)
    const rows: Array<{
      rowNumber: number
      employeeId: number
      employeeName: string
      departmentName: string
      jobName: string
      surveyId: number
      surveyName: string
      answers: Record<number, string>
    }> = []
    let rowNumber = 0
    for (const emp of employees) {
      for (const survey of surveys) {
        rowNumber++
        const answers: Record<number, string> = {}
        for (const q of questions) {
          const key = `${survey.id}:${emp.id}:${q.id}`
          answers[q.id] = answerMap.get(key) ?? ""
        }
        rows.push({
          rowNumber,
          employeeId: emp.id,
          employeeName: emp.name,
          departmentName: emp.departmentName,
          jobName: emp.jobName,
          surveyId: survey.id,
          surveyName: survey.name,
          answers,
        })
      }
    }

    return successResponse({
      questions,
      surveys,
      employees,
      rows,
    })
  } catch (error) {
    return handleError(error, "グロースサーベイ詳細回答の取得に失敗しました", "Get growth survey detailed responses")
  }
}

export const GET = withAdmin(handleGet)
