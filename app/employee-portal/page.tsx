"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, AlertCircle, Clock, TrendingUp } from "lucide-react"
import api from "@/lib/api-client"

export default function EmployeePortal() {
  const [surveyStatus, setSurveyStatus] = useState<{
    completed: number
    total: number
    lastCompleted: string
  }>({
    completed: 0,
    total: 0,
    lastCompleted: "-",
  })
  const [surveyAvailable, setSurveyAvailable] = useState<boolean | null>(null)
  const [surveyMessage, setSurveyMessage] = useState<string>("")
  const [activeOrgSurveyId, setActiveOrgSurveyId] = useState<string | null>(null)
  const [orgSurveyProgress, setOrgSurveyProgress] = useState<{
    total: number
    answered: number
    completed: boolean
  }>({
    total: 0,
    answered: 0,
    completed: false,
  })
  const [growthSurveyInfo, setGrowthSurveyInfo] = useState({
    available: false,
    total: 0,
    progress: 0,
    completed: false,
    message: "",
  })
  const [growthSurveyLoading, setGrowthSurveyLoading] = useState(true)

  useEffect(() => {
    const checkSurveyPeriod = async () => {
      try {
        const response = await api.surveyPeriodApi.checkAvailability("organizational")
        if (response?.success) {
          setSurveyAvailable(response.available)
          setSurveyMessage(response.message || "")
          if (response.available && response.survey?.id) {
            setActiveOrgSurveyId(response.survey.id)
          } else {
            setActiveOrgSurveyId(null)
          }
        } else {
          setSurveyAvailable(false)
          setSurveyMessage("サーベイ期間の確認に失敗しました")
          setActiveOrgSurveyId(null)
        }
      } catch (error: any) {
                setSurveyAvailable(false)
        setSurveyMessage("サーベイ期間の確認に失敗しました")
        setActiveOrgSurveyId(null)
      }
    }

    checkSurveyPeriod()
  }, [])

  // Load overall survey participation status
  useEffect(() => {
    const loadSurveyStatus = async () => {
      try {
        const res = await api.my.surveyParticipation()
        if (!res?.success) return

        const org = res.organizational
        const completed = org?.completed ?? 0
        const total = org?.total ?? 0

        let last = "-"
        if (org?.lastCompletedAt) {
          const d = new Date(org.lastCompletedAt)
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear()
            const m = d.getMonth() + 1
            const day = d.getDate()
            last = `${y}年${m}月${day}日`
          }
        }

        setSurveyStatus({
          completed,
          total,
          lastCompleted: last,
        })
      } catch (error) {
                setSurveyStatus({
          completed: 0,
          total: 0,
          lastCompleted: "-",
        })
      }
    }

    loadSurveyStatus()
  }, [])

  useEffect(() => {
    const fetchGrowthSurveyInfo = async () => {
      try {
        setGrowthSurveyLoading(true)
        const [periodRes, questionsRes, responsesRes] = await Promise.all([
          api.surveyPeriodApi.checkAvailability("growth"),
          api.growthSurvey.list(true),
          api.growthSurveyResponses.get(),
        ])

        const surveyPeriodAvailable = periodRes?.success && periodRes.available
        const total = surveyPeriodAvailable ? questionsRes?.questions?.length ?? 0 : 0
        const responsePayload = responsesRes?.response
        const progress = responsePayload?.progressCount ?? Math.min(responsePayload?.responses?.length || 0, total)

        setGrowthSurveyInfo({
          available: surveyPeriodAvailable && total > 0,
          total,
          progress,
          completed: Boolean(responsePayload?.completed),
          message: surveyPeriodAvailable
            ? total > 0
              ? ""
              : "現在、対象となるグロースサーベイはありません。"
            : "現在、グロースサーベイのサーベイ期間ではありません。",
        })
      } catch (error) {
                setGrowthSurveyInfo((prev) => ({
          ...prev,
          available: false,
          message: "グロースサーベイの取得に失敗しました",
        }))
      } finally {
        setGrowthSurveyLoading(false)
      }
    }

    fetchGrowthSurveyInfo()
  }, [])

  // Load organizational survey progress (回答済みの設問数)
  useEffect(() => {
    const loadOrgSurveyProgress = async () => {
      if (!activeOrgSurveyId) {
        setOrgSurveyProgress({ total: 0, answered: 0, completed: false })
        return
      }

      try {
        const [problemsRes, resultsRes, freeTextRes] = await Promise.all([
          api.problems.listPublic(),
          api.organizationalSurveyResults.get(activeOrgSurveyId),
          api.organizationalSurveyResults.getFreeTextResponses(activeOrgSurveyId),
        ])

        const total =
          problemsRes?.success && Array.isArray(problemsRes.problems)
            ? problemsRes.problems.length
            : 0

        let answered = 0
        let completed = false
        const answeredIds = new Set<number>()

        // Count single choice responses
        if (
          resultsRes?.success &&
          Array.isArray(resultsRes.results) &&
          resultsRes.results.length > 0
        ) {
          const savedResult = resultsRes.results[0]
          const savedResponse = savedResult.response || []
          for (const item of savedResponse) {
            if (item.questionId != null) {
              const idNum = Number(item.questionId)
              if (Number.isFinite(idNum)) answeredIds.add(idNum)
            }
          }
        }

        // Count free text responses
        if (freeTextRes?.success && Array.isArray(freeTextRes.responses)) {
          for (const item of freeTextRes.responses) {
            if (item.questionId != null) {
              answeredIds.add(item.questionId)
            }
          }
        }

        answered = answeredIds.size
        completed = total > 0 && answered >= total

        setOrgSurveyProgress({ total, answered, completed })
      } catch (error) {
                setOrgSurveyProgress({ total: 0, answered: 0, completed: false })
      }
    }

    loadOrgSurveyProgress()
    
    // Refresh progress every 5 seconds to keep it up to date
    const interval = setInterval(loadOrgSurveyProgress, 5000)
    return () => clearInterval(interval)
  }, [activeOrgSurveyId])

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="p-3 sm:p-4 md:p-8 w-full">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-foreground mb-2">従業員ポータル</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              サーベイに参加して、組織の改善に貢献してください
            </p>
          </div>

          {/* Survey Entry Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-4 sm:pb-4">
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2 mb-2">
                  <FileText className="h-6 w-6 text-primary" />
                  ソシキサーベイに回答する
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/employee-survey" className="block">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base sm:text-lg py-6"
                    disabled={surveyAvailable === false}
                  >
                    ソシキサーベイを開始する
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-4 sm:pb-4">
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2 mb-2">
                  <FileText className="h-6 w-6 text-primary" />
                 グロースサーベイに回答する
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/growth-survey" className="block">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base sm:text-lg py-6"
                    disabled={growthSurveyLoading || !growthSurveyInfo.available}
                  >
                   グロースサーベイを開始する
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Survey Status */}
          <Card>
            <CardHeader className="pb-3 sm:pb-2">
              <CardTitle className="text-lg sm:text-xl">サーベイ参加状況</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">ソシキサーベイの回答状況</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    {orgSurveyProgress.answered}/{orgSurveyProgress.total}
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                    {surveyAvailable === false
                      ? surveyMessage || "現在、ソシキサーベイのサーベイ期間ではありません。"
                      : orgSurveyProgress.total > 0
                        ? "現在、ソシキサーベイに参加できます。"
                        : "現在、対象となるソシキサーベイはありません。"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">グロースサーベイの回答状況</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    {growthSurveyInfo.progress}/{growthSurveyInfo.total || 0}
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                    {growthSurveyLoading
                      ? "グロースサーベイの情報を読み込み中です。"
                      : growthSurveyInfo.available
                        ? "現在、グロースサーベイに参加できます。"
                        : growthSurveyInfo.message || "現在、グロースサーベイのサーベイ期間ではありません。"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">最終参加日</p>
                  <p className="text-lg sm:text-xl font-medium text-foreground">{surveyStatus.lastCompleted}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Information */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                ご注意
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">• このサーベイは組織の改善を目的としています</p>
              <p className="text-muted-foreground">• あなたの回答は匿名で処理されます</p>
              <p className="text-muted-foreground">• 一度送信した回答は変更できません</p>
              <p className="text-muted-foreground">• ご不明な点は管理者にお問い合わせください</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
