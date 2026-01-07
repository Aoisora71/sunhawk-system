"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit, Trash2, GripVertical, Download, Upload, RefreshCw } from "lucide-react"
import * as XLSX from "xlsx"
import { problemsApi } from "@/lib/api-client"
import { categories } from "@/lib/survey-questions"
import { getCategoryId } from "@/lib/categories"
import { toast } from "@/lib/toast"
import type { Problem } from "@/lib/types"

const answerLabels = [
  "まったくそう思わない",
  "そう思わない",
  "どちらかと言えばそう思わない",
  "どちらかといえばそう思う",
  "そう思う",
  "非常にそう思う",
]

export function ProblemBankSection() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [isAddProblemOpen, setIsAddProblemOpen] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  // Type for editing state - uses string scores for form inputs
  type EditingProblem = Omit<Problem, 'answer1Score' | 'answer2Score' | 'answer3Score' | 'answer4Score' | 'answer5Score' | 'answer6Score'> & {
    questionType: "single_choice" | "free_text"
    answer1Score: string
    answer2Score: string
    answer3Score: string
    answer4Score: string
    answer5Score: string
    answer6Score: string
  }
  const [editingProblem, setEditingProblem] = useState<EditingProblem | null>(null)
  const [newProblem, setNewProblem] = useState({
    questionText: "",
    category: "",
    questionType: "single_choice" as "single_choice" | "free_text",
    answer1Score: "0.00",
    answer2Score: "0.00",
    answer3Score: "0.00",
    answer4Score: "0.00",
    answer5Score: "0.00",
    answer6Score: "0.00",
  })

  useEffect(() => {
    fetchProblems()
  }, [])

  const fetchProblems = async () => {
    try {
      const response = await problemsApi.list()
      if (response?.success) {
        setProblems(response.problems || [])
      }
    } catch (error) {
      console.error("Error fetching problems:", error)
    }
  }

  const handleCreateProblem = async () => {
    if (!newProblem.questionText) {
      toast.error("問題文は必須です")
      return
    }

    // 単一選択問題の場合のみカテゴリを必須とする
    if (newProblem.questionType === "single_choice" && !newProblem.category) {
      toast.error("単一選択問題の場合、カテゴリは必須です")
      return
    }

    try {
      const problemData: {
        questionText: string
        category: string
        categoryId?: number
        answer1Score?: number
        answer2Score?: number
        answer3Score?: number
        answer4Score?: number
        answer5Score?: number
        answer6Score?: number
      } = {
        questionText: newProblem.questionText,
        category: newProblem.questionType === "free_text" ? "" : (newProblem.category || ""),
      }
      
      // Add categoryId only if it's not free_text and has a value
      if (newProblem.questionType !== "free_text" && newProblem.category) {
        const categoryId = getCategoryId(newProblem.category)
        if (categoryId !== null && categoryId !== undefined) {
          problemData.categoryId = categoryId
        }
      }
      
      // Add answer scores
      problemData.answer1Score = parseFloat(newProblem.answer1Score) || 0.00
      problemData.answer2Score = parseFloat(newProblem.answer2Score) || 0.00
      problemData.answer3Score = parseFloat(newProblem.answer3Score) || 0.00
      problemData.answer4Score = parseFloat(newProblem.answer4Score) || 0.00
      problemData.answer5Score = parseFloat(newProblem.answer5Score) || 0.00
      problemData.answer6Score = parseFloat(newProblem.answer6Score) || 0.00

      const response = await problemsApi.create(problemData)
      if (response?.success) {
        toast.success("問題を登録しました")
        setNewProblem({
          questionText: "",
          category: "",
          questionType: "single_choice",
          answer1Score: "0.00",
          answer2Score: "0.00",
          answer3Score: "0.00",
          answer4Score: "0.00",
          answer5Score: "0.00",
          answer6Score: "0.00",
        })
        setIsAddProblemOpen(false)
        fetchProblems()
      } else {
        toast.error(response?.error || "問題の登録に失敗しました")
      }
    } catch (error: any) {
      console.error("Error creating problem:", error)
      toast.error(error?.message || "問題の登録に失敗しました")
    }
  }

  const handleUpdateProblem = async () => {
    if (!editingProblem || !editingProblem.questionText) {
      toast.error("問題文は必須です")
      return
    }

    // 単一選択問題の場合のみカテゴリを必須とする
    if (editingProblem.questionType === "single_choice" && !editingProblem.category) {
      toast.error("単一選択問題の場合、カテゴリは必須です")
      return
    }

    try {
      const problemData: {
        questionText: string
        category?: string
        categoryId?: number
        answer1Score?: number
        answer2Score?: number
        answer3Score?: number
        answer4Score?: number
        answer5Score?: number
        answer6Score?: number
        displayOrder?: number
      } = {
        questionText: editingProblem.questionText,
      }
      
      // Add category only if it's not free_text and has a value
      if (editingProblem.questionType !== "free_text" && editingProblem.category) {
        problemData.category = editingProblem.category
        const categoryId = getCategoryId(editingProblem.category)
        if (categoryId !== null && categoryId !== undefined) {
          problemData.categoryId = categoryId
        }
      } else if (editingProblem.questionType === "free_text") {
        problemData.category = ""
      }
      
      // Add answer scores
      problemData.answer1Score = parseFloat(editingProblem.answer1Score) || 0.00
      problemData.answer2Score = parseFloat(editingProblem.answer2Score) || 0.00
      problemData.answer3Score = parseFloat(editingProblem.answer3Score) || 0.00
      problemData.answer4Score = parseFloat(editingProblem.answer4Score) || 0.00
      problemData.answer5Score = parseFloat(editingProblem.answer5Score) || 0.00
      problemData.answer6Score = parseFloat(editingProblem.answer6Score) || 0.00

      const response = await problemsApi.update(String(editingProblem.id), problemData)
      if (response?.success) {
        toast.success("問題情報を更新しました")
        setEditingProblem(null)
        fetchProblems()
      } else {
        toast.error(response?.error || "問題情報の更新に失敗しました")
      }
    } catch (error: any) {
      console.error("Error updating problem:", error)
      console.error("Error details:", {
        message: error.message,
        status: error.status,
        data: error.data
      })
      const errorMessage = error?.data?.error || error?.data?.details || error?.message || "問題情報の更新に失敗しました"
      toast.error(errorMessage)
    }
  }

  const handleDeleteProblem = async (problemId: string) => {
    toast.info("問題を削除しています…")
    try {
      const response = await problemsApi.delete(problemId)
      if (response?.success) {
        toast.success("問題を削除しました")
        fetchProblems()
      } else {
        toast.error(response?.error || "問題の削除に失敗しました")
      }
    } catch (error: any) {
      console.error("Error deleting problem:", error)
      toast.error(error?.message || "問題の削除に失敗しました")
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newProblems = [...problems]
    const temp = newProblems[index]
    newProblems[index] = newProblems[index - 1]
    newProblems[index - 1] = temp
    
    // Update UI immediately (optimistic update)
    setProblems(newProblems)
    
    // Then update in database
    await updateOrder(newProblems.map(p => p.id))
  }

  const handleMoveDown = async (index: number) => {
    if (index === problems.length - 1) return
    const newProblems = [...problems]
    const temp = newProblems[index]
    newProblems[index] = newProblems[index + 1]
    newProblems[index + 1] = temp
    
    // Update UI immediately (optimistic update)
    setProblems(newProblems)
    
    // Then update in database
    await updateOrder(newProblems.map(p => p.id))
  }

  const updateOrder = async (questionIds: number[]) => {
    try {
      const response = await problemsApi.updateOrder(questionIds)
      if (response?.success) {
        toast.success("順序を更新しました")
        // Refetch to ensure consistency with database
        fetchProblems()
      } else {
        toast.error(response?.error || "順序の更新に失敗しました")
        // Revert on error by refetching
        fetchProblems()
      }
    } catch (error: any) {
      console.error("Error updating order:", error)
      toast.error(error?.message || "順序の更新に失敗しました")
      // Revert on error by refetching
      fetchProblems()
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

    const newProblems = [...problems]
    const draggedItem = newProblems[draggedIndex]
    newProblems.splice(draggedIndex, 1)
    newProblems.splice(index, 0, draggedItem)

    setProblems(newProblems)
    setDraggedIndex(index)
  }

  const handleDragEnd = async () => {
    if (draggedIndex === null) return

    // Update order in database
    await updateOrder(problems.map(p => p.id))
    setDraggedIndex(null)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async () => {
    if (draggedIndex === null) return
    await updateOrder(problems.map(p => p.id))
    setDraggedIndex(null)
  }

  const handleDownloadXLSX = () => {
    try {
      const headers = [
        "順序",
        "問題文",
        "カテゴリ",
        "まったくそう思わない",
        "そう思わない",
        "どちらかと言えばそう思わない",
        "どちらかといえばそう思う",
        "そう思う",
        "非常にそう思う",
      ]

      const rows = problems.map((problem, idx) => [
        problem.displayOrder ?? idx + 1,
        problem.questionText,
        problem.category,
        problem.answer1Score,
        problem.answer2Score,
        problem.answer3Score,
        problem.answer4Score,
        problem.answer5Score,
        problem.answer6Score,
      ])

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "サーベイ質問")
      XLSX.writeFile(workbook, `サーベイ質問一覧_${new Date().toISOString().split("T")[0]}.xlsx`)
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

      const problemsToImport: any[] = []
      const errors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const problem: any = {}

        // 順序（IDは使わない）
        const displayOrderRaw = row["順序"] ?? row["display_order"]
        const displayOrder = displayOrderRaw !== undefined && displayOrderRaw !== ""
          ? Number(displayOrderRaw)
          : null

        problem.questionText = String(row["問題文"] || "").trim()
        problem.category = String(row["カテゴリ"] || "").trim()
        // スコア読み込み（旧ヘッダ互換 + 0 を正しく扱う）
        const scoreReaders = [
          { keys: ["まったくそう思わない", "回答1スコア"] },
          { keys: ["そう思わない", "回答2スコア"] },
          { keys: ["どちらかと言えばそう思わない", "回答3スコア"] },
          { keys: ["どちらかといえばそう思う", "回答4スコア"] },
          { keys: ["そう思う", "回答5スコア"] },
          { keys: ["非常にそう思う", "回答6スコア"] },
        ]

        const readScore = (keys: string[]): number => {
          for (const key of keys) {
            const raw = row[key]
            // undefined, null, 空文字列の場合は次のキーを試す
            if (raw === undefined || raw === null || raw === "") continue
            // 数値の場合はそのまま返す（0も含む）
            if (typeof raw === "number") {
              return raw
            }
            // 文字列の場合は数値に変換を試みる
            const n = Number(raw)
            if (Number.isFinite(n)) {
              return n
            }
          }
          // どのキーにも値がない場合は 0 を返す
          return 0
        }

        problem.answer1Score = readScore(scoreReaders[0].keys)
        problem.answer2Score = readScore(scoreReaders[1].keys)
        problem.answer3Score = readScore(scoreReaders[2].keys)
        problem.answer4Score = readScore(scoreReaders[3].keys)
        problem.answer5Score = readScore(scoreReaders[4].keys)
        problem.answer6Score = readScore(scoreReaders[5].keys)
        if (displayOrder !== null && Number.isFinite(displayOrder)) {
          problem.displayOrder = Number(displayOrder)
        }

        // バリデーション
        if (!problem.questionText) {
          errors.push(`行 ${i + 2}: 問題文は必須です`)
          continue
        }

        if (!problem.category) {
          errors.push(`行 ${i + 2}: カテゴリは必須です`)
          continue
        }

        if (!categories.includes(problem.category)) {
          errors.push(`行 ${i + 2}: カテゴリ「${problem.category}」は無効です`)
          continue
        }

        problemsToImport.push(problem)
      }

      if (errors.length > 0) {
        errors.slice(0, 5).forEach((msg) => toast.error(msg))
        if (errors.length > 5) {
          toast.error(`他に${errors.length - 5}件のエラーがあります`)
        }
      }

      if (problemsToImport.length === 0) {
        toast.error("インポートできるデータがありません")
        return
      }

      // 既存の問題を取得して問題文でマッチング
      const existingProblemsResponse = await problemsApi.list()
      const existingProblems = existingProblemsResponse?.success ? existingProblemsResponse.problems || [] : []
      const existingProblemsMap = new Map<string, number>()
      existingProblems.forEach((p: any) => {
        const normalizedText = String(p.questionText || "").trim().toLowerCase()
        if (normalizedText && p.id) {
          existingProblemsMap.set(normalizedText, Number(p.id))
        }
      })

      // インポート処理
      let created = 0
      let updated = 0

      for (const problemData of problemsToImport) {
        try {
          let problemId: number | null = null

          // IDが指定されている場合はそれを使用
          if (problemData.id) {
            problemId = problemData.id
          } else {
            // 問題文で既存の問題を検索
            const normalizedText = problemData.questionText.trim().toLowerCase()
            const existingId = existingProblemsMap.get(normalizedText)
            if (existingId) {
              problemId = existingId
            }
          }

          if (problemId) {
            // 更新
            const updateData: {
              questionText: string
              category?: string
              categoryId?: number
              answer1Score?: number
              answer2Score?: number
              answer3Score?: number
              answer4Score?: number
              answer5Score?: number
              answer6Score?: number
              displayOrder?: number
            } = {
              questionText: problemData.questionText,
            }
            
            // Add category if it has a value
            if (problemData.category) {
              updateData.category = problemData.category
              const categoryId = getCategoryId(problemData.category)
              if (categoryId !== null && categoryId !== undefined) {
                updateData.categoryId = categoryId
              }
            }
            
            updateData.answer1Score = problemData.answer1Score
            updateData.answer2Score = problemData.answer2Score
            updateData.answer3Score = problemData.answer3Score
            updateData.answer4Score = problemData.answer4Score
            updateData.answer5Score = problemData.answer5Score
            updateData.answer6Score = problemData.answer6Score
            
            // displayOrderが指定されている場合は追加
            if (problemData.displayOrder !== undefined && problemData.displayOrder !== null) {
              updateData.displayOrder = Number(problemData.displayOrder)
            }
            const response = await problemsApi.update(String(problemId), updateData)
            if (response?.success) {
              updated++
            }
          } else {
            // 新規作成
            const createData: {
              questionText: string
              category: string
              categoryId?: number
              answer1Score?: number
              answer2Score?: number
              answer3Score?: number
              answer4Score?: number
              answer5Score?: number
              answer6Score?: number
            } = {
              questionText: problemData.questionText,
              category: problemData.category || "",
            }
            
            const categoryId = getCategoryId(problemData.category)
            if (categoryId !== null && categoryId !== undefined) {
              createData.categoryId = categoryId
            }
            
            createData.answer1Score = problemData.answer1Score
            createData.answer2Score = problemData.answer2Score
            createData.answer3Score = problemData.answer3Score
            createData.answer4Score = problemData.answer4Score
            createData.answer5Score = problemData.answer5Score
            createData.answer6Score = problemData.answer6Score
            
            const response = await problemsApi.create(createData)
            if (response?.success) {
              created++
            }
          }
        } catch (error: any) {
          console.error(`Error importing problem:`, error)
          errors.push(`問題「${problemData.questionText}」のインポートに失敗しました`)
        }
      }

      if (created > 0 || updated > 0) {
        toast.success(`${created}件を新規登録、${updated}件を更新しました`)
        fetchProblems()
      }

      event.target.value = ""
    } catch (error) {
      console.error("XLSX upload error:", error)
      toast.error("XLSXの読み込みに失敗しました")
    }
  }

  const handleEditClick = (problem: any) => {
    setEditingProblem({
      id: problem.id,
      questionText: problem.questionText,
      category: problem.category,
      categoryId: problem.categoryId,
      questionType: problem.questionType || "single_choice",
      answer1Score: problem.answer1Score.toFixed(2),
      answer2Score: problem.answer2Score.toFixed(2),
      answer3Score: problem.answer3Score.toFixed(2),
      answer4Score: problem.answer4Score.toFixed(2),
      answer5Score: problem.answer5Score.toFixed(2),
      answer6Score: problem.answer6Score.toFixed(2),
      createdAt: problem.createdAt || "",
      updatedAt: problem.updatedAt || "",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg">ソシキサーベイ管理</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              再利用可能なサーベイ質問を登録、編集、削除ができます
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProblems}
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
            <Dialog open={isAddProblemOpen} onOpenChange={setIsAddProblemOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  新規登録
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">新規問題登録</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">問題を入力してください</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm sm:text-base">問題文 *</Label>
                    <Textarea
                      value={newProblem.questionText}
                      onChange={(e) => setNewProblem({ ...newProblem, questionText: e.target.value })}
                      placeholder="問題を記述してください"
                      rows={3}
                      className="text-sm sm:text-base min-h-[80px] sm:min-h-[100px]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm sm:text-base">問題タイプ *</Label>
                    <Select
                      value={newProblem.questionType}
                      onValueChange={(value: "single_choice" | "free_text") => 
                        setNewProblem({ ...newProblem, questionType: value, category: value === "free_text" ? "" : newProblem.category })
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
                  {newProblem.questionType === "single_choice" && (
                    <div>
                      <Label className="text-sm sm:text-base">カテゴリ *</Label>
                      <Select
                        value={newProblem.category}
                        onValueChange={(value) => setNewProblem({ ...newProblem, category: value })}
                      >
                        <SelectTrigger className="text-sm sm:text-base h-10 sm:h-11">
                          <SelectValue placeholder="カテゴリを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-sm sm:text-base">
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {newProblem.questionType === "single_choice" && (
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">回答に対する点数設定</Label>
                      {answerLabels.map((label, index) => {
                        const scoreKey = `answer${index + 1}Score` as keyof typeof newProblem
                        return (
                          <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 items-center">
                            <Label className="text-xs sm:text-sm">{label}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newProblem[scoreKey]}
                              onChange={(e) => {
                                const value = e.target.value
                                if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                                  setNewProblem({ ...newProblem, [scoreKey]: value })
                                }
                              }}
                              placeholder="点数"
                              className="text-sm sm:text-base h-9 sm:h-10"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {newProblem.questionType === "free_text" && (
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
                    onClick={() => setIsAddProblemOpen(false)}
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                  >
                    キャンセル
                  </Button>
                  <Button 
                    onClick={handleCreateProblem}
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
      <CardContent className="p-0 sm:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap w-[72px]">順序</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap min-w-[200px] sm:min-w-[300px]">
                  問題文
                </TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">カテゴリ</TableHead>
                <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {problems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  問題が登録されていません
                </TableCell>
              </TableRow>
            ) : (
              problems.map((problem, index) => (
                <TableRow 
                  key={problem.id}
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
                  <TableCell className="max-w-xs truncate">{problem.questionText}</TableCell>
                  <TableCell>{problem.category}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(problem)}
                        className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                      >
                        <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProblem(String(problem.id))}
                        className="h-8 w-8 p-0 sm:h-9 sm:w-9"
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

        <Dialog 
          open={!!editingProblem} 
          onOpenChange={(open) => {
            if (!open) {
              setEditingProblem(null)
            }
          }}
        >
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {editingProblem && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">問題編集</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">問題情報を編集してください</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm sm:text-base">問題文 *</Label>
                    <Textarea
                      value={editingProblem.questionText}
                      onChange={(e) => setEditingProblem({ ...editingProblem, questionText: e.target.value })}
                      rows={3}
                      className="text-sm sm:text-base min-h-[80px] sm:min-h-[100px]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm sm:text-base">問題タイプ *</Label>
                    <Select
                      value={editingProblem.questionType || "single_choice"}
                      onValueChange={(value: "single_choice" | "free_text") => 
                        setEditingProblem({ ...editingProblem, questionType: value, category: value === "free_text" ? "" : editingProblem.category })
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
                  {editingProblem.questionType === "single_choice" && (
                    <div>
                      <Label className="text-sm sm:text-base">カテゴリ *</Label>
                      <Select
                        value={editingProblem.category}
                        onValueChange={(value) => setEditingProblem({ ...editingProblem, category: value })}
                      >
                        <SelectTrigger className="text-sm sm:text-base h-10 sm:h-11">
                          <SelectValue placeholder="カテゴリを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-sm sm:text-base">
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {editingProblem.questionType === "single_choice" && (
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">回答に対する点数設定</Label>
                      {answerLabels.map((label, index) => {
                        const scoreKey = `answer${index + 1}Score` as keyof typeof editingProblem
                        return (
                          <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 items-center">
                            <Label className="text-xs sm:text-sm">{label}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingProblem[scoreKey] || ""}
                              onChange={(e) => {
                                const value = e.target.value
                                if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                                  setEditingProblem({ ...editingProblem, [scoreKey]: value })
                                }
                              }}
                              placeholder="点数"
                              className="text-sm sm:text-base h-9 sm:h-10"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {editingProblem.questionType === "free_text" && (
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
                    onClick={() => setEditingProblem(null)}
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                  >
                    キャンセル
                  </Button>
                  <Button 
                    onClick={handleUpdateProblem}
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                  >
                    更新
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

