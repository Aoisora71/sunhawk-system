"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, X, Edit, GripVertical, Download, Upload, RefreshCw } from "lucide-react"
import * as XLSX from "xlsx"
import { growthSurveyQuestionsApi, jobsApi } from "@/lib/api-client"
import { toast } from "@/lib/toast"
import { Badge } from "@/components/ui/badge"
import type { GrowthSurveyQuestion, Job } from "@/lib/types"

const categories = ["ルール", "組織体制", "評価制度", "週報・会議"]
const excludedJobs = ["代表取締役", "部長", "パート", "業務委託者"]

interface AnswerOption {
  text: string
  score: string
}

// Type for editing state - uses string scores for form inputs
type EditingQuestion = Omit<GrowthSurveyQuestion, 'answers' | 'weight'> & {
  answers: AnswerOption[]
  weight: string
}

export function GrowthSurveySection() {
  const [questions, setQuestions] = useState<GrowthSurveyQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<EditingQuestion | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [newQuestion, setNewQuestion] = useState({
    questionText: "",
    category: "",
    weight: "",
    targetJobs: [] as string[],
    questionType: "single_choice" as "single_choice" | "free_text",
    answers: [] as AnswerOption[],
  })

  useEffect(() => {
    fetchQuestions()
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await jobsApi.list()
      if (response?.success) {
        // Filter out excluded jobs
        const availableJobs = (response.jobs || []).filter(
          (job: any) => !excludedJobs.includes(job.name)
        )
        setJobs(availableJobs)
      }
    } catch (error) {
      console.error("Failed to load jobs:", error)
    }
  }

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const response = await growthSurveyQuestionsApi.list()
      if (response?.success) {
        setQuestions(response.questions || [])
      }
    } catch (error) {
      console.error("Failed to load growth survey questions:", error)
      toast.error("グロースサーベイ質問の取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateQuestion = async () => {
    if (!newQuestion.questionText.trim()) {
      toast.error("問題は必須です")
      return
    }

    // 単一選択問題の場合のみカテゴリを必須とする
    if (newQuestion.questionType === "single_choice" && !newQuestion.category) {
      toast.error("単一選択問題の場合、カテゴリは必須です")
      return
    }

    // For single_choice questions, validate answers
    if (newQuestion.questionType === "single_choice") {
      if (newQuestion.answers.length === 0) {
        toast.error("回答を少なくとも1つ追加してください")
        return
      }

      // Validate answers
      for (const answer of newQuestion.answers) {
        if (!answer.text.trim()) {
          toast.error("すべての回答にテキストを入力してください")
          return
        }
        if (!answer.score.trim() || isNaN(parseFloat(answer.score))) {
          toast.error("すべての回答に有効なスコアを入力してください")
          return
        }
      }
    }

    try {
      const payload: {
        questionText: string
        category?: string
        weight?: number | null
        targetJobs?: string[] | null
        questionType: "free_text" | "single_choice"
        answers?: Array<{ text: string; score: number }>
      } = {
        questionText: newQuestion.questionText.trim(),
        questionType: newQuestion.questionType,
        answers: newQuestion.questionType === "single_choice" 
          ? newQuestion.answers.map((a) => ({
              text: a.text.trim(),
              score: parseFloat(a.score),
            }))
          : [],
      }
      
      // Add category only if it's not free_text and has a value
      if (newQuestion.questionType !== "free_text" && newQuestion.category) {
        payload.category = newQuestion.category
      }
      
      // Add weight only if it's not free_text
      if (newQuestion.questionType !== "free_text") {
        if (newQuestion.weight === "" || newQuestion.weight === null || newQuestion.weight === undefined) {
          payload.weight = null
        } else {
          payload.weight = parseFloat(newQuestion.weight)
        }
      }
      
      // Add targetJobs only if it has values
      if (newQuestion.targetJobs.length > 0) {
        payload.targetJobs = newQuestion.targetJobs
      }
      
      const response = await growthSurveyQuestionsApi.create(payload)
      if (response?.success) {
        toast.success("質問を登録しました")
        setIsAddDialogOpen(false)
        setNewQuestion({
          questionText: "",
          category: "",
          weight: "",
          targetJobs: [],
          questionType: "single_choice",
          answers: [],
        })
        fetchQuestions()
      } else {
        toast.error(response?.error || "質問の登録に失敗しました")
      }
    } catch (error: any) {
      console.error("Failed to create growth survey question:", error)
      toast.error(error?.message || "質問の登録に失敗しました")
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    toast.info("質問を削除しています…")
    try {
      const response = await growthSurveyQuestionsApi.delete(questionId)
      if (response?.success) {
        toast.success("質問を削除しました")
        fetchQuestions()
      } else {
        toast.error(response?.error || "質問の削除に失敗しました")
      }
    } catch (error: any) {
      console.error("Failed to delete growth survey question:", error)
      toast.error(error?.message || "質問の削除に失敗しました")
    }
  }

  const handleEditClick = (question: any) => {
    setEditingQuestion({
      id: question.id,
      questionText: question.questionText || "",
      category: (question.category ?? "") as string,
      weight: question.weight?.toString() || "",
      targetJobs: Array.isArray(question.targetJobs) ? question.targetJobs : [],
      answers: Array.isArray(question.answers) && question.answers.length > 0
        ? question.answers.map((a: any) => ({
            text: a.text || "",
            score: a.score?.toString() || "",
          }))
        : [],
      answerType: question.answerType || "scale",
      questionType: question.questionType || "single_choice",
      isActive: question.isActive ?? true,
      createdAt: question.createdAt || "",
      updatedAt: question.updatedAt || "",
    })
  }

  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return

    if (!editingQuestion.questionText.trim()) {
      toast.error("問題は必須です")
      return
    }

    // 単一選択問題の場合のみカテゴリを必須とする
    if (editingQuestion.questionType === "single_choice" && !editingQuestion.category) {
      toast.error("単一選択問題の場合、カテゴリは必須です")
      return
    }

    // 単一選択問題の場合のみ回答を検証
    if (editingQuestion.questionType === "single_choice") {
      if (editingQuestion.answers.length === 0) {
        toast.error("回答を少なくとも1つ追加してください")
        return
      }

      // Validate answers
      for (const answer of editingQuestion.answers) {
        if (!answer.text.trim()) {
          toast.error("すべての回答にテキストを入力してください")
          return
        }
        if (!answer.score || !answer.score.trim() || isNaN(parseFloat(answer.score))) {
          toast.error("すべての回答に有効なスコアを入力してください")
          return
        }
      }
    }

    try {
      const payload: {
        questionText: string
        category?: string
        weight?: number | null
        targetJobs?: string[] | null
        questionType?: "free_text" | "single_choice"
        answers?: Array<{ text: string; score: number }>
      } = {
        questionText: editingQuestion.questionText.trim(),
        questionType: editingQuestion.questionType || "single_choice",
        answers: editingQuestion.questionType === "free_text" 
          ? []
          : editingQuestion.answers.map((a) => ({
              text: a.text.trim(),
              score: parseFloat(a.score),
            })),
      }
      
      // Add category only if it's not free_text and has a value
      if (editingQuestion.questionType !== "free_text") {
        const categoryValue = editingQuestion.category?.trim()
        if (categoryValue && categoryValue !== "") {
          payload.category = categoryValue
        }
      }
      
      // Add weight only if it's not free_text
      if (editingQuestion.questionType !== "free_text") {
        if (editingQuestion.weight === "" || editingQuestion.weight === null || editingQuestion.weight === undefined) {
          payload.weight = null
        } else {
          payload.weight = parseFloat(editingQuestion.weight)
        }
      }
      
      // Add targetJobs only if it has values
      if (editingQuestion.targetJobs.length > 0) {
        payload.targetJobs = editingQuestion.targetJobs
      }
      
      const response = await growthSurveyQuestionsApi.update(String(editingQuestion.id), payload)
      if (response?.success) {
        toast.success("質問を更新しました")
        setEditingQuestion(null)
        fetchQuestions()
      } else {
        toast.error(response?.error || "質問の更新に失敗しました")
      }
    } catch (error: any) {
      console.error("Failed to update growth survey question:", error)
      toast.error(error?.message || "質問の更新に失敗しました")
    }
  }

  const addEditAnswer = () => {
    if (!editingQuestion) return
    setEditingQuestion({
      ...editingQuestion,
      answers: [...editingQuestion.answers, { text: "", score: "" }],
    })
  }

  const removeEditAnswer = (index: number) => {
    if (!editingQuestion) return
    setEditingQuestion({
      ...editingQuestion,
      answers: editingQuestion.answers.filter((_: any, i: number) => i !== index),
    })
  }

  const updateEditAnswer = (index: number, field: "text" | "score", value: string) => {
    if (!editingQuestion) return
    const updatedAnswers = [...editingQuestion.answers]
    updatedAnswers[index] = { ...updatedAnswers[index], [field]: value }
    setEditingQuestion({ ...editingQuestion, answers: updatedAnswers })
  }

  const toggleEditTargetJob = (jobName: string) => {
    if (!editingQuestion) return
    setEditingQuestion({
      ...editingQuestion,
      targetJobs: editingQuestion.targetJobs.includes(jobName)
        ? editingQuestion.targetJobs.filter((j: string) => j !== jobName)
        : [...editingQuestion.targetJobs, jobName],
    })
  }

  const addAnswer = () => {
    setNewQuestion({
      ...newQuestion,
      answers: [...newQuestion.answers, { text: "", score: "" }],
    })
  }

  const removeAnswer = (index: number) => {
    setNewQuestion({
      ...newQuestion,
      answers: newQuestion.answers.filter((_, i) => i !== index),
    })
  }

  const updateAnswer = (index: number, field: "text" | "score", value: string) => {
    const updatedAnswers = [...newQuestion.answers]
    updatedAnswers[index] = { ...updatedAnswers[index], [field]: value }
    setNewQuestion({ ...newQuestion, answers: updatedAnswers })
  }

  const toggleTargetJob = (jobName: string) => {
    setNewQuestion({
      ...newQuestion,
      targetJobs: newQuestion.targetJobs.includes(jobName)
        ? newQuestion.targetJobs.filter((j) => j !== jobName)
        : [...newQuestion.targetJobs, jobName],
    })
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newQuestions = [...questions]
    const temp = newQuestions[index]
    newQuestions[index] = newQuestions[index - 1]
    newQuestions[index - 1] = temp
    
    // Update UI immediately (optimistic update)
    setQuestions(newQuestions)
    
    // Then update in database
    await updateOrder(newQuestions.map(q => q.id))
  }

  const handleMoveDown = async (index: number) => {
    if (index === questions.length - 1) return
    const newQuestions = [...questions]
    const temp = newQuestions[index]
    newQuestions[index] = newQuestions[index + 1]
    newQuestions[index + 1] = temp
    
    // Update UI immediately (optimistic update)
    setQuestions(newQuestions)
    
    // Then update in database
    await updateOrder(newQuestions.map(q => q.id))
  }

  const updateOrder = async (questionIds: number[]) => {
    try {
      const response = await growthSurveyQuestionsApi.updateOrder(questionIds)
      if (response?.success) {
        toast.success("順序を更新しました")
        // Refetch to ensure consistency with database
        fetchQuestions()
      } else {
        toast.error(response?.error || "順序の更新に失敗しました")
        // Revert on error by refetching
        fetchQuestions()
      }
    } catch (error: any) {
      console.error("Error updating order:", error)
      toast.error(error?.message || "順序の更新に失敗しました")
      // Revert on error by refetching
      fetchQuestions()
    }
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', String(index))
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedIndex === null || draggedIndex === index) return

    const newQuestions = [...questions]
    const draggedItem = newQuestions[draggedIndex]
    newQuestions.splice(draggedIndex, 1)
    newQuestions.splice(index, 0, draggedItem)

    setQuestions(newQuestions)
    setDraggedIndex(index)
  }

  const handleDragEnd = async () => {
    if (draggedIndex === null) return

    // Update order in database
    await updateOrder(questions.map(q => q.id))
    setDraggedIndex(null)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async () => {
    if (draggedIndex === null) return
    await updateOrder(questions.map(q => q.id))
    setDraggedIndex(null)
  }

  const handleDownloadXLSX = () => {
    try {
      const headers = [
        "ID",
        "問題文",
        "カテゴリ",
        "問題比重",
        "参加対象",
        "回答タイプ",
        "回答1テキスト",
        "回答1スコア",
        "回答2テキスト",
        "回答2スコア",
        "回答3テキスト",
        "回答3スコア",
        "回答4テキスト",
        "回答4スコア",
        "回答5テキスト",
        "回答5スコア",
        "回答6テキスト",
        "回答6スコア",
        "有効",
      ]

      const rows = questions.map((question) => {
        const answers = question.answers || []
        const answerTexts = ["", "", "", "", "", ""]
        const answerScores: (number | null)[] = [null, null, null, null, null, null]
        
        answers.forEach((answer, index) => {
          if (index < 6) {
            answerTexts[index] = answer.text || ""
            answerScores[index] = answer.score ?? null
          }
        })

        return [
          question.id,
          question.questionText,
          question.category || "",
          question.weight ?? 1.0,
          Array.isArray(question.targetJobs) ? question.targetJobs.join(", ") : "",
          question.answerType || "scale",
          answerTexts[0],
          answerScores[0],
          answerTexts[1],
          answerScores[1],
          answerTexts[2],
          answerScores[2],
          answerTexts[3],
          answerScores[3],
          answerTexts[4],
          answerScores[4],
          answerTexts[5],
          answerScores[5],
          question.isActive ? "有効" : "無効",
        ]
      })

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "グロースサーベイ質問")
      XLSX.writeFile(workbook, `グロースサーベイ質問一覧_${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("XLSXファイルをダウンロードしました")
    } catch (error) {
      console.error("XLSX download error:", error)
      toast.error("XLSXのダウンロードに失敗しました")
    }
  }

  const handleXLSXUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      if (!worksheet) {
        toast.error("XLSXファイルにシートが含まれていません")
        return
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: null,
        raw: true,
      })

      if (rows.length === 0) {
        toast.error("XLSXファイルにデータが含まれていません")
        return
      }

      const questionsToImport: any[] = []
      const errors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const question: any = {}

        // IDがある場合は更新、ない場合は新規作成
        if (row["ID"] && row["ID"] !== "") {
          question.id = typeof row["ID"] === "number" ? row["ID"] : parseInt(String(row["ID"]))
        }

        question.questionText = String(row["問題文"] || "").trim()
        question.category = String(row["カテゴリ"] || "").trim()
        question.weight = (row["問題比重"] ?? row["weight"] ?? "") !== ""
          ? parseFloat(String(row["問題比重"] ?? row["weight"]))
          : null
        question.answerType = String(row["回答タイプ"] || "scale").trim()
        question.isActive = String(row["有効"] || "有効").trim() === "有効"

        // 参加対象の処理
        const targetJobsStr = String(row["参加対象"] || "").trim()
        question.targetJobs = targetJobsStr ? targetJobsStr.split(",").map((job: string) => job.trim()).filter(Boolean) : []

        // 回答の処理
        const answers: Array<{ text: string; score: number | null }> = []
        for (let j = 1; j <= 6; j++) {
          const text = String(row[`回答${j}テキスト`] || "").trim()
          const scoreRaw = row[`回答${j}スコア`]
          // 0 を含む数値を正しく処理（空の場合は 0 を返す）
          let score: number = 0
          if (scoreRaw !== undefined && scoreRaw !== null && scoreRaw !== "") {
            if (typeof scoreRaw === "number") {
              score = scoreRaw
            } else {
              const parsed = Number(scoreRaw)
              score = Number.isFinite(parsed) ? parsed : 0
            }
          }
          if (text) {
            answers.push({ text, score })
          }
        }
        question.answers = answers

        // バリデーション
        if (!question.questionText) {
          errors.push(`行 ${i + 2}: 問題文は必須です`)
          continue
        }

        if (!question.category) {
          errors.push(`行 ${i + 2}: カテゴリは必須です`)
          continue
        }

        if (!categories.includes(question.category)) {
          errors.push(`行 ${i + 2}: カテゴリ「${question.category}」は無効です`)
          continue
        }

        if (answers.length === 0 && question.answerType !== "text") {
          errors.push(`行 ${i + 2}: 回答を少なくとも1つ追加してください`)
          continue
        }

        questionsToImport.push(question)
      }

      if (errors.length > 0) {
        errors.slice(0, 5).forEach((msg) => toast.error(msg))
        if (errors.length > 5) {
          toast.error(`他に${errors.length - 5}件のエラーがあります`)
        }
      }

      if (questionsToImport.length === 0) {
        toast.error("インポートできるデータがありません")
        return
      }

      // インポート処理
      let created = 0
      let updated = 0

      for (const questionData of questionsToImport) {
        try {
          const payload: {
            questionText: string
            category?: string
            weight?: number | null
            targetJobs?: string[] | null
            answers?: Array<{ text: string; score: number }>
            answerType?: string
            isActive?: boolean
          } = {
            questionText: questionData.questionText,
            answers: questionData.answers.map((a: any) => ({
              text: a.text,
              score: a.score,
            })),
          }
          
          // Add category only if it has a value (not null or empty)
          if (questionData.category) {
            payload.category = questionData.category
          }
          
          // Add weight if it exists
          if (questionData.weight !== null && questionData.weight !== undefined) {
            payload.weight = questionData.weight
          }
          
          // Add targetJobs only if it has values
          if (questionData.targetJobs && questionData.targetJobs.length > 0) {
            payload.targetJobs = questionData.targetJobs
          }
          
          // Add optional fields
          if (questionData.answerType) {
            payload.answerType = questionData.answerType
          }
          if (questionData.isActive !== undefined) {
            payload.isActive = questionData.isActive
          }

          if (questionData.id) {
            // 更新
            const response = await growthSurveyQuestionsApi.update(String(questionData.id), payload)
            if (response?.success) {
              updated++
            }
          } else {
            // 新規作成
            const response = await growthSurveyQuestionsApi.create(payload)
            if (response?.success) {
              created++
            }
          }
        } catch (error: any) {
          console.error(`Error importing question:`, error)
          errors.push(`質問「${questionData.questionText}」のインポートに失敗しました`)
        }
      }

      if (created > 0 || updated > 0) {
        toast.success(`${created}件を新規登録、${updated}件を更新しました`)
        fetchQuestions()
      }

      event.target.value = ""
    } catch (error) {
      console.error("XLSX upload error:", error)
      toast.error("XLSXの読み込みに失敗しました")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg">グロースサーベイ管理</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              組織グロースを測るための設問を登録・管理します
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchQuestions}
              className="w-full sm:w-auto text-xs sm:text-sm"
              title="更新"
            >
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            {/* Excel機能は一時停止中 */}
            {/* <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadXLSX}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              <Download className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              XLSXダウンロード
            </Button>
            <label>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm cursor-pointer"
                asChild
              >
                <span>
                  <Upload className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  XLSXアップロード
                </span>
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleXLSXUpload}
                className="hidden"
              />
            </label> */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  質問を追加
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">グロースサーベイ質問を追加</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  新しい質問の内容を入力してください。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">問題 *</Label>
                  <Textarea
                    value={newQuestion.questionText}
                    onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                    placeholder="例: メンバーは定期的なフィードバックを受けていますか？"
                    rows={3}
                    className="text-sm sm:text-base min-h-[80px] sm:min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">問題タイプ *</Label>
                  <Select
                    value={newQuestion.questionType}
                    onValueChange={(value: "single_choice" | "free_text") => 
                      setNewQuestion({ ...newQuestion, questionType: value, answers: value === "free_text" ? [] : newQuestion.answers })
                    }
                  >
                    <SelectTrigger className="text-sm sm:text-base h-10 sm:h-11">
                      <SelectValue placeholder="問題タイプを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_choice" className="text-sm sm:text-base">
                        単一選択問題
                      </SelectItem>
                      <SelectItem value="free_text" className="text-sm sm:text-base">
                        自由入力問題
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newQuestion.questionType === "single_choice" && (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">カテゴリ *</Label>
                      <Select
                        value={newQuestion.category}
                        onValueChange={(value) => setNewQuestion({ ...newQuestion, category: value })}
                      >
                        <SelectTrigger className="text-sm sm:text-base h-10 sm:h-11">
                          <SelectValue placeholder="カテゴリを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">問題比重</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newQuestion.weight}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                            setNewQuestion({ ...newQuestion, weight: value })
                          }
                        }}
                        placeholder="例: 1.0"
                        className="text-sm sm:text-base h-10 sm:h-11"
                      />
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        カテゴリ内でのスコア比重（デフォルト: 1.0）
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">参加対象</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                    {jobs.length === 0 ? (
                      <p className="text-xs sm:text-sm text-muted-foreground">職位が登録されていません</p>
                    ) : (
                      <div className="space-y-2">
                        {jobs.map((job) => (
                          <div key={job.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`job-${job.id}`}
                              checked={newQuestion.targetJobs.includes(job.name)}
                              onCheckedChange={() => toggleTargetJob(job.name)}
                            />
                            <label
                              htmlFor={`job-${job.id}`}
                              className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {job.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {newQuestion.questionType === "single_choice" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm sm:text-base">回答 *</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={addAnswer}
                        className="text-xs sm:text-sm h-8 sm:h-9"
                      >
                        <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        回答を追加
                      </Button>
                    </div>
                    {newQuestion.answers.length === 0 ? (
                      <p className="text-xs sm:text-sm text-muted-foreground">回答を追加してください</p>
                    ) : (
                      <div className="space-y-3 border rounded-md p-3">
                        {newQuestion.answers.map((answer, index) => (
                          <div key={index} className="flex gap-2 items-start">
                            <div className="flex-1 grid gap-2 grid-cols-1 sm:grid-cols-[1fr_120px]">
                              <div className="space-y-1">
                                <Label className="text-xs">答え</Label>
                                <Input
                                  value={answer.text}
                                  onChange={(e) => updateAnswer(index, "text", e.target.value)}
                                  placeholder="回答テキスト"
                                  className="text-sm sm:text-base h-9 sm:h-10"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">スコア</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={answer.score}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                                      updateAnswer(index, "score", value)
                                    }
                                  }}
                                  placeholder="例: 1.0"
                                  className="text-sm sm:text-base h-9 sm:h-10"
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-6 sm:mt-7 h-8 w-8 sm:h-9 sm:w-9"
                              onClick={() => removeAnswer(index)}
                            >
                              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {newQuestion.questionType === "free_text" && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      自由入力問題では、従業員が任意のテキストを入力できます。スコアは0点として扱われ、平均スコア・総合スコアの計算には含まれません。
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                >
                  キャンセル
                </Button>
                <Button 
                  onClick={handleCreateQuestion}
                  className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                >
                  登録
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      {/* Edit Dialog */}
      <Dialog open={!!editingQuestion} onOpenChange={(open) => { if (!open) setEditingQuestion(null) }}>
          <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {editingQuestion && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">グロースサーベイ質問を編集</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    質問の内容を編集してください。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">問題 *</Label>
                    <Textarea
                      value={editingQuestion.questionText}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                      placeholder="例: メンバーは定期的なフィードバックを受けていますか？"
                      rows={3}
                      className="text-sm sm:text-base min-h-[80px] sm:min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">問題タイプ *</Label>
                    <Select
                      value={editingQuestion.questionType || "single_choice"}
                      onValueChange={(value: "single_choice" | "free_text") => 
                        setEditingQuestion({ 
                          ...editingQuestion, 
                          questionType: value,
                          category: value === "free_text" ? "" : editingQuestion.category,
                          answers: value === "free_text" ? [] : editingQuestion.answers
                        })
                      }
                    >
                      <SelectTrigger className="text-sm sm:text-base h-10 sm:h-11">
                        <SelectValue placeholder="問題タイプを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_choice" className="text-sm sm:text-base">
                          単一選択問題
                        </SelectItem>
                        <SelectItem value="free_text" className="text-sm sm:text-base">
                          自由入力問題
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editingQuestion.questionType === "single_choice" && (
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm sm:text-base">カテゴリ *</Label>
                        <Select
                          value={editingQuestion.category}
                          onValueChange={(value) => setEditingQuestion({ ...editingQuestion, category: value })}
                        >
                          <SelectTrigger className="text-sm sm:text-base h-10 sm:h-11">
                            <SelectValue placeholder="カテゴリを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm sm:text-base">問題比重</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingQuestion.weight}
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                              setEditingQuestion({ ...editingQuestion, weight: value })
                            }
                          }}
                          placeholder="例: 1.0"
                          className="text-sm sm:text-base h-10 sm:h-11"
                        />
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          カテゴリ内でのスコア比重（デフォルト: 1.0）
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">参加対象</Label>
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                      {jobs.length === 0 ? (
                        <p className="text-xs sm:text-sm text-muted-foreground">職位が登録されていません</p>
                      ) : (
                        <div className="space-y-2">
                          {jobs.map((job) => (
                            <div key={job.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-job-${job.id}`}
                                checked={editingQuestion.targetJobs.includes(job.name)}
                                onCheckedChange={() => toggleEditTargetJob(job.name)}
                              />
                              <label
                                htmlFor={`edit-job-${job.id}`}
                                className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {job.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {editingQuestion.questionType === "single_choice" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm sm:text-base">回答 *</Label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={addEditAnswer}
                          className="text-xs sm:text-sm h-8 sm:h-9"
                        >
                          <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          回答を追加
                        </Button>
                      </div>
                      {editingQuestion.answers.length === 0 ? (
                        <p className="text-xs sm:text-sm text-muted-foreground">回答を追加してください</p>
                      ) : (
                        <div className="space-y-3 border rounded-md p-3">
                          {editingQuestion.answers.map((answer: AnswerOption, index: number) => (
                          <div key={index} className="flex gap-2 items-start">
                            <div className="flex-1 grid gap-2 grid-cols-1 sm:grid-cols-[1fr_120px]">
                              <div className="space-y-1">
                                <Label className="text-xs">答え</Label>
                                <Input
                                  value={answer.text}
                                  onChange={(e) => updateEditAnswer(index, "text", e.target.value)}
                                  placeholder="回答テキスト"
                                  className="text-sm sm:text-base h-9 sm:h-10"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">スコア</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={answer.score}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                                      updateEditAnswer(index, "score", value)
                                    }
                                  }}
                                  placeholder="例: 1.0"
                                  className="text-sm sm:text-base h-9 sm:h-10"
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-6 sm:mt-7 h-8 w-8 sm:h-9 sm:w-9"
                              onClick={() => removeEditAnswer(index)}
                            >
                              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                  {editingQuestion.questionType === "free_text" && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        自由入力問題では、従業員が任意のテキストを入力できます。スコアは0点として扱われ、平均スコア・総合スコアの計算には含まれません。
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingQuestion(null)}
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                  >
                    キャンセル
                  </Button>
                  <Button 
                    onClick={handleUpdateQuestion}
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                  >
                    更新
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      <CardContent className="p-0 sm:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap w-[72px]">順序</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap min-w-[200px] sm:min-w-[300px]">
                  問題
                </TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">カテゴリ</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">問題比重</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap min-w-[150px] sm:min-w-[200px]">
                  参加対象
                </TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">回答数</TableHead>
                <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs sm:text-sm text-muted-foreground py-6 sm:py-8">
                    読み込み中…
                  </TableCell>
                </TableRow>
              ) : questions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs sm:text-sm text-muted-foreground py-6 sm:py-8">
                    登録された質問はありません
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question, index) => (
                  <TableRow 
                    key={question.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`cursor-move transition-opacity ${draggedIndex === index ? 'opacity-50 bg-muted' : ''} ${draggedIndex !== null && draggedIndex !== index ? 'hover:bg-muted/50' : ''}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GripVertical 
                          className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" 
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                        <div className="text-xs sm:text-sm font-medium text-muted-foreground min-w-[20px]">
                          {index + 1}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] sm:max-w-lg whitespace-pre-wrap text-xs sm:text-sm break-words">
                      {question.questionText}
                    </TableCell>
                    <TableCell>
                      {question.category ? (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">
                          {question.category}
                        </Badge>
                      ) : (
                        <span className="text-xs sm:text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                      {question.weight !== null && question.weight !== undefined ? question.weight : "-"}
                    </TableCell>
                    <TableCell>
                      {Array.isArray(question.targetJobs) && question.targetJobs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {question.targetJobs.slice(0, 3).map((job: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-[10px] sm:text-xs">
                              {job}
                            </Badge>
                          ))}
                          {question.targetJobs.length > 3 && (
                            <Badge variant="outline" className="text-[10px] sm:text-xs">
                              +{question.targetJobs.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                      {Array.isArray(question.answers) ? question.answers.length : 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => handleEditClick(question)}
                        >
                          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => handleDeleteQuestion(String(question.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
