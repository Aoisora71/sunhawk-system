"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Mail, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "@/lib/toast"
import api from "@/lib/api-client"
import type { Survey } from "@/lib/types"

interface EmployeeStatus {
  id: number
  name: string
  email: string
  departmentName: string
  jobName: string
  responseRate: number
  status: "not_responded" | "responding" | "responded"
  respondedAt: string | null
}

export function SurveyResponseStatusSection() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("")
  const [employees, setEmployees] = useState<EmployeeStatus[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [stats, setStats] = useState({
    totalEmployees: 0,
    respondedCount: 0,
    respondingCount: 0,
    notRespondedCount: 0,
  })

  useEffect(() => {
    fetchSurveys()
  }, [])

  useEffect(() => {
    if (selectedSurveyId) {
      fetchResponseStatus()
    } else {
      setEmployees([])
      setSelectedEmployeeIds(new Set())
      setStats({ totalEmployees: 0, respondedCount: 0, respondingCount: 0, notRespondedCount: 0 })
    }
  }, [selectedSurveyId])

  // Helper function to calculate actual survey status based on dates
  const calculateSurveyStatus = (survey: any): { status: string; label: string; color: string } => {
    const now = new Date()
    const startDate = new Date(survey.startDate)
    const endDate = new Date(survey.endDate)
    
    // If dates are invalid, use stored status
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return {
        status: survey.status || "unknown",
        label: survey.status === "active" ? "実施中" : survey.status === "inactive" ? "終了" : "不明",
        color: survey.status === "active" ? "text-green-600" : "text-gray-600"
      }
    }
    
    // Calculate actual status based on current date
    if (now < startDate) {
      return {
        status: "scheduled",
        label: "予定",
        color: "text-blue-600"
      }
    } else if (now >= startDate && now <= endDate) {
      return {
        status: "active",
        label: "実施中",
        color: "text-green-600"
      }
    } else {
      return {
        status: "ended",
        label: "終了",
        color: "text-gray-600"
      }
    }
  }

  const fetchSurveys = async () => {
    try {
      // Authorization is checked server-side via layout, no need for client-side check
      const response = await api.surveys.list()
      if (response?.success && response.surveys) {
        // Calculate actual status for each survey and add it
        const surveysWithActualStatus = response.surveys.map((survey: any) => {
          const actualStatus = calculateSurveyStatus(survey)
          return {
            ...survey,
            actualStatus: actualStatus.status,
            statusLabel: actualStatus.label,
            statusColor: actualStatus.color,
          }
        })
        
        const sortedSurveys = surveysWithActualStatus.sort((a: any, b: any) => {
          // Sort by actual status (active first, then scheduled, then ended), then by date
          const statusOrder = { active: 0, scheduled: 1, ended: 2, inactive: 3, unknown: 4 }
          const aOrder = statusOrder[a.actualStatus as keyof typeof statusOrder] ?? 999
          const bOrder = statusOrder[b.actualStatus as keyof typeof statusOrder] ?? 999
          
          if (aOrder !== bOrder) return aOrder - bOrder
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        })
        
        setSurveys(sortedSurveys)
        
        // Auto-select first active survey if available, otherwise first survey
        const activeSurvey = sortedSurveys.find((s: any) => s.actualStatus === "active")
        if (activeSurvey) {
          const surveyIdString = String(activeSurvey.id)
          console.log('[Survey Response Status] Auto-selecting active survey:', {
            id: activeSurvey.id,
            idString: surveyIdString,
            name: activeSurvey.name,
            status: activeSurvey.actualStatus
          })
          setSelectedSurveyId(surveyIdString)
        } else if (sortedSurveys.length > 0) {
          const surveyIdString = String(sortedSurveys[0].id)
          console.log('[Survey Response Status] Auto-selecting first survey:', {
            id: sortedSurveys[0].id,
            idString: surveyIdString,
            name: sortedSurveys[0].name,
            status: sortedSurveys[0].actualStatus
          })
          setSelectedSurveyId(surveyIdString)
        } else {
          console.log('[Survey Response Status] No surveys available')
        }
      }
    } catch (error: any) {
      console.error("Error fetching surveys:", error)
      toast.error("サーベイの取得に失敗しました")
    }
  }

  const fetchResponseStatus = async () => {
    if (!selectedSurveyId) return

    try {
      setIsLoading(true)
      // Cookies are automatically sent with requests
      const response = await fetch(`/api/survey-response-status?surveyId=${selectedSurveyId}`, {
        headers: {},
      })
      const data = await response.json()

      console.log('[Frontend] Response status data received:', {
        success: data.success,
        employeeCount: data.employees?.length || 0,
        sampleEmployee: data.employees?.[0] || null,
        stats: data.totalEmployees ? {
          total: data.totalEmployees,
          responded: data.respondedCount,
          responding: data.respondingCount,
          notResponded: data.notRespondedCount,
        } : null
      })

      if (data.success && data.employees) {
        // Log first few employees to verify data
        console.log('[Frontend] Sample employees:', data.employees.slice(0, 5).map((emp: EmployeeStatus) => ({
          id: emp.id,
          name: emp.name,
          responseRate: emp.responseRate,
          status: emp.status
        })))
        
        setEmployees(data.employees)
        setStats({
          totalEmployees: data.totalEmployees || 0,
          respondedCount: data.respondedCount || 0,
          respondingCount: data.respondingCount || 0,
          notRespondedCount: data.notRespondedCount || 0,
        })

        // Auto-select all non-responders
        const nonResponderIds = data.employees
          .filter((emp: EmployeeStatus) => emp.status === "not_responded")
          .map((emp: EmployeeStatus) => emp.id)
        setSelectedEmployeeIds(new Set(nonResponderIds))
      } else {
        console.error('[Frontend] Failed to fetch response status:', data)
        toast.error(data.error || "回答状況の取得に失敗しました")
      }
    } catch (error: any) {
      console.error("Error fetching response status:", error)
      toast.error("回答状況の取得に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectEmployee = (employeeId: number, checked: boolean) => {
    setSelectedEmployeeIds((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(employeeId)
      } else {
        newSet.delete(employeeId)
      }
      return newSet
    })
  }

  const handleSelectAllNonResponders = () => {
    const nonResponderIds = employees
      .filter((emp) => emp.status === "not_responded")
      .map((emp) => emp.id)
    setSelectedEmployeeIds(new Set(nonResponderIds))
  }

  const handleDeselectAll = () => {
    setSelectedEmployeeIds(new Set())
  }

  const handleSendNotification = async () => {
    if (selectedEmployeeIds.size === 0) {
      toast.error("通知を送信する従業員を選択してください")
      return
    }

    setIsSending(true)
    try {
      // Cookies are automatically sent with requests
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surveyId: selectedSurveyId,
          userIds: Array.from(selectedEmployeeIds),
          message: notificationMessage || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message || "通知を送信しました")
        setIsNotificationDialogOpen(false)
        setNotificationMessage("")
        setSelectedEmployeeIds(new Set())
      } else {
        toast.error(data.error || "通知の送信に失敗しました")
      }
    } catch (error: any) {
      console.error("Error sending notification:", error)
      toast.error("通知の送信に失敗しました")
    } finally {
      setIsSending(false)
    }
  }

  const nonResponders = employees.filter((emp) => emp.status === "not_responded")
  const selectedNonResponders = nonResponders.filter((emp) => selectedEmployeeIds.has(emp.id))

  const handleRefresh = async () => {
    await fetchSurveys()
    if (selectedSurveyId) {
      await fetchResponseStatus()
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base sm:text-lg">回答状況管理</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              従業員のサーベイ回答状況を確認し、未回答者に通知を送信できます
            </CardDescription>
          </div>
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        {/* Survey Selection */}
        <div className="space-y-2">
          <Label className="text-sm sm:text-base">サーベイ期間を選択</Label>
          <Select 
            value={selectedSurveyId || undefined} 
            onValueChange={(value) => {
              console.log('[Survey Response Status] Survey selection changed:', value)
              setSelectedSurveyId(value)
            }}
          >
            <SelectTrigger className="!w-full !whitespace-normal text-[11px] sm:text-sm h-10 sm:h-11 min-w-0 max-w-full px-2 sm:px-3 *:data-[slot=select-value]:truncate *:data-[slot=select-value]:max-w-[calc(100%-2.5rem)] *:data-[slot=select-value]:text-left *:data-[slot=select-value]:block">
              <SelectValue placeholder={surveys.length === 0 ? "サーベイを読み込み中..." : "サーベイ期間を選択"} />
            </SelectTrigger>
            <SelectContent className="max-h-[60vh] w-[var(--radix-select-trigger-width)]">
              {surveys.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">サーベイを読み込み中...</div>
              ) : (
                surveys.map((survey) => {
                const statusInfo = calculateSurveyStatus(survey)
                const startDate = new Date(survey.startDate).toLocaleDateString('ja-JP', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })
                const endDate = new Date(survey.endDate).toLocaleDateString('ja-JP', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })
                const surveyTypeLabel = survey.surveyType === 'growth' ? 'グロースサーベイ' : 'ソシキサーベイ'
                
                return (
                  <SelectItem key={survey.id} value={survey.id.toString()} className="text-xs sm:text-sm">
                    <div className="flex flex-col sm:block gap-0.5 sm:gap-0 min-w-0">
                      <span className="font-medium truncate">
                        [{surveyTypeLabel}] {survey.name} - {statusInfo.label}
                      </span>
                      <span className="text-muted-foreground text-[10px] sm:text-xs sm:ml-1 truncate">
                        ({startDate} ～ {endDate})
                      </span>
                    </div>
                  </SelectItem>
                )
              }))}
            </SelectContent>
          </Select>
        </div>

        {selectedSurveyId && (
          <>
            {/* Selected Survey Info */}
            {(() => {
              const selectedSurvey = surveys.find((s) => String(s.id) === String(selectedSurveyId))
              if (!selectedSurvey) return null
              
              const statusInfo = calculateSurveyStatus(selectedSurvey)
              const startDate = new Date(selectedSurvey.startDate).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
              const endDate = new Date(selectedSurvey.endDate).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
              
              const surveyTypeLabel = selectedSurvey.surveyType === 'growth' ? 'グロースサーベイ' : 'ソシキサーベイ'
              
              return (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {surveyTypeLabel}
                        </Badge>
                        <h3 className="font-semibold text-lg">{selectedSurvey.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {startDate} ～ {endDate}
                      </p>
                    </div>
                    <Badge 
                      variant={statusInfo.status === "active" ? "default" : "outline"}
                      className={
                        statusInfo.status === "active" 
                          ? "bg-green-500 text-white" 
                          : statusInfo.status === "scheduled"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-500 text-white"
                      }
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>
              )
            })()}
            
            {/* Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="pb-2 p-3 sm:p-6">
                  <CardDescription className="text-xs sm:text-sm">総従業員数</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-xl sm:text-2xl font-bold">{stats.totalEmployees}名</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 p-3 sm:p-6">
                  <CardDescription className="text-xs sm:text-sm">回答済み</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.respondedCount}名</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 p-3 sm:p-6">
                  <CardDescription className="text-xs sm:text-sm">回答中</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.respondingCount}名</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 p-3 sm:p-6">
                  <CardDescription className="text-xs sm:text-sm">未回答</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-xl sm:text-2xl font-bold text-red-600">{stats.notRespondedCount}名</div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            {stats.notRespondedCount > 0 && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSelectAllNonResponders}
                  className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
                >
                  未回答者を全選択
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDeselectAll}
                  className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
                >
                  選択を解除
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsNotificationDialogOpen(true)}
                  disabled={selectedEmployeeIds.size === 0}
                  className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
                >
                  <Mail className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  通知を送信 ({selectedEmployeeIds.size}名)
                </Button>
              </div>
            )}

            {/* Employee Table */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm sm:text-base">読み込み中...</div>
            ) : employees.length > 0 ? (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 sm:w-12">
                        <Checkbox
                          checked={
                            nonResponders.length > 0 &&
                            nonResponders.every((emp) => selectedEmployeeIds.has(emp.id))
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleSelectAllNonResponders()
                            } else {
                              handleDeselectAll()
                            }
                          }}
                          className="h-4 w-4 sm:h-5 sm:w-5"
                        />
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">氏名</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap min-w-[150px] sm:min-w-[200px]">
                        メールアドレス
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">部門</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">職位</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">回答状況</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">回答率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>
                          {emp.status === "not_responded" && (
                            <Checkbox
                              checked={selectedEmployeeIds.has(emp.id)}
                              onCheckedChange={(checked) => handleSelectEmployee(emp.id, checked as boolean)}
                              className="h-4 w-4 sm:h-5 sm:w-5"
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm">{emp.name}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{emp.email}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{emp.departmentName}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{emp.jobName}</TableCell>
                        <TableCell>
                          {emp.status === "responded" ? (
                            <Badge variant="default" className="bg-green-500 text-xs sm:text-sm">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              回答済み
                            </Badge>
                          ) : emp.status === "responding" ? (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400 text-xs sm:text-sm">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              回答中
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs sm:text-sm">
                              <XCircle className="mr-1 h-3 w-3" />
                              未回答
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs sm:text-sm font-medium">
                            {typeof emp.responseRate === 'number' 
                              ? `${emp.responseRate.toFixed(1)}%` 
                              : '0.0%'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">従業員が見つかりません</div>
            )}
          </>
        )}

        {/* Notification Dialog */}
        <Dialog open={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">通知を送信</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {selectedEmployeeIds.size}名の従業員に通知を送信します。カスタムメッセージを入力するか、デフォルトメッセージを使用してください。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">送信先</Label>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {selectedEmployeeIds.size}名の従業員に送信
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notification-message" className="text-sm sm:text-base">メッセージ（オプション）</Label>
                <Textarea
                  id="notification-message"
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="デフォルトメッセージを使用する場合は空白のままにしてください"
                  rows={6}
                  className="text-sm sm:text-base min-h-[120px] sm:min-h-[150px]"
                />
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ※空白の場合は、サーベイ名と期間を含むデフォルトメッセージが送信されます
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={() => setIsNotificationDialogOpen(false)}
                className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
              >
                キャンセル
              </Button>
              <Button 
                onClick={handleSendNotification} 
                disabled={isSending}
                className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
              >
                {isSending ? "送信中..." : "通知を送信"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

