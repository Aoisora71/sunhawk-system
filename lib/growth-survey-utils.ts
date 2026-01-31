import type { GrowthSurveyQuestion } from "@/lib/types"
import { DEFAULT_GROWTH_SURVEY_SCALE_OPTIONS } from "@/lib/growth-survey-options"

export interface GrowthSurveyOption {
  value: string
  label: string
  score: number | null
}

/**
 * Check if an answer text looks like a placeholder (e.g., "pro1", "pro2", "option1", etc.)
 */
function isPlaceholderText(text: string): boolean {
  if (!text || typeof text !== "string") return true
  // Match patterns like "pro1", "pro2", "option1", "opt1", "ans1", etc.
  const placeholderPattern = /^(pro|option|opt|ans|answer|choice|ch|q|a)\d+$/i
  return placeholderPattern.test(text.trim())
}

export function getGrowthSurveyOptions(question: GrowthSurveyQuestion): GrowthSurveyOption[] {
  if (!question) return []

  if (question.answerType === "text") {
    return []
  }

  if (Array.isArray(question.answers) && question.answers.length > 0) {
    // Check if any answer text looks like a placeholder
    const hasPlaceholderAnswers = question.answers.some((answer) => isPlaceholderText(answer.text))

    if (hasPlaceholderAnswers) {
      // If answers contain placeholder text, use default options with matching scores
      return question.answers.map((answer, index) => {
        const score = typeof answer.score === "number" ? answer.score : answer.score === null ? null : Number(answer.score ?? 0)
        // Find matching default option by score
        const defaultOption = DEFAULT_GROWTH_SURVEY_SCALE_OPTIONS.find((opt) => opt.score === score)
        return {
          value: String(index),
          label: defaultOption ? defaultOption.label : (score !== null ? `スコア ${score}` : "未設定"),
          score,
        }
      })
    }

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

