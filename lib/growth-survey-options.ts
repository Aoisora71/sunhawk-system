export interface GrowthSurveyScaleOption {
  value: string
  label: string
  score: number
}

export const DEFAULT_GROWTH_SURVEY_SCALE_OPTIONS: GrowthSurveyScaleOption[] = [
  { value: "1", label: "まったくそう思わない", score: 1 },
  { value: "2", label: "そう思わない", score: 2 },
  { value: "3", label: "どちらかと言えばそう思わない", score: 3 },
  { value: "4", label: "どちらかといえばそう思う", score: 4 },
  { value: "5", label: "そう思う", score: 5 },
  { value: "6", label: "非常にそう思う", score: 6 },
]

