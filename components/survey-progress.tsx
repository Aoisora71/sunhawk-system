import { Progress } from "@/components/ui/progress"

interface SurveyProgressProps {
  current: number
  total: number
  category?: string
  showCategory?: boolean
}

export function SurveyProgress({ current, total, category, showCategory = true }: SurveyProgressProps) {
  // Ensure both current and total are valid numbers
  const safeCurrent = typeof current === 'number' && !isNaN(current) ? current : 0
  const safeTotal = typeof total === 'number' && !isNaN(total) ? total : 1
  const percentage = safeTotal > 0 ? (safeCurrent / safeTotal) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          質問 {safeCurrent} / {safeTotal}
        </span>
        {showCategory && category ? <span className="font-medium text-foreground">{category}</span> : null}
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  )
}
