"use client"

import { useState, useEffect } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react"
import api from "@/lib/api-client"
import { toast } from "@/lib/toast"
import type { Survey } from "@/lib/types"

const SURVEY_TYPE_OPTIONS = [
  { value: "organizational", label: "ソシキサーベイ" },
  { value: "growth", label: "グロースサーベイ" },
] as const

function getSurveyTypeLabel(value?: string) {
  const option = SURVEY_TYPE_OPTIONS.find((opt) => opt.value === value)
  return option ? option.label : "ソシキサーベイ"
}

export function SurveyPeriodSection() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddSurveyOpen, setIsAddSurveyOpen] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [newSurvey, setNewSurvey] = useState({
    name: "",
    startDate: "",
    endDate: "",
    surveyType: "organizational",
  })

  useEffect(() => {
    fetchSurveys()
  }, [])

  const fetchSurveys = async () => {
    try {
      setIsLoading(true)
      const response = await api.surveys.list()
      if (response?.success && response.surveys) {
        setSurveys(response.surveys)
      } else {
        setSurveys([])
      }
    } catch (error: any) {
            toast.error("サーベイ一覧の取得に失敗しました")
      setSurveys([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSurvey = async () => {
    if (!newSurvey.name || !newSurvey.startDate || !newSurvey.endDate || !newSurvey.surveyType) {
      toast.error("すべての項目を入力してください")
      return
    }

    if (new Date(newSurvey.startDate) > new Date(newSurvey.endDate)) {
      toast.error("開始日は終了日より前である必要があります")
      return
    }

    try {
      const response = await api.surveys.create({
        name: newSurvey.name,
        startDate: newSurvey.startDate,
        endDate: newSurvey.endDate,
        surveyType: newSurvey.surveyType,
      })

      if (response?.success) {
        toast.success("サーベイ期間を設定しました")
        setIsAddSurveyOpen(false)
        setNewSurvey({ name: "", startDate: "", endDate: "", surveyType: "organizational" })
        fetchSurveys()
      } else {
        toast.error(response?.error || "サーベイ期間の設定に失敗しました")
      }
    } catch (error: any) {
            toast.error("サーベイ期間の設定に失敗しました")
    }
  }

  const handleUpdateSurvey = async () => {
    if (
      !editingSurvey ||
      !editingSurvey.name ||
      !editingSurvey.startDate ||
      !editingSurvey.endDate ||
      !editingSurvey.surveyType
    ) {
      toast.error("すべての項目を入力してください")
      return
    }

    if (new Date(editingSurvey.startDate) > new Date(editingSurvey.endDate)) {
      toast.error("開始日は終了日より前である必要があります")
      return
    }

    try {
      const response = await api.surveys.update(String(editingSurvey.id), {
        name: editingSurvey.name,
        startDate: editingSurvey.startDate,
        endDate: editingSurvey.endDate,
        status: editingSurvey.status,
        surveyType: editingSurvey.surveyType,
      })

      if (response?.success) {
        toast.success("サーベイ期間を更新しました")
        setEditingSurvey(null)
        fetchSurveys()
      } else {
        toast.error(response?.error || "サーベイ期間の更新に失敗しました")
      }
    } catch (error: any) {
            toast.error("サーベイ期間の更新に失敗しました")
    }
  }

  const handleDeleteSurvey = async (surveyId: string) => {
    toast.info("サーベイ期間を削除しています…")
    try {
      const response = await api.surveys.delete(surveyId)
      if (response?.success) {
        toast.success("サーベイ期間を削除しました")
        fetchSurveys()
      } else {
        toast.error(response?.error || "サーベイ期間の削除に失敗しました")
      }
    } catch (error: any) {
            toast.error("サーベイ期間の削除に失敗しました")
    }
  }

  const isSurveyActive = (survey: any) => {
    const now = new Date()
    const startDate = new Date(survey.startDate)
    const endDate = new Date(survey.endDate)
    endDate.setHours(23, 59, 59, 999) // End of day
    
    return survey.status === 'active' && now >= startDate && now <= endDate
  }

  const isSurveyUpcoming = (survey: any) => {
    const now = new Date()
    const startDate = new Date(survey.startDate)
    
    return survey.status === 'active' && now < startDate
  }

  const isSurveyPast = (survey: any) => {
    const now = new Date()
    const endDate = new Date(survey.endDate)
    endDate.setHours(23, 59, 59, 999)
    
    return now > endDate || survey.status === 'inactive' || survey.status === 'completed'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">読み込み中...</div>
        </CardContent>
      </Card>
    )
  }

  const handleRefresh = async () => {
    await fetchSurveys()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base sm:text-lg">サーベイ期間管理</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              従業員がサーベイに参加できる期間を設定できます
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-9 w-9 p-0 flex-shrink-0"
              title="更新"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={isAddSurveyOpen} onOpenChange={setIsAddSurveyOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  新規サーベイ期間設定
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">新規サーベイ期間設定</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  サーベイ期間の開始日と終了日を設定してください
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">サーベイ期間名 *</Label>
                  <Input
                    value={newSurvey.name}
                    onChange={(e) => setNewSurvey({ ...newSurvey, name: e.target.value })}
                    placeholder="例: 2025年4月"
                    className="text-sm sm:text-base h-10 sm:h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">サーベイ区分 *</Label>
                  <select
                    className="flex h-10 sm:h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background"
                    value={newSurvey.surveyType}
                    onChange={(e) => setNewSurvey({ ...newSurvey, surveyType: e.target.value })}
                  >
                    {SURVEY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">開始日 *</Label>
                    <Input
                      type="date"
                      value={newSurvey.startDate}
                      onChange={(e) => setNewSurvey({ ...newSurvey, startDate: e.target.value })}
                      placeholder="年-月-日"
                      pattern="\d{4}-\d{2}-\d{2}"
                      className="text-sm sm:text-base h-10 sm:h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">終了日 *</Label>
                    <Input
                      type="date"
                      value={newSurvey.endDate}
                      onChange={(e) => setNewSurvey({ ...newSurvey, endDate: e.target.value })}
                      placeholder="年-月-日"
                      pattern="\d{4}-\d{2}-\d{2}"
                      className="text-sm sm:text-base h-10 sm:h-11"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddSurveyOpen(false)}
                  className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                >
                  キャンセル
                </Button>
                <Button 
                  onClick={handleCreateSurvey}
                  className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                >
                  設定
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
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">サーベイ期間名</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">区分</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">開始日</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">終了日</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">ステータス</TableHead>
                <TableHead className="text-right text-xs sm:text-sm whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {surveys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  サーベイ期間が設定されていません
                </TableCell>
              </TableRow>
            ) : (
              surveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell className="font-medium">{survey.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getSurveyTypeLabel(survey.surveyType)}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(survey.startDate)}</TableCell>
                  <TableCell>{formatDate(survey.endDate)}</TableCell>
                  <TableCell>
                    {isSurveyActive(survey) ? (
                      <Badge className="bg-green-500">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        実施中
                      </Badge>
                    ) : isSurveyUpcoming(survey) ? (
                      <Badge className="bg-blue-500">
                        <Clock className="mr-1 h-3 w-3" />
                        予定
                      </Badge>
                    ) : isSurveyPast(survey) ? (
                      <Badge variant="outline">
                        <XCircle className="mr-1 h-3 w-3" />
                        終了
                      </Badge>
                    ) : (
                      <Badge variant="outline">非アクティブ</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditingSurvey({
                            ...survey,
                            surveyType: survey.surveyType || "organizational",
                          })
                        }
                        className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                      >
                        編集
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSurvey(String(survey.id))}
                        className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                      >
                        削除
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
          open={!!editingSurvey} 
          onOpenChange={(open) => {
            if (!open) {
              setEditingSurvey(null)
            }
          }}
        >
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {editingSurvey && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">サーベイ期間編集</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    サーベイ期間の情報を編集してください
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">サーベイ期間名 *</Label>
                    <Input
                      value={editingSurvey.name || ""}
                      onChange={(e) => setEditingSurvey({ ...editingSurvey, name: e.target.value })}
                      className="text-sm sm:text-base h-10 sm:h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">サーベイ区分 *</Label>
                    <select
                      className="flex h-10 sm:h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background"
                      value={editingSurvey.surveyType || "organizational"}
                      onChange={(e) => setEditingSurvey({ ...editingSurvey, surveyType: e.target.value as "organizational" | "growth" })}
                    >
                      {SURVEY_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">開始日 *</Label>
                      <Input
                        type="date"
                        value={editingSurvey.startDate || ""}
                        onChange={(e) => setEditingSurvey({ ...editingSurvey, startDate: e.target.value })}
                        placeholder="年-月-日"
                        pattern="\d{4}-\d{2}-\d{2}"
                        className="text-sm sm:text-base h-10 sm:h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">終了日 *</Label>
                      <Input
                        type="date"
                        value={editingSurvey.endDate || ""}
                        onChange={(e) => setEditingSurvey({ ...editingSurvey, endDate: e.target.value })}
                        placeholder="年-月-日"
                        pattern="\d{4}-\d{2}-\d{2}"
                        className="text-sm sm:text-base h-10 sm:h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">ステータス</Label>
                    <select
                      className="flex h-10 sm:h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background"
                      value={editingSurvey.status || "active"}
                      onChange={(e) => setEditingSurvey({ ...editingSurvey, status: e.target.value as "active" | "completed" | "draft" })}
                    >
                      <option value="active">アクティブ</option>
                      <option value="inactive">非アクティブ</option>
                      <option value="completed">完了</option>
                    </select>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingSurvey(null)}
                    className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                  >
                    キャンセル
                  </Button>
                  <Button 
                    onClick={handleUpdateSurvey}
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

