"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import type { SurveyQuestion } from "@/lib/survey-questions"

interface SurveyQuestionCardProps {
  question: SurveyQuestion
  value: string
  onChange: (value: string) => void
  displayNumber?: number
  disabled?: boolean
  isSaving?: boolean
  questionType?: 'single_choice' | 'free_text'
}

const scaleOptions = [
  { value: "1", label: "まったくそう思わない" },
  { value: "2", label: "そう思わない" },
  { value: "3", label: "どちらかと言えばそう思わない" },
  { value: "4", label: "どちらかといえばそう思う" },
  { value: "5", label: "そう思う" },
  { value: "6", label: "非常にそう思う" },
]

export function SurveyQuestionCard({ question, value, onChange, displayNumber, disabled = false, isSaving = false, questionType = 'single_choice' }: SurveyQuestionCardProps) {
  const numberToShow = displayNumber ?? question.id
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div>
            <div className="text-sm text-muted-foreground mb-2">
              質問 {numberToShow}
              {isSaving && <span className="ml-2 text-xs text-muted-foreground">(保存中...)</span>}
            </div>
            <h3 className="text-lg font-medium text-foreground leading-relaxed">{question.question}</h3>
          </div>

          {questionType === 'single_choice' ? (
            <RadioGroup 
              value={value} 
              onValueChange={onChange} 
              disabled={disabled || isSaving}
              className="space-y-2 md:space-y-3"
            >
              {scaleOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex items-start space-x-3 p-2 md:p-0 rounded-lg transition-colors ${
                    disabled || isSaving 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'hover:bg-accent/50 cursor-pointer'
                  }`}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={`q${question.id}-${option.value}`}
                    className="mt-1 flex-shrink-0"
                    disabled={disabled || isSaving}
                  />
                  <Label
                    htmlFor={`q${question.id}-${option.value}`}
                    className={`text-sm md:text-base font-normal flex-1 leading-relaxed ${
                      disabled || isSaving ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`q${question.id}-text`} className="text-sm font-medium">
                回答を入力してください
              </Label>
              <Textarea
                id={`q${question.id}-text`}
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled || isSaving}
                placeholder="回答を入力してください..."
                rows={5}
                className="resize-none"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
