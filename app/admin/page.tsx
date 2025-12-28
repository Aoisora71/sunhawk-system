"use client"

import { useState, useEffect, useMemo } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Survey, User } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Badge } from "@/components/ui/badge"
import { Users, FileText, Plus, Edit, Trash2, Mail, Building2, CheckCircle2, TrendingUp, Calendar, ClipboardList, Settings } from "lucide-react"
import { OrganizationSection } from "./organization-section"
import { ProblemBankSection } from "./problem-bank-section"
import { SurveyPeriodSection } from "./survey-period-section"
import { SurveyResponseStatusSection } from "./survey-response-status-section"
import { GrowthSurveySection } from "./growth-survey-section"
import { SystemManagementSection } from "./system-management-section"

// Sample data
const surveyPeriods = [
  {
    id: "2025-01",
    name: "2025年1月",
    status: "active",
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    responseRate: 94,
  },
  {
    id: "2024-10",
    name: "2024年10月",
    status: "completed",
    startDate: "2024-10-01",
    endDate: "2024-10-31",
    responseRate: 91,
  },
  {
    id: "2024-07",
    name: "2024年7月",
    status: "completed",
    startDate: "2024-07-01",
    endDate: "2024-07-31",
    responseRate: 88,
  },
]

export default function AdminPage() {
  const [isAddSurveyOpen, setIsAddSurveyOpen] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState<string>("")
  const [employeeCount, setEmployeeCount] = useState<number>(0)
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [activeSurveys, setActiveSurveys] = useState<number>(0)
  const [surveyResponseRate, setSurveyResponseRate] = useState<number>(0)
  const [allEmployees, setAllEmployees] = useState<User[]>([])
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  // Authorization is handled server-side via layout.tsx
  // No need for client-side checks (security improvement)
  useEffect(() => {
    setIsAuthorized(true) // Layout already verified admin access
    fetchLoggedInUser()
    fetchEmployeeCount()
    fetchEmployees()
    fetchSurveys()
    fetchSurveyResponseRate(true)
  }, [])

  // Refresh response rate periodically (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      // Cookies are automatically sent with requests
      fetchSurveyResponseRate(true)
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  const fetchLoggedInUser = async () => {
    try {
      // Get current user from server (cookies are automatically sent)
      const response = await fetch("/api/auth/me")

      if (response.ok) {
        const data = await response.json()
        if (data?.success && data?.user) {
          setLoggedInUser(data.user.name || data.user.email)
        }
      }
    } catch (error) {
          }
  }

  const fetchEmployeeCount = async () => {
    try {
      // Cookies are automatically sent with requests
      const response = await fetch("/api/employees", {
        headers: {},
      })

      if (response.ok) {
        const data = await response.json()
        setEmployeeCount(data.employees?.length || 0)
      }
    } catch (error) {
          }
  }

  const fetchEmployees = async () => {
    try {
      // Cookies are automatically sent with requests
      const res = await fetch("/api/employees", { headers: {} })
      if (res.ok) {
        const data = await res.json()
        setAllEmployees(data.employees || [])
      }
    } catch (e) {
          }
  }

  // Helper function to calculate actual survey status based on dates (same as SurveyResponseStatusSection)
  const calculateSurveyStatus = (survey: any): { status: string; label: string; color: string } => {
    const now = new Date()
    const startDate = new Date(survey.startDate)
    const endDate = new Date(survey.endDate)
    
    // Set endDate to end of day (23:59:59.999) to include the full day
    endDate.setHours(23, 59, 59, 999)
    
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

  const loadSurveys = async () => {
    // Cookies are automatically sent with requests
    const res = await fetch("/api/surveys", {
      headers: {},
    })

    // /api/surveys は管理者専用APIなので、従業員でアクセスした場合は 403 になる。
    // その場合はエラーを投げず、空配列を返してダッシュボードの詳細だけ抑制する。
    if (res.status === 403) {
      return []
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText)
      throw new Error(`GET /api/surveys failed (${res.status}): ${errorText}`)
    }

    const data = await res.json()
    if (!data.success || !Array.isArray(data.surveys)) {
      throw new Error("GET /api/surveys returned invalid payload")
    }
    return data.surveys as Survey[]
  }

  const fetchSurveys = async () => {
    try {
      // Cookies are automatically sent with requests
      const surveysData = await loadSurveys()
      setSurveys(surveysData)
      
      // Calculate active surveys using the same logic as SurveyResponseStatusSection
      // Count surveys with status "active" (current date is between start and end date)
      const surveysWithStatus = surveysData.map((survey: any) => {
        const status = calculateSurveyStatus(survey)
        return { ...survey, actualStatus: status.status }
      })
      
      const activeCount = surveysWithStatus.filter((survey: any) => survey.actualStatus === "active").length
      
            setActiveSurveys(activeCount)
    } catch (e) {
          }
  }

  const fetchSurveyResponseRate = async (forceReload = false) => {
    try {
      // Cookies are automatically sent with requests

      let surveysData = surveys
      if (!surveysData.length || forceReload) {
        try {
          // Cookies are automatically sent with requests
          surveysData = await loadSurveys()
          setSurveys(surveysData)
        } catch (err) {
                    setSurveyResponseRate(0)
          return
        }
      }
      
      // Find active surveys using the same logic as SurveyResponseStatusSection
      const surveysWithStatus = surveysData.map((survey: any) => {
        const status = calculateSurveyStatus(survey)
        return { ...survey, actualStatus: status.status }
      })
      
      // Sort by actual status (active first, then scheduled, then ended), then by date - same as SurveyResponseStatusSection
      const sortedSurveys = surveysWithStatus.sort((a: any, b: any) => {
        const statusOrder = { active: 0, scheduled: 1, ended: 2, inactive: 3, unknown: 4 }
        const aOrder = statusOrder[a.actualStatus as keyof typeof statusOrder] ?? 999
        const bOrder = statusOrder[b.actualStatus as keyof typeof statusOrder] ?? 999
        
        if (aOrder !== bOrder) return aOrder - bOrder
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      })
      
      // Use the same selection logic as SurveyResponseStatusSection: first active survey, or first survey if none are active
      const activeSurvey = sortedSurveys.find((s: any) => s.actualStatus === "active")
      const targetSurvey = activeSurvey || (sortedSurveys.length > 0 ? sortedSurveys[0] : null)

      if (!targetSurvey) {
        setSurveyResponseRate(0)
        return
      }

      // Get response status for this survey (same API call as SurveyResponseStatusSection)
      // Cookies are automatically sent with requests
      const responseStatusRes = await fetch(`/api/survey-response-status?surveyId=${targetSurvey.id}`, {
        headers: {},
      })

      if (responseStatusRes.ok) {
        const responseStatusData = await responseStatusRes.json()
                
        if (responseStatusData.success && responseStatusData.employees) {
          // Use the same stats as SurveyResponseStatusSection
          const totalEmployees = responseStatusData.totalEmployees || 0
          const respondedCount = responseStatusData.respondedCount || 0 // Users with 100% response rate
          
          // Calculate response rate: (respondedCount / totalEmployees) * 100
          // Same calculation as SurveyResponseStatusSection would show
          const rate = totalEmployees > 0 
            ? Math.round((respondedCount / totalEmployees) * 100 * 10) / 10 
            : 0
          
                    setSurveyResponseRate(rate)
        } else {
                    setSurveyResponseRate(0)
        }
      } else {
        const errorText = await responseStatusRes.text()
                setSurveyResponseRate(0)
      }
    } catch (e) {
            setSurveyResponseRate(0)
    }
  }

  // Show loading state while checking authorization
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">認証を確認しています...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authorized (redirect will happen)
  if (isAuthorized === false) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex flex-col md:flex-row">
        <DashboardNav />
        <main className="flex-1 p-3 sm:p-4 md:p-8 w-full overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground mb-1 sm:mb-2">
                  管理画面
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                  システムの設定と組織管理
                </p>
              </div>
              {loggedInUser && (
                <div className="text-left sm:text-right">
                  <p className="text-xs sm:text-sm text-muted-foreground">ログイン中:</p>
                  <p className="text-sm sm:text-base font-medium text-foreground break-words">
                    {loggedInUser}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2 sm:pb-3">
                  <CardDescription className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    登録従業員数
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground">
                      {employeeCount}名
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2 sm:pb-3">
                  <CardDescription className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    実施中のサーベイ数
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground">
                      {activeSurveys}件
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="organization" className="space-y-4 sm:space-y-6">
              <TabsList className="grid w-full grid-cols-3 gap-2 p-1.5 sm:p-2 h-auto bg-muted/50 rounded-lg">
                <TabsTrigger
                  value="organization"
                  className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2.5 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
                >
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
                  <span className="leading-tight text-center sm:text-left whitespace-nowrap">組織管理</span>
                </TabsTrigger>
                <TabsTrigger
                  value="surveys"
                  className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2.5 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
                >
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
                  <span className="leading-tight text-center sm:text-left whitespace-nowrap">サーベイ管理</span>
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2.5 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
                >
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
                  <span className="leading-tight text-center sm:text-left whitespace-nowrap">システム管理</span>
                </TabsTrigger>
              </TabsList>

              {/* Organization Management */}
              <TabsContent value="organization" className="space-y-4 sm:space-y-6">
                <OrganizationSection />
              </TabsContent>

              {/* Survey Management */}
              <TabsContent value="surveys" className="space-y-4 sm:space-y-6">
                <Tabs defaultValue="responses" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2 p-1.5 sm:p-2 h-auto bg-muted/50 rounded-lg">
                    <TabsTrigger
                      value="responses"
                      className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
                      <span className="leading-tight text-center whitespace-nowrap">
                        回答状況
                        <span className="hidden sm:inline">管理</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="period"
                      className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
                      <span className="leading-tight text-center whitespace-nowrap">
                        サーベイ期間
                        <span className="hidden sm:inline">管理</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="questions"
                      className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
                      <span className="leading-tight text-center whitespace-nowrap">
                        ソシキサーベイ
                        <span className="hidden sm:inline">管理</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="growth"
                      className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
                      <span className="leading-tight text-center whitespace-nowrap">
                       グロースサーベイ
                        <span className="hidden sm:inline">管理</span>
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="responses" className="space-y-4">
                    <SurveyResponseStatusSection />
                  </TabsContent>

                  <TabsContent value="period" className="space-y-4">
                    <SurveyPeriodSection />
                  </TabsContent>

                  <TabsContent value="questions" className="space-y-4">
                    <ProblemBankSection />
                  </TabsContent>

                  <TabsContent value="growth" className="space-y-4">
                    <GrowthSurveySection />
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* System Management */}
              <TabsContent value="system" className="space-y-4 sm:space-y-6">
                <SystemManagementSection />
              </TabsContent>

            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}
