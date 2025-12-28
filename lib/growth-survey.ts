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
  return array.map((item: any) => ({
    text: typeof item?.text === "string" ? item.text : "",
    score:
      typeof item?.score === "number"
        ? item.score
        : item?.score === null || item?.score === undefined
          ? null
          : Number(item.score),
  }))
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

export async function getAccessibleGrowthSurveyQuestions(
  userId: number,
  options: { activeOnly?: boolean } = {},
): Promise<GrowthSurveyQuestion[]> {
  const questions = await fetchGrowthSurveyQuestions()
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
  // Use CURRENT_DATE to handle date comparisons correctly
  // Using ::date cast ensures we compare only the date part, ignoring time components
  // end_date >= CURRENT_DATE means end_date is today or later (surveys ending today are still active)
  const result = await query<{
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
       AND start_date::date <= CURRENT_DATE
       AND end_date::date >= CURRENT_DATE
     ORDER BY created_at DESC
     LIMIT 1`,
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

/**
 * Get active organizational survey
 * Uses the same date comparison logic as getActiveGrowthSurvey and /api/surveys/period
 */
export async function getActiveOrganizationalSurvey() {
  // Use CURRENT_DATE to handle date comparisons correctly
  // Using ::date cast ensures we compare only the date part, ignoring time components
  // end_date >= CURRENT_DATE means end_date is today or later (surveys ending today are still active)
  const result = await query<{
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
       AND start_date::date <= CURRENT_DATE
       AND end_date::date >= CURRENT_DATE
     ORDER BY created_at DESC
     LIMIT 1`,
  )

  if (result.rows.length === 0) return null
  return result.rows[0]
}

