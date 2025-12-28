"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import type { GrowthSurveyQuestion } from "@/lib/types"
import { getGrowthSurveyOptions } from "@/lib/growth-survey-utils"

interface GrowthSurveyQuestionCardProps {
  question: GrowthSurveyQuestion
  value: string
  onChange: (value: string) => void
  displayNumber?: number
  disabled?: boolean
  isSaving?: boolean
}

export function GrowthSurveyQuestionCard({
  question,
  value,
  onChange,
  displayNumber,
  disabled = false,
  isSaving = false,
}: GrowthSurveyQuestionCardProps) {
  const numberToShow = displayNumber ?? question.id
  const options = getGrowthSurveyOptions(question)
  // Check both answerType (legacy) and questionType (new) for free text questions
  const isTextQuestion = question.questionType === "free_text" || question.answerType === "text"
  const isReadOnly = disabled || isSaving

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
          <div className="text-sm text-muted-foreground mb-2 flex flex-wrap items-center gap-2">
            <span>質問 {numberToShow}</span>
            {isSaving && <span className="text-xs text-muted-foreground">(保存中...)</span>}
          </div>
          <h3 className="text-lg font-medium text-foreground leading-relaxed">{question.questionText}</h3>
          {(question as any).description && (
            <p className="text-sm text-muted-foreground mt-2 leading-snug whitespace-pre-line">
              {(question as any).description}
            </p>
          )}
        </div>

        {isTextQuestion ? (
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="回答を入力してください"
            disabled={isReadOnly}
            className="min-h-[120px]"
          />
        ) : (
          <RadioGroup
            value={value}
            onValueChange={onChange}
            disabled={isReadOnly}
            className="space-y-2 md:space-y-3"
          >
            {options.map((option) => (
              <div
                key={option.value}
                className={`flex items-start space-x-3 p-2 md:p-0 rounded-lg transition-colors ${
                  isReadOnly ? "opacity-60 cursor-not-allowed" : "hover:bg-accent/50 cursor-pointer"
                }`}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`growth-q${question.id}-${option.value}`}
                  className="mt-1 flex-shrink-0"
                  disabled={isReadOnly}
                />
                <Label
                  htmlFor={`growth-q${question.id}-${option.value}`}
                  className={`text-sm md:text-base font-normal flex-1 leading-relaxed ${
                    isReadOnly ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  )
}

