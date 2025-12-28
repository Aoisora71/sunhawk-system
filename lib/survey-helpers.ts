// Helper functions for survey calculations
import type { SurveyResultItem } from "./types"

/**
 * Calculate category scores from survey response items
 * Returns an object with category scores (1-8) and total score (average of all categories)
 */
export function calculateCategoryScores(response: SurveyResultItem[]): {
  category1Score: number
  category2Score: number
  category3Score: number
  category4Score: number
  category5Score: number
  category6Score: number
  category7Score: number
  category8Score: number
  totalScore: number
} {
  // Initialize category sums
  const categorySums: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
  }

  // Sum scores for each category (support both old and new format)
  for (const item of response) {
    const categoryId = ('cid' in item ? (item as { cid?: number }).cid : undefined) ?? item.categoryId
    const score = ('s' in item ? (item as { s?: number }).s : undefined) ?? item.score
    if (typeof categoryId === 'number' && categoryId >= 1 && categoryId <= 8 && typeof score === 'number') {
      categorySums[categoryId] += score
    }
  }

  // Calculate total score as average of all 8 category scores
  const sumOfAllCategories = Object.values(categorySums).reduce((sum, score) => sum + score, 0)
  const totalScore = sumOfAllCategories / 8

  return {
    category1Score: Number(categorySums[1].toFixed(2)),
    category2Score: Number(categorySums[2].toFixed(2)),
    category3Score: Number(categorySums[3].toFixed(2)),
    category4Score: Number(categorySums[4].toFixed(2)),
    category5Score: Number(categorySums[5].toFixed(2)),
    category6Score: Number(categorySums[6].toFixed(2)),
    category7Score: Number(categorySums[7].toFixed(2)),
    category8Score: Number(categorySums[8].toFixed(2)),
    totalScore: Number(totalScore.toFixed(2)),
  }
}

