interface ScoreDescriptionProps {
  score: number
}

export function ScoreDescription({ score }: ScoreDescriptionProps) {
  const getDescription = (score: number) => {
    if (score <= 45) return "サンホークの考え方を参考にする必要があります。"
    if (score <= 54) return "サンホークの考え方からやや離れています。"
    if (score <= 69) return "標準的な状態です。"
    if (score <= 84) return "サンホークの考え方に近い状態です。"
    return "サンホークの考え方に非常に近い状態です。"
  }

  return <p className="text-sm text-muted-foreground leading-relaxed">{getDescription(score)}</p>
}
