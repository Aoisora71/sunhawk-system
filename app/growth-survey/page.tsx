"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { SurveyProgress } from "@/components/survey-progress"
import { GrowthSurveyQuestionCard } from "@/components/growth-survey-question-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Home, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import api from "@/lib/api-client"
import { toast } from "@/lib/toast"
import type { GrowthSurveyQuestion } from "@/lib/types"
import { getGrowthSurveyOptions } from "@/lib/growth-survey-utils"

export default function GrowthSurveyPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<GrowthSurveyQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [originalAnswers, setOriginalAnswers] = useState<Record<number, string>>({})
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  const [isSaving, setIsSaving] = useState<Record<number, boolean>>({})
  const [status, setStatus] = useState({ total: 0, progress: 0 })
  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [loadingResponses, setLoadingResponses] = useState(true)
  const [surveyCompleted, setSurveyCompleted] = useState(false)
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [surveyAvailable, setSurveyAvailable] = useState<boolean | null>(null)
  const [surveyMessage, setSurveyMessage] = useState<string>("")
  const [hasInitializedNavigation, setHasInitializedNavigation] = useState(false)

  const currentQuestion = questions[currentQuestionIndex] ?? null

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoadingQuestions(true)

        // まずグロースサーベイ期間の有無を確認
        const periodRes = await api.surveyPeriodApi.checkAvailability("growth")
        if (!periodRes?.success || !periodRes.available) {
          setSurveyAvailable(false)
          setSurveyMessage(
            (periodRes && periodRes.message) ||
              "現在、グロースサーベイのサーベイ期間ではありません。",
          )
          setQuestions([])
          setStatus({ total: 0, progress: 0 })
          return
        }

        setSurveyAvailable(true)
        setSurveyMessage(periodRes.message || "")

        const response = await api.growthSurvey.list(true)
        const data = response?.questions || []
        setQuestions(data)
        setStatus((prev) => ({ ...prev, total: data.length }))
      } catch (e: any) {
        console.error("Failed to load growth survey questions:", e)
        setError(e?.message || "質問の取得に失敗しました")
      } finally {
        setLoadingQuestions(false)
      }
    }

    loadQuestions()
  }, [])

  useEffect(() => {
    const loadResponses = async () => {
      try {
        setLoadingResponses(true)
        const response = await api.growthSurveyResponses.get()
        if (response?.success && response.response) {
          const payload = response.response
          const answersMap: Record<number, string> = {}
          const answeredSet = new Set<number>()
          const total = payload.totalQuestions || questions.length

          if (Array.isArray(payload.responses)) {
            payload.responses.forEach((entry) => {
              const question = questions.find((q) => q.id === entry.questionId)
              if (!question) return
              // Check both questionType (new) and answerType (legacy) for free text questions
              const isFreeText = question.questionType === "free_text" || question.answerType === "text"
              if (isFreeText) {
                answersMap[question.id] = entry.answer ?? ""
              } else {
                const options = getGrowthSurveyOptions(question)
                const matchedOption = options.find((option) => option.label === entry.answer)
                if (matchedOption) {
                  answersMap[question.id] = matchedOption.value
                }
              }
              answeredSet.add(entry.questionId)
            })
          }

          setAnswers(answersMap)
          setOriginalAnswers({ ...answersMap }) // Store original answers for change detection
          setAnsweredQuestions(answeredSet)
          setSurveyCompleted(Boolean(payload.completed))
          setCompletedAt(payload.completedAt || null)
          setStatus({
            total: total || questions.length,
            progress: payload.progressCount || answeredSet.size,
          })
        } else {
          setStatus((prev) => ({ ...prev, total: questions.length }))
        }
      } catch (e: any) {
        console.error("Failed to load growth survey responses:", e)
      } finally {
        setLoadingResponses(false)
      }
    }

    loadResponses()
  }, [questions])

  useEffect(() => {
    if (currentQuestionIndex >= questions.length && questions.length > 0) {
      setCurrentQuestionIndex(questions.length - 1)
    }
  }, [questions.length, currentQuestionIndex])

  // Set current question index to first unanswered question after responses are loaded (only once on initial load)
  useEffect(() => {
    // Only run once after both questions and responses are loaded, and only if we haven't initialized navigation yet
    if (!loadingQuestions && !loadingResponses && questions.length > 0 && !hasInitializedNavigation) {
      // Find the first unanswered question
      const firstUnansweredIndex = questions.findIndex((q) => !answeredQuestions.has(q.id))
      
      if (firstUnansweredIndex !== -1) {
        // Found an unanswered question - jump to it
        setCurrentQuestionIndex(firstUnansweredIndex)
      } else if (answeredQuestions.size === 0) {
        // No questions answered yet - start at the beginning
        setCurrentQuestionIndex(0)
      }
      // If all questions are answered, keep current position (user can review)
      
      // Mark as initialized so we don't auto-navigate again
      setHasInitializedNavigation(true)
    }
  }, [loadingQuestions, loadingResponses, questions, answeredQuestions, hasInitializedNavigation])

  const completionPercentage = useMemo(() => {
    if (status.total === 0) return 0
    return Math.round((status.progress / status.total) * 100)
  }, [status.progress, status.total])

  const handleAnswerChange = (questionId: number, value: string) => {
    // Don't allow editing if survey is completed
    if (surveyCompleted) {
      return
    }
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      // Don't scroll to top - keep current scroll position
    }
  }

  const handleSaveAnswer = async () => {
    if (!currentQuestion) return

    const selectedValue = answers[currentQuestion.id]
    const isFreeTextQuestion = currentQuestion.questionType === "free_text"

    // Check both questionType (new) and answerType (legacy) for free text questions
    if (isFreeTextQuestion || currentQuestion.answerType === "text") {
      if (!selectedValue || selectedValue.trim().length === 0) {
        toast.error("回答を入力してください")
        return
      }
    } else if (!selectedValue) {
      toast.error("回答を選択してください")
      return
    }

    const wasAlreadyAnswered = answeredQuestions.has(currentQuestion.id)
    const originalAnswer = originalAnswers[currentQuestion.id]
    const answerChanged = wasAlreadyAnswered && originalAnswer !== selectedValue

    // If already answered and answer hasn't changed, just move to next question
    if (wasAlreadyAnswered && !answerChanged) {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1)
        // Don't scroll to top - keep current scroll position
      }
      return
    }

    setIsSaving((prev) => ({ ...prev, [currentQuestion.id]: true }))

    try {
      // Check both questionType (new) and answerType (legacy) for free text questions
      const isFreeText = isFreeTextQuestion || currentQuestion.answerType === "text"
      const payload = isFreeText
        ? { answerText: selectedValue.trim() }
        : { answerValue: selectedValue }

      const response = await api.growthSurveyResponses.saveQuestion(currentQuestion.id, payload)

      if (!response?.success) {
        toast.error(response?.error || "回答の保存に失敗しました")
        return
      }

      // 保存が成功したことを確認してから状態を更新
      // Show success message if answer was changed
      if (answerChanged) {
        setTimeout(() => {
        toast.success("回答を更新しました")
        }, 1000)
        // Update original answer to reflect the change
        setOriginalAnswers((prev) => ({
          ...prev,
          [currentQuestion.id]: selectedValue,
        }))
      } else if (!wasAlreadyAnswered) {
        // First time answering - store as original
        setOriginalAnswers((prev) => ({
          ...prev,
          [currentQuestion.id]: selectedValue,
        }))
        setTimeout(() => {
        toast.success("回答を保存しました")
        }, 1000)
      }

      setAnsweredQuestions((prev) => new Set(prev).add(currentQuestion.id))
      setStatus((prev) => ({
        total: response.totalQuestions || prev.total || questions.length,
        progress: response.progressCount ?? prev.progress + (wasAlreadyAnswered ? 0 : 1),
      }))

      if (response.completed) {
        setSurveyCompleted(true)
        // Get completion time from API response or use current time
        setCompletedAt(response.completedAt || new Date().toISOString())
      }

      // Scroll to bottom after saving answer
      setTimeout(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })
      }, 100)

      // 状態の更新が完了してから次の問題に進む（スクロールは上に戻さない）
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1)
      }
    } catch (error: any) {
      console.error("Failed to save growth survey answer:", error)
      toast.error(error?.message || "回答の保存に失敗しました")
    } finally {
      setIsSaving((prev) => {
        const next = { ...prev }
        delete next[currentQuestion.id]
        return next
      })
    }
  }

  const isLoading = loadingQuestions || loadingResponses

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="p-3 sm:p-4 md:p-8 w-full overflow-x-hidden">
        <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 md:space-y-8">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground mb-1">グロースサーベイ</h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              グロースに関するサーベイに回答して、より良い組織づくりに貢献してください
            </p>
          </div>

          {/* Completion Card - Show only if completed */}
          {surveyCompleted ? (
            <Card className="border-green-500/40 bg-green-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  ご協力ありがとうございました
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  すべての質問に回答いただき、ありがとうございました。
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {completedAt && (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground mb-1">回答完了日時</p>
                    <p className="text-base font-medium text-foreground">
                      {new Date(completedAt).toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="default"
                    className="w-full sm:w-auto"
                    onClick={() => router.push("/employee-portal")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    従業員ポータルに戻る
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => router.push("/")}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    ホームページに戻る
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">回答状況</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {status.total > 0
                  ? `${status.progress} / ${status.total}問 回答済み（${completionPercentage}%）`
                  : "回答可能な質問がありません"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => router.push("/employee-portal")}
              >
                従業員ポータルに戻る
              </Button>
            </CardContent>
          </Card>

          {surveyAvailable === false && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {surveyMessage || "現在、グロースサーベイのサーベイ期間ではありません。"}
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  データの読み込みに失敗しました
                </CardTitle>
                <CardDescription className="text-sm text-destructive/80">{error}</CardDescription>
              </CardHeader>
            </Card>
          )}

          {isLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">読み込み中です…</CardContent>
            </Card>
          ) : questions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                現在、回答可能なグロースサーベイはありません。
              </CardContent>
            </Card>
          ) : (
            <>
              {currentQuestion && (
                <>
                  <SurveyProgress
                    current={currentQuestionIndex + 1}
                    total={questions.length}
                    showCategory={false}
                  />
                  <GrowthSurveyQuestionCard
                    question={currentQuestion}
                    value={answers[currentQuestion.id] ?? ""}
                    onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                    displayNumber={currentQuestionIndex + 1}
                    disabled={surveyCompleted}
                    isSaving={isSaving[currentQuestion.id]}
                  />
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 sm:pt-4">
                    <Button 
                      variant="outline" 
                      onClick={handlePrevious} 
                      disabled={currentQuestionIndex === 0} 
                      className="w-full sm:w-auto text-sm sm:text-base bg-transparent"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      前の質問
                    </Button>

                    <div className="text-xs sm:text-sm text-muted-foreground order-3 sm:order-2">
                      {currentQuestionIndex + 1} / {questions.length}
                    </div>

                    <Button
                      type="button"
                      onClick={handleSaveAnswer}
                      disabled={surveyCompleted || Boolean(isSaving[currentQuestion.id])}
                      className="w-full sm:w-auto text-sm sm:text-base order-2 sm:order-3"
                    >
                      次の質問
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

