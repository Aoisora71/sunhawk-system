export const CATEGORY_ID_MAP: Record<string, number> = {
  // Japanese labels
  "自己評価意識": 1,
  "変化意識": 2,
  "成果視点": 3,
  "行動優先意識": 4,
  "結果明確": 5,
  "時感覚": 6,
  "組織内位置認識": 7,
  "免責意識": 8,
  // English labels (fallbacks)
  "Self-Evaluation Consciousness": 1,
  "Transformation Consciousness": 2,
  "Result View": 3,
  "Behavioral Precognition": 4,
  "Result Confirmation": 5,
  "Time Sensation": 6,
  "Recognition of Organizational Position": 7,
  "Freedom of Blame": 8,
}

export function getCategoryId(category: string | null | undefined): number | null {
  if (!category) return null
  const trimmed = category.trim()
  // direct match
  if (CATEGORY_ID_MAP[trimmed] != null) return CATEGORY_ID_MAP[trimmed]
  // case-insensitive match for English
  const found = Object.entries(CATEGORY_ID_MAP).find(([key]) => key.toLowerCase() === trimmed.toLowerCase())
  return found ? found[1] : null
}


