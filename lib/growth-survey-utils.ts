import type { GrowthSurveyQuestion } from "@/lib/types"
import { DEFAULT_GROWTH_SURVEY_SCALE_OPTIONS } from "@/lib/growth-survey-options"

export interface GrowthSurveyOption {
  value: string
  label: string
  score: number | null
}

export function getGrowthSurveyOptions(question: GrowthSurveyQuestion): GrowthSurveyOption[] {
  if (!question) return []

  if (question.answerType === "text") {
    return []
  }

  if (Array.isArray(question.answers) && question.answers.length > 0) {
    return question.answers.map((answer, index) => ({
      value: String(index),
      label: answer.text,
      score: typeof answer.score === "number" ? answer.score : answer.score === null ? null : Number(answer.score ?? 0),
    }))
  }

  return DEFAULT_GROWTH_SURVEY_SCALE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    score: option.score,
  }))
}

export function matchesJobTarget(question: GrowthSurveyQuestion, jobName: string | null): boolean {
  if (!question) return false
  const targets = Array.isArray(question.targetJobs) ? question.targetJobs.filter(Boolean) : []
  if (targets.length === 0 || !jobName) {
    return true
  }
  return targets.includes(jobName)
}

export function filterGrowthSurveyQuestionsByJob(
  questions: GrowthSurveyQuestion[],
  jobName: string | null,
  options: { activeOnly?: boolean } = {},
): GrowthSurveyQuestion[] {
  const { activeOnly = false } = options

  return questions.filter((question) => {
    if (activeOnly && !question.isActive) {
      return false
    }
    return matchesJobTarget(question, jobName)
  })
}

