import { query } from "@/lib/db"
import type { GrowthSurveyQuestion } from "@/lib/types"
import { filterGrowthSurveyQuestionsByJob } from "@/lib/growth-survey-utils"

export async function growthSurveyQuestionsTableExists(): Promise<boolean> {
  const result = await query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'growth_survey_questions'
    )`,
  )
  return Boolean(result.rows[0]?.exists)
}

function parseJsonArray<T = any>(value: any): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value as T[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function mapAnswers(value: any): GrowthSurveyQuestion["answers"] {
  const array = parseJsonArray(value)
  return array.map((item: any) => {
    // Handle skip field - can be boolean true, string "true", or number 1
    let skipValue = false
    if (item?.skip !== undefined && item?.skip !== null) {
      if (typeof item.skip === "boolean") {
        skipValue = item.skip
      } else if (typeof item.skip === "string") {
        skipValue = item.skip.toLowerCase() === "true" || item.skip === "1"
      } else if (typeof item.skip === "number") {
        skipValue = item.skip === 1
      }
    }
    
    return {
    text: typeof item?.text === "string" ? item.text : "",
    score:
      typeof item?.score === "number"
        ? item.score
        : item?.score === null || item?.score === undefined
          ? null
          : Number(item.score),
      skip: skipValue,
    }
  })
}

function mapTargetJobs(value: any): string[] {
  return parseJsonArray<string>(value).filter((job) => typeof job === "string" && job.length > 0)
}

export async function fetchGrowthSurveyQuestions(): Promise<GrowthSurveyQuestion[]> {
  if (!(await growthSurveyQuestionsTableExists())) {
    return []
  }

  const result = await query(
    `SELECT 
      id,
      question_text,
      category,
      weight,
      target_jobs,
      answers,
      focus_area,
      answer_type,
      COALESCE(question_type, 'single_choice') as question_type,
      is_active,
      COALESCE(display_order, id) as display_order,
      created_at,
      updated_at
     FROM growth_survey_questions
     ORDER BY COALESCE(display_order, id) ASC`,
  )

  return result.rows.map((row) => ({
    id: Number(row.id),
    questionText: row.question_text,
    category: row.category ?? "",
    weight: row.weight !== null && row.weight !== undefined ? row.weight : null,
    targetJobs: mapTargetJobs(row.target_jobs),
    answers: mapAnswers(row.answers),
    focusArea: row.focus_area ?? "",
    answerType: row.answer_type ?? "scale",
    questionType: (row.question_type || 'single_choice') as 'single_choice' | 'free_text',
    isActive: Boolean(row.is_active),
    displayOrder: Number(row.display_order) || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function getUserJobName(userId: number): Promise<string | null> {
  const result = await query<{ job_name: string | null }>(
    `SELECT j.name as job_name
     FROM users u
     LEFT JOIN jobs j ON j.id = u.job_id
     WHERE u.id = $1`,
    [userId],
  )
  return result.rows[0]?.job_name ?? null
}

export async function getUserRole(userId: number): Promise<string | null> {
  const result = await query<{ role: string | null }>(
    `SELECT role FROM users WHERE id = $1`,
    [userId],
  )
  return result.rows[0]?.role ?? null
}

export async function getAccessibleGrowthSurveyQuestions(
  userId: number,
  options: { activeOnly?: boolean } = {},
): Promise<GrowthSurveyQuestion[]> {
  const questions = await fetchGrowthSurveyQuestions()
  const userRole = await getUserRole(userId)
  
  // Admin users can access all questions regardless of targetJobs
  if (userRole === 'admin') {
    const { activeOnly = false } = options
    if (activeOnly) {
      return questions.filter((question) => question.isActive)
    }
    return questions
  }
  
  const jobName = await getUserJobName(userId)
  return filterGrowthSurveyQuestionsByJob(questions, jobName, options)
}

export async function getAccessibleGrowthSurveyQuestionCount(
  userId: number,
  options: { activeOnly?: boolean } = {},
): Promise<number> {
  const questions = await getAccessibleGrowthSurveyQuestions(userId, options)
  return questions.length
}

export async function getGrowthSurveyQuestionForUser(
  userId: number,
  questionId: number,
): Promise<GrowthSurveyQuestion | null> {
  const questions = await getAccessibleGrowthSurveyQuestions(userId, { activeOnly: true })
  return questions.find((question) => question.id === questionId) ?? null
}

export async function getActiveGrowthSurvey() {
  // Check if running column exists
  const columnCheck = await query<{ column_name: string }>(
    `SELECT column_name 
     FROM information_schema.columns 
     WHERE table_name = 'surveys' 
       AND column_name = 'running'`
  )
  const hasRunning = columnCheck.rows.some(r => r.column_name === 'running')
  
  // Only allow participation in surveys with running = true
  // Do not check date range - only running = true surveys are available for participation
  if (hasRunning) {
    // Only look for running = true surveys (no date check, no fallback to date range)
    const runningResult = await query<{
      id: number
      name: string
      start_date: string
      end_date: string
      status: string
      survey_type: string | null
    }>(
      `SELECT id, name, start_date, end_date, status, survey_type
       FROM surveys
       WHERE status = 'active'
         AND survey_type = 'growth'
         AND running = true
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    
    if (runningResult.rows.length > 0) {
      return runningResult.rows[0]
    }
  }
  
  // If no running = true survey found, return null (do not check date range)
  return null
}

/**
 * Get active organizational survey
 * Only allows participation in surveys with running = true
 * Do not check date range - only running = true surveys are available for participation
 */
export async function getActiveOrganizationalSurvey() {
  // Check if running column exists
  const columnCheck = await query<{ column_name: string }>(
    `SELECT column_name 
     FROM information_schema.columns 
     WHERE table_name = 'surveys' 
       AND column_name = 'running'`
  )
  const hasRunning = columnCheck.rows.some(r => r.column_name === 'running')
  
  // Only allow participation in surveys with running = true
  // Do not check date range - only running = true surveys are available for participation
  if (hasRunning) {
    // Only look for running = true surveys (no date check, no fallback to date range)
    const runningResult = await query<{
      id: number
      name: string
      start_date: string
      end_date: string
      status: string
      survey_type: string | null
    }>(
      `SELECT id, name, start_date, end_date, status, survey_type
       FROM surveys
       WHERE status = 'active'
         AND survey_type = 'organizational'
         AND running = true
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    
    if (runningResult.rows.length > 0) {
      return runningResult.rows[0]
    }
  }
  
  // If no running = true survey found, return null (do not check date range)
  return null
}

