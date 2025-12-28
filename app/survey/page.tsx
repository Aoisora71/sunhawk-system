"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardNav } from "@/components/dashboard-nav"
import { Button } from "@/components/ui/button"
import { SurveyProgress } from "@/components/survey-progress"
import { SurveyQuestionCard } from "@/components/survey-question-card"
import type { SurveyQuestion } from "@/lib/survey-questions"
import api from "@/lib/api-client"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/lib/toast"

export default function SurveyPage() {
  const router = useRouter()
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch problems from database
  useEffect(() => {
    const fetchProblems = async () => {
      try {
        setIsLoading(true)
        const response = await api.problems.listPublic()
        if (response?.success && response.problems) {
          // Convert problems to SurveyQuestion format
          const questions: SurveyQuestion[] = response.problems.map((problem) => ({
            id: Number(problem.id),
            category: problem.category || "未分類",
            question: problem.questionText,
            type: "scale" as const,
          }))
          setSurveyQuestions(questions)
          // Reset index when questions are loaded
          setCurrentQuestionIndex(0)
        } else {
          toast.error("問題の取得に失敗しました")
          // Fallback to empty array
          setSurveyQuestions([])
        }
      } catch (error) {
                toast.error("問題の取得に失敗しました")
        setSurveyQuestions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchProblems()
  }, [])

  // Reset currentQuestionIndex if it's out of bounds
  useEffect(() => {
    if (surveyQuestions.length > 0 && currentQuestionIndex >= surveyQuestions.length) {
      setCurrentQuestionIndex(0)
    }
  }, [surveyQuestions.length, currentQuestionIndex])

  const currentQuestion = surveyQuestions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === surveyQuestions.length - 1
  const isFirstQuestion = currentQuestionIndex === 0
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined

  const handleAnswerChange = (value: string) => {
    if (!currentQuestion) return
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }))
  }

  const handleNext = () => {
    if (currentQuestionIndex < surveyQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    // Capture completion time
    const completedAt = new Date().toISOString()
    setTimeout(() => {
      router.push(`/survey/complete?completedAt=${encodeURIComponent(completedAt)}`)
    }, 1500)
  }

  const answeredCount = Object.keys(answers).length
  const completionPercentage = surveyQuestions.length > 0 
    ? Math.round((answeredCount / surveyQuestions.length) * 100) 
    : 0
  
  // Safety check for NaN values
  const safeCompletionPercentage = isNaN(completionPercentage) ? 0 : completionPercentage

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex flex-col md:flex-row">
          <DashboardNav />
          <main className="flex-1 p-3 sm:p-4 md:p-8 w-full overflow-x-hidden">
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
              <div className="text-center py-12">
                <p className="text-muted-foreground">質問を読み込んでいます...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // No questions state
  if (!isLoading && surveyQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex flex-col md:flex-row">
          <DashboardNav />
          <main className="flex-1 p-3 sm:p-4 md:p-8 w-full overflow-x-hidden">
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
              <div className="text-center py-12">
                <p className="text-muted-foreground">質問が登録されていません</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex flex-col md:flex-row">
        <DashboardNav />
        <main className="flex-1 p-3 sm:p-4 md:p-8 w-full overflow-x-hidden">
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground mb-1 sm:mb-2">ソシキサーベイ</h1>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                全{surveyQuestions.length}問の質問にお答えください。回答は匿名で処理されます。
              </p>
            </div>

            {/* Overall Progress */}
            <Card>
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-base sm:text-lg">回答状況</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {answeredCount}問 / {surveyQuestions.length}問 回答済み（{safeCompletionPercentage}%）
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Current Progress & Question */}
            {currentQuestion && (
              <div key={`qwrap-${currentQuestion.id}`}>
                <SurveyProgress
                  current={currentQuestionIndex + 1}
                  total={surveyQuestions.length}
                  category={currentQuestion.category}
                />

                {/* Question Card */}
                <SurveyQuestionCard 
                  key={currentQuestion.id}
                  question={currentQuestion} 
                  value={currentAnswer || ""} 
                  onChange={handleAnswerChange} 
                  displayNumber={currentQuestionIndex + 1}
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 sm:pt-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isFirstQuestion}
                className="w-full sm:w-auto text-sm sm:text-base bg-transparent"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                前の質問
              </Button>

              <div className="text-xs sm:text-sm text-muted-foreground order-3 sm:order-2">
                {currentQuestionIndex + 1} / {surveyQuestions.length}
              </div>

              {isLastQuestion ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!currentAnswer || isSubmitting}
                  className="w-full sm:w-auto text-sm sm:text-base order-2 sm:order-3"
                >
                  {isSubmitting ? (
                    "送信中..."
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      回答を送信
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!currentAnswer}
                  className="w-full sm:w-auto text-sm sm:text-base order-2 sm:order-3"
                >
                  次の質問
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Category Navigation */}
            {surveyQuestions.length > 0 && (
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-sm sm:text-base">カテゴリ別進捗</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                    {Array.from(new Set(surveyQuestions.map(q => q.category))).map((category) => {
                      const categoryQuestions = surveyQuestions.filter((q) => q.category === category)
                      const categoryAnswered = categoryQuestions.filter((q) => answers[q.id]).length
                      const categoryTotal = categoryQuestions.length

                      return (
                        <div key={category} className="space-y-1">
                          <div className="text-xs sm:text-sm font-medium text-foreground">{category}</div>
                          <div className="text-xs text-muted-foreground">
                            {categoryAnswered} / {categoryTotal}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
