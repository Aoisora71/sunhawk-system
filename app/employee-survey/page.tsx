"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SurveyProgress } from "@/components/survey-progress"
import { SurveyQuestionCard } from "@/components/survey-question-card"
import type { SurveyQuestion } from "@/lib/survey-questions"
import api from "@/lib/api-client"
import { ChevronLeft, ChevronRight, Check, AlertCircle } from "lucide-react"
import { toast } from "@/lib/toast"

// Extended problem type with category ID and answer scores
interface ProblemWithScores {
  id: number
  questionText: string
  category: string
  categoryId: number | null
  questionType: 'single_choice' | 'free_text'
  answer1Score: number
  answer2Score: number
  answer3Score: number
  answer4Score: number
  answer5Score: number
  answer6Score: number
}

export default function EmployeeSurveyPage() {
  const router = useRouter()
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([])
  const [problemsData, setProblemsData] = useState<Map<number, ProblemWithScores>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [originalAnswers, setOriginalAnswers] = useState<Record<number, string>>({})
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  const [isSaving, setIsSaving] = useState<Record<number, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [surveyCompleted, setSurveyCompleted] = useState(false)
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const [surveyAvailable, setSurveyAvailable] = useState<boolean | null>(null)
  const [surveyMessage, setSurveyMessage] = useState<string>("")
  const [activeSurveyId, setActiveSurveyId] = useState<string>("")
  const [nextStartDate, setNextStartDate] = useState<string | null>(null)

  // Check survey period availability
  useEffect(() => {
    const checkSurveyPeriod = async () => {
      try {
        const response = await api.surveyPeriodApi.checkAvailability("organizational")
        if (response?.success) {
          setSurveyAvailable(response.available)
          setSurveyMessage(response.message || "")
          if (response.available && response.survey?.id) setActiveSurveyId(response.survey.id)
          setNextStartDate(response.nextStartDate || null)
        } else {
          setSurveyAvailable(false)
          setSurveyMessage("サーベイ期間の確認に失敗しました")
        }
      } catch (error) {
        console.error("Error checking survey period:", error)
        setSurveyAvailable(false)
        setSurveyMessage("サーベイ期間の確認に失敗しました")
      }
    }

    checkSurveyPeriod()
  }, [])

  // Fetch problems from database
  useEffect(() => {
    const fetchProblems = async () => {
      try {
        setIsLoading(true)
        const response = await api.problems.listPublic()
        if (response?.success && response.problems && Array.isArray(response.problems)) {
          // Store full problem data with category IDs and scores
          const problemsMap = new Map<number, ProblemWithScores>()
          const questions: SurveyQuestion[] = response.problems
            .filter((problem) => problem && problem.id != null)
            .map((problem) => {
            const problemData: ProblemWithScores = {
              id: problem.id,
              questionText: problem.questionText,
              category: problem.category || "未分類",
              categoryId: problem.categoryId ?? null,
              questionType: problem.questionType || 'single_choice',
              answer1Score: problem.answer1Score,
              answer2Score: problem.answer2Score,
              answer3Score: problem.answer3Score,
              answer4Score: problem.answer4Score,
              answer5Score: problem.answer5Score,
              answer6Score: problem.answer6Score,
            }
            problemsMap.set(problem.id, problemData)
            
            return {
            id: problem.id,
            category: problem.category || "未分類",
            question: problem.questionText,
            type: "scale" as const,
            }
          })
          setProblemsData(problemsMap)
          setSurveyQuestions(questions)
          // Reset index when questions are loaded
          setCurrentQuestionIndex(0)
        } else {
          toast.error("問題の取得に失敗しました")
          setSurveyQuestions([])
        }
      } catch (error) {
        console.error("Error fetching problems:", error)
        toast.error("問題の取得に失敗しました")
        setSurveyQuestions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchProblems()
  }, [])

  // Load saved responses when survey ID is available
  useEffect(() => {
    const loadSavedResponses = async () => {
      if (!activeSurveyId || surveyQuestions.length === 0) return

      try {
        // Get both single choice and free text responses
        const [singleChoiceResponse, freeTextResponse] = await Promise.all([
          api.organizationalSurveyResults.get(activeSurveyId),
          api.organizationalSurveyResults.getFreeTextResponses(activeSurveyId),
        ])
        
        // Convert saved responses to answers format (answer index, not score)
        const savedAnswers: Record<number, string> = {}
        const answeredSet = new Set<number>()
        
        // Process single choice responses
        if (singleChoiceResponse?.success && singleChoiceResponse.results && singleChoiceResponse.results.length > 0) {
          const savedResult = singleChoiceResponse.results[0] // Get first result (should be only one per user/survey)
          if (!savedResult) return
          const savedResponse = savedResult.response || []
          
          for (const item of savedResponse) {
            if (!item || item.questionId == null) continue
            const problem = problemsData.get(item.questionId)
            if (!problem) continue
            
            // Find which answer index (1-6) corresponds to this score
            const scoreMap: Record<number, number> = {
              1: problem.answer1Score,
              2: problem.answer2Score,
              3: problem.answer3Score,
              4: problem.answer4Score,
              5: problem.answer5Score,
              6: problem.answer6Score,
            }
            
            // Find the answer index that matches the saved score
            for (let idx = 1; idx <= 6; idx++) {
              if (Math.abs(scoreMap[idx] - item.score) < 0.01) {
                savedAnswers[item.questionId] = String(idx)
                answeredSet.add(item.questionId)
                break
              }
            }
          }
        }
        
        // Process free text responses
        if (freeTextResponse?.success && freeTextResponse.responses) {
          for (const item of freeTextResponse.responses) {
            if (!item || item.questionId == null) continue
            savedAnswers[item.questionId] = item.answerText
            answeredSet.add(item.questionId)
          }
        }
        
        setAnswers(savedAnswers)
        setOriginalAnswers({ ...savedAnswers }) // Store original answers for change detection
        setAnsweredQuestions(answeredSet)
        
        // Check if all questions are answered
        const allQuestionsAnswered = surveyQuestions.length > 0 && 
          surveyQuestions.every((q) => answeredSet.has(q.id))
        
        if (allQuestionsAnswered) {
          setSurveyCompleted(true)
          // Get completion time from organizational_survey_results.updated_at
          if (singleChoiceResponse?.success && singleChoiceResponse.results && singleChoiceResponse.results.length > 0) {
            const savedResult = singleChoiceResponse.results[0]
            if (savedResult) {
            setCompletedAt(savedResult.updatedAt || new Date().toISOString())
            } else {
              setCompletedAt(new Date().toISOString())
            }
          } else {
            setCompletedAt(new Date().toISOString())
          }
          return
        }
        
        // Navigate to first unanswered question
        const firstUnansweredIndex = surveyQuestions.findIndex((q) => !answeredSet.has(q.id))
        if (firstUnansweredIndex >= 0) {
          setCurrentQuestionIndex(firstUnansweredIndex)
        }
      } catch (error) {
        console.error("Error loading saved responses:", error)
        // Don't show error - it's okay if there are no saved responses
      }
    }

    loadSavedResponses()
  }, [activeSurveyId, surveyQuestions, problemsData])

  // Refresh answered questions count periodically to keep progress bar accurate
  useEffect(() => {
    const refreshAnsweredCount = async () => {
      if (!activeSurveyId || surveyQuestions.length === 0) return

      try {
        // Get both single choice and free text responses
        const [singleChoiceResponse, freeTextResponse] = await Promise.all([
          api.organizationalSurveyResults.get(activeSurveyId),
          api.organizationalSurveyResults.getFreeTextResponses(activeSurveyId),
        ])
        
        const savedQuestionIds = new Set<number>()
        
        // Add single choice responses
        if (singleChoiceResponse?.success && singleChoiceResponse.results && singleChoiceResponse.results.length > 0) {
          const savedResult = singleChoiceResponse.results[0]
          if (!savedResult) return
          const savedResponse = savedResult.response || []
          
          for (const item of savedResponse) {
            if (item.questionId != null) {
              const idNum = Number(item.questionId)
              if (Number.isFinite(idNum)) {
                savedQuestionIds.add(idNum)
              }
            }
          }
        }
        
        // Add free text responses
        if (freeTextResponse?.success && freeTextResponse.responses) {
          for (const item of freeTextResponse.responses) {
            if (item && item.questionId != null) {
            savedQuestionIds.add(item.questionId)
            }
          }
        }
        
        // Update answeredQuestions state with actual saved responses
        setAnsweredQuestions((prev) => {
          // Only update if there's a change to avoid unnecessary re-renders
          const prevSize = prev.size
          const newSize = savedQuestionIds.size
          if (prevSize !== newSize) {
            return savedQuestionIds
          }
          // Check if the sets are equal
          if (prevSize === newSize && Array.from(prev).every(id => savedQuestionIds.has(id))) {
            return prev
          }
          return savedQuestionIds
        })
        
        // Check if all questions are answered
        const allQuestionsAnswered = surveyQuestions.length > 0 && 
          surveyQuestions.every((q) => savedQuestionIds.has(q.id))
        
        if (allQuestionsAnswered) {
          setSurveyCompleted(true)
          // Get completion time from organizational_survey_results.updated_at
          if (singleChoiceResponse?.success && singleChoiceResponse.results && singleChoiceResponse.results.length > 0) {
            const savedResult = singleChoiceResponse.results[0]
            if (savedResult) {
            setCompletedAt(savedResult.updatedAt || new Date().toISOString())
            } else {
              setCompletedAt(new Date().toISOString())
            }
          } else {
            setCompletedAt(new Date().toISOString())
          }
        }
      } catch (error) {
        // Silently fail - this is just for progress bar updates
        console.error("Error refreshing answered count:", error)
      }
    }

    // Refresh on mount and when current question index changes (after saving)
    refreshAnsweredCount()

    // Set up interval to refresh every 2 seconds
    const interval = setInterval(refreshAnsweredCount, 2000)

    return () => clearInterval(interval)
  }, [activeSurveyId, surveyQuestions.length, currentQuestionIndex])

  // Reset currentQuestionIndex if it's out of bounds
  useEffect(() => {
    if (surveyQuestions.length > 0 && currentQuestionIndex >= surveyQuestions.length) {
      setCurrentQuestionIndex(0)
    }
  }, [surveyQuestions.length, currentQuestionIndex])

  const currentQuestion = surveyQuestions[currentQuestionIndex] || null
  const isLastQuestion = currentQuestionIndex === surveyQuestions.length - 1
  const isFirstQuestion = currentQuestionIndex === 0
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined

  const handleAnswerChange = (value: string) => {
    if (!currentQuestion) return
    
    // Don't allow editing if survey is completed
    if (surveyCompleted) {
      return
    }
    
    // Allow editing previous answers - update local state
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }))
  }

  const handleListAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleNext = async () => {
    if (!currentQuestion || !activeSurveyId) return
    
    const problem = problemsData.get(currentQuestion.id)
    if (!problem) {
      toast.error("問題データが見つかりません")
      return
    }

    // Save current answer before moving to next question
    const currentAnswer = answers[currentQuestion.id]
    
    // Validate answer based on question type
    if (problem.questionType === 'free_text') {
      // For free text questions, check if answer is not empty
      if (!currentAnswer || (typeof currentAnswer === 'string' && currentAnswer.trim() === '')) {
        toast.error("回答を入力してください")
        return
      }
    } else {
      // For single choice questions, check if answer is selected
      if (!currentAnswer) {
        toast.error("回答を選択してください")
        return
      }
    }

    // Check if answer has changed (for previously answered questions)
    const wasAlreadyAnswered = answeredQuestions.has(currentQuestion.id)
    const originalAnswer = originalAnswers[currentQuestion.id]
    const answerChanged = wasAlreadyAnswered && originalAnswer !== currentAnswer

    // If already answered and answer hasn't changed, just move to next question
    if (wasAlreadyAnswered && !answerChanged) {
      if (currentQuestionIndex < surveyQuestions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1)
        // Don't scroll to top - keep current scroll position
      }
      return
    }

    setIsSaving((prev) => ({ ...prev, [currentQuestion.id]: true }))

    try {
      // Handle free text questions
      let saveResponse: any
      if (problem.questionType === 'free_text') {
        // Save free text answer
        saveResponse = await api.organizationalSurveyResults.saveFreeTextAnswer(currentQuestion.id, {
          surveyId: activeSurveyId,
          answerText: currentAnswer.trim(),
        })
      } else {
        // Handle single choice questions
        if (!problem.categoryId) {
          toast.error("問題データが見つかりません")
          setIsSaving((prev) => {
            const newSaving = { ...prev }
            delete newSaving[currentQuestion.id]
            return newSaving
          })
          return
        }

        const answerIndex = Number(currentAnswer)
        if (!isFinite(answerIndex) || answerIndex < 1 || answerIndex > 6) {
          toast.error("無効な回答です")
          setIsSaving((prev) => {
            const newSaving = { ...prev }
            delete newSaving[currentQuestion.id]
            return newSaving
          })
          return
        }

        // Map answer index to actual score
        const scoreMap: Record<number, number> = {
          1: problem.answer1Score,
          2: problem.answer2Score,
          3: problem.answer3Score,
          4: problem.answer4Score,
          5: problem.answer5Score,
          6: problem.answer6Score,
        }

        const actualScore = scoreMap[answerIndex]
        if (actualScore === undefined) {
          toast.error("スコアの取得に失敗しました")
          setIsSaving((prev) => {
            const newSaving = { ...prev }
            delete newSaving[currentQuestion.id]
            return newSaving
          })
          return
        }

        // Save to database (this will update if already exists)
        saveResponse = await api.organizationalSurveyResults.saveQuestion(currentQuestion.id, {
          surveyId: activeSurveyId,
          categoryId: problem.categoryId,
          score: actualScore,
        })
      }

      // 保存が成功したことを確認してから状態を更新（次の問題に移動する前に必ず確認）
      if (!saveResponse?.success) {
        toast.error(saveResponse?.error || "回答の保存に失敗しました")
        setIsSaving((prev) => {
          const newSaving = { ...prev }
          delete newSaving[currentQuestion.id]
          return newSaving
        })
        return
      }

      // Show success message if answer was changed
      if (answerChanged) {
        setTimeout(() => {
        toast.success("回答を更新しました")
        }, 1000)
        // Update original answer to reflect the change
        setOriginalAnswers((prev) => ({
          ...prev,
          [currentQuestion.id]: currentAnswer,
        }))
      } else if (!wasAlreadyAnswered) {
        // First time answering - store as original
        setOriginalAnswers((prev) => ({
          ...prev,
          [currentQuestion.id]: currentAnswer,
        }))
        setTimeout(() => {
          toast.success("回答を保存しました")
        }, 1000)
      }

      // Mark as answered and check completion
      setAnsweredQuestions((prev) => {
        const newSet = new Set(prev).add(currentQuestion.id)
        
        // Check if all questions are now answered (only if this was the last question)
        if (currentQuestionIndex === surveyQuestions.length - 1) {
          const allQuestionsAnswered = surveyQuestions.length > 0 && 
            surveyQuestions.every((q) => newSet.has(q.id))
          
          if (allQuestionsAnswered) {
            setTimeout(() => {
              setSurveyCompleted(true)
              setCompletedAt(new Date().toISOString())
              toast.success("すべての質問に回答いただき、ありがとうございました")
            }, 100)
          }
        }
        
        return newSet
      })

      // Scroll to bottom after saving answer
      setTimeout(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })
      }, 100)

      // 状態の更新が完了してから次の問題に進む（スクロールは上に戻さない）
      if (currentQuestionIndex < surveyQuestions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1)
      }
    } catch (error: any) {
      console.error("Error saving answer:", error)
      toast.error("回答の保存に失敗しました")
    } finally {
      if (currentQuestion) {
      setIsSaving((prev) => {
        const newSaving = { ...prev }
        delete newSaving[currentQuestion.id]
        return newSaving
      })
      }
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      // Don't scroll to top - keep current scroll position
    }
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      if (!activeSurveyId || !currentQuestion) {
        toast.error("実施中のサーベイが見つかりません")
        setIsSubmitting(false)
        return
      }

      // Save current answer if it hasn't been saved yet or if it has been edited
      const currentAnswer = answers[currentQuestion.id]
      const wasAlreadyAnswered = answeredQuestions.has(currentQuestion.id)
      const originalAnswer = originalAnswers[currentQuestion.id]
      const answerChanged = wasAlreadyAnswered && originalAnswer !== currentAnswer
      
      if (currentAnswer && (!wasAlreadyAnswered || answerChanged)) {
        const problem = problemsData.get(currentQuestion.id)
        if (problem) {
          try {
            let saveResponse: any
            if (problem.questionType === 'free_text') {
              // Save free text answer
              saveResponse = await api.organizationalSurveyResults.saveFreeTextAnswer(currentQuestion.id, {
                surveyId: activeSurveyId,
                answerText: currentAnswer.trim(),
              })
            } else if (problem.categoryId) {
              // Save single choice answer
              const answerIndex = Number(currentAnswer)
              if (isFinite(answerIndex) && answerIndex >= 1 && answerIndex <= 6) {
                const scoreMap: Record<number, number> = {
                  1: problem.answer1Score,
                  2: problem.answer2Score,
                  3: problem.answer3Score,
                  4: problem.answer4Score,
                  5: problem.answer5Score,
                  6: problem.answer6Score,
                }
                const actualScore = scoreMap[answerIndex]
                
                if (actualScore !== undefined) {
                  saveResponse = await api.organizationalSurveyResults.saveQuestion(currentQuestion.id, {
                    surveyId: activeSurveyId,
                    categoryId: problem.categoryId,
                    score: actualScore,
                  })
                } else {
                  toast.error("スコアの取得に失敗しました")
                  setIsSubmitting(false)
                  return
                }
              } else {
                toast.error("無効な回答です")
                setIsSubmitting(false)
                return
              }
            }

            // 保存が成功したことを確認してから状態を更新
            if (!saveResponse?.success) {
              toast.error(saveResponse?.error || "回答の保存に失敗しました")
              setIsSubmitting(false)
              return
            }

            setAnsweredQuestions((prev) => new Set(prev).add(currentQuestion.id))
            if (answerChanged) {
              setOriginalAnswers((prev) => ({
                ...prev,
                [currentQuestion.id]: currentAnswer,
              }))
            } else if (!wasAlreadyAnswered) {
              setOriginalAnswers((prev) => ({
                ...prev,
                [currentQuestion.id]: currentAnswer,
              }))
            }
          } catch (error) {
            console.error("Error saving last answer:", error)
            toast.error("最後の回答の保存に失敗しました")
            setIsSubmitting(false)
            return
          }
        }
      }

      // Get saved responses from database to check actual answered questions (including both single choice and free text)
      const [singleChoiceResponse, freeTextResponse] = await Promise.all([
        api.organizationalSurveyResults.get(activeSurveyId),
        api.organizationalSurveyResults.getFreeTextResponses(activeSurveyId),
      ])
      
      const savedQuestionIds = new Set<number>()

      // Count single choice responses
      if (singleChoiceResponse?.success && singleChoiceResponse.results && singleChoiceResponse.results.length > 0) {
        const savedResult = singleChoiceResponse.results[0]
        if (!savedResult) return
        const savedResponse = savedResult.response || []
        for (const item of savedResponse) {
          if (item && item.questionId != null) {
            const idNum = Number(item.questionId)
            if (Number.isFinite(idNum)) savedQuestionIds.add(idNum)
          }
        }
      }

      // Count free text responses
      if (freeTextResponse?.success && Array.isArray(freeTextResponse.responses)) {
        for (const item of freeTextResponse.responses) {
          if (item && item.questionId != null) {
            savedQuestionIds.add(item.questionId)
          }
        }
      }

      if (savedQuestionIds.size === 0) {
        toast.error("回答がありません")
        setIsSubmitting(false)
        return
      }

      // Check if all questions are answered based on actual saved responses (including free text)
      const unansweredQuestions = surveyQuestions.filter((q) => !savedQuestionIds.has(q.id))
      
      if (unansweredQuestions.length > 0) {
        const confirmMessage = `未回答の質問が${unansweredQuestions.length}問あります。送信しますか？`
        if (!confirm(confirmMessage)) {
          setIsSubmitting(false)
          return
        }
      }

      // Update answeredQuestions state with actual saved responses
      setAnsweredQuestions(savedQuestionIds)

      // All responses are saved, show completion
      toast.success("サーベイ結果を送信しました")
      const completionTime = new Date().toISOString()
      setSurveyCompleted(true)
      setCompletedAt(completionTime)
      // Don't redirect - show completion card instead
    } catch (e: any) {
      console.error("Submit error:", e)
      toast.error(e?.message || "送信に失敗しました")
      setIsSubmitting(false)
    }
  }

  // Calculate answered count from actual saved responses to ensure accuracy
  const answeredCount = answeredQuestions.size
  const totalQuestions = surveyQuestions.length
  const completionPercentage = totalQuestions > 0 
    ? Math.round((answeredCount / totalQuestions) * 100) 
    : 0
  const safeCompletionPercentage = isNaN(completionPercentage) || completionPercentage < 0 
    ? 0 
    : completionPercentage > 100 
      ? 100 
      : completionPercentage

  // Survey period not available state
  if (surveyAvailable === false) {
    const formattedNext = nextStartDate
      ? new Date(nextStartDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
      : null
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="p-3 sm:p-4 md:p-8 w-full overflow-x-hidden">
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
            <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-medium text-foreground mb-2">サーベイ期間外です</h2>
                    <p className="text-sm text-muted-foreground">{surveyMessage}</p>
                    {formattedNext && (
                      <p className="text-sm text-muted-foreground mt-1">次回のサーベイ開始予定日: {formattedNext}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  // Survey already completed state - show completion card at top instead of replacing entire page

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="p-3 sm:p-4 md:p-8 w-full overflow-x-hidden">
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground mb-1 sm:mb-2">ソシキサーベイ</h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              全{surveyQuestions.length}問の質問にお答えください。回答は匿名で処理されます。
            </p>
          </div>

          {/* Completion Card - Show only if completed */}
          {surveyCompleted ? (
            <Card className="border-green-500/40 bg-green-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="h-5 w-5" />
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
                    従業員ポータルに戻る
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => router.push("/")}
                  >
                    ホームページに戻る
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
          {/* Overall Progress */}
          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-base sm:text-lg">回答状況</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {answeredCount}問 / {totalQuestions}問 回答済み（{safeCompletionPercentage}%）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${safeCompletionPercentage}%` }}
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

          {/* Question-by-question entry */}
          {currentQuestion && (
            <SurveyProgress current={currentQuestionIndex + 1} total={surveyQuestions.length} />
          )}
          {currentQuestion && (
            <SurveyQuestionCard 
              question={currentQuestion} 
              value={currentAnswer || ""} 
              onChange={handleAnswerChange} 
              displayNumber={currentQuestionIndex + 1}
              disabled={surveyCompleted}
              isSaving={isSaving[currentQuestion.id] || false}
              questionType={problemsData.get(currentQuestion.id)?.questionType || 'single_choice'}
            />
          )}

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 sm:pt-4">
            <Button variant="outline" onClick={handlePrevious} disabled={isFirstQuestion} className="w-full sm:w-auto text-sm sm:text-base bg-transparent">
              <ChevronLeft className="mr-2 h-4 w-4" />
              前の質問
            </Button>

            <div className="text-xs sm:text-sm text-muted-foreground order-3 sm:order-2">
              {currentQuestionIndex + 1} / {surveyQuestions.length}
            </div>

            {isLastQuestion ? (
              <Button onClick={handleSubmit} disabled={surveyCompleted || isSubmitting} className="w-full sm:w-auto text-sm sm:text-base order-2 sm:order-3">
                {isSubmitting ? "送信中..." : (<><Check className="mr-2 h-4 w-4" />回答を送信</>)}
              </Button>
            ) : (
              <Button 
                onClick={handleNext} 
                disabled={
                  surveyCompleted || 
                  !currentQuestion ||
                  isSaving[currentQuestion?.id || 0] || 
                  (!currentAnswer && !(currentQuestion && answeredQuestions.has(currentQuestion.id)))
                } 
                className="w-full sm:w-auto text-sm sm:text-base order-2 sm:order-3"
              >
                {isSaving[currentQuestion?.id || 0] ? "保存中..." : "次の質問"}
                {!isSaving[currentQuestion?.id || 0] && <ChevronRight className="ml-2 h-4 w-4" />}
              </Button>
            )}
          </div>
            </>
          )}

          {/* 一括入力機能は削除 */}
        </div>
      </main>
    </div>
  )
}
