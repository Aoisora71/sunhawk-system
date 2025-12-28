"use client"

import { useEffect, useState, useMemo } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, TrendingUp, Users, Target, ArrowUp, ArrowDown, Minus, ChevronDown, X } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import api from "@/lib/api-client"
import type { User, Department } from "@/lib/types"

export default function ReportsPage() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [historicalData, setHistoricalData] = useState<{ month: string; score: number }[]>([])
  const [departmentData, setDepartmentData] = useState<{ name: string; current: number | null; previous: number | null }[]>([])
  const [categoryData, setCategoryData] = useState<{ category: string; current: number | null; previous: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  // Authorization is handled server-side via layout.tsx
  // No need for client-side checks (security improvement)
  useEffect(() => {
    setIsAuthorized(true) // Layout already verified admin access
  }, [])

  useEffect(() => {
    const loadReportData = async () => {
      try {
        setLoading(true)

        // Load employees and departments
        // Cookies are automatically sent, no need for manual headers
        const [empRes, deptRes] = await Promise.all([
          fetch("/api/employees", { headers: {} }),
          fetch("/api/departments", { headers: {} }),
        ])

        if (empRes.ok) {
          const empData = await empRes.json().catch(() => null)
          if (empData?.success && Array.isArray(empData.employees)) {
            setEmployees(empData.employees)
          }
        }

        if (deptRes.ok) {
          const deptData = await deptRes.json().catch(() => null)
          if (deptData?.success && Array.isArray(deptData.departments)) {
            setDepartments(deptData.departments)
          }
        }

        // Get all organizational survey summaries
        const summaryRes = await api.organizationalSurveySummary.list(undefined, true)
        if (!summaryRes?.success || !Array.isArray(summaryRes.summaries) || summaryRes.summaries.length === 0) {
          setLoading(false)
          return
        }

        const summaries = summaryRes.summaries

        // Group by surveyId for historical trend
        const bySurvey = new Map<
          number,
          {
            summaries: any[]
            startDate: string | null
            endDate: string | null
          }
        >()

        summaries.forEach((row: any) => {
          const sid = Number(row.surveyId)
          if (!Number.isFinite(sid)) return
          if (!bySurvey.has(sid)) {
            bySurvey.set(sid, {
              summaries: [],
              startDate: row.startDate || row.start_date || null,
              endDate: row.endDate || row.end_date || null,
            })
          }
          bySurvey.get(sid)!.summaries.push(row)
          const start = row.startDate || row.start_date || null
          const end = row.endDate || row.end_date || null
          const entry = bySurvey.get(sid)!
          if (start && (!entry.startDate || new Date(start) < new Date(entry.startDate))) {
            entry.startDate = start
          }
          if (end && (!entry.endDate || new Date(end) > new Date(entry.endDate))) {
            entry.endDate = end
          }
        })

        // Historical trend data
        const historical: { month: string; score: number }[] = []
        bySurvey.forEach((bucket, sid) => {
          if (!bucket.summaries.length) return
          const total = bucket.summaries.reduce((acc, s) => acc + (Number(s.totalScore ?? s.total_score ?? 0) || 0), 0)
          const avg = total / bucket.summaries.length
          const d = bucket.startDate ? new Date(bucket.startDate) : null
          const label =
            d != null
              ? `${d.getFullYear()}年${d.getMonth() + 1}月`
              : `ID:${sid}`
          historical.push({
            month: label,
            score: Number(avg.toFixed(1)),
          })
        })

        historical.sort((a, b) => {
          const parse = (s: string) => {
            const m = s.match(/^(\d{4})年(\d{1,2})月$/)
            if (!m) return 0
            return new Date(Number(m[1]), Number(m[2]) - 1, 1).getTime()
          }
          return parse(a.month) - parse(b.month)
        })

        setHistoricalData(historical)

        // Category data (current vs previous)
        const sortedSurveys = Array.from(bySurvey.entries()).sort((a, b) => {
          const aEnd = a[1].endDate ? new Date(a[1].endDate).getTime() : 0
          const bEnd = b[1].endDate ? new Date(b[1].endDate).getTime() : 0
          return bEnd - aEnd
        })

        const currentSurvey = sortedSurveys[0]
        const previousSurvey = sortedSurveys.length > 1 ? sortedSurveys[1] : null

        const computeCategoryAverages = (rows: any[]) => {
          const count = rows.length || 1
          const sums = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0,
          }

          rows.forEach((r) => {
            sums[1] += Number(r.category1Score ?? r.category1_score ?? 0)
            sums[2] += Number(r.category2Score ?? r.category2_score ?? 0)
            sums[3] += Number(r.category3Score ?? r.category3_score ?? 0)
            sums[4] += Number(r.category4Score ?? r.category4_score ?? 0)
            sums[5] += Number(r.category5Score ?? r.category5_score ?? 0)
            sums[6] += Number(r.category6Score ?? r.category6_score ?? 0)
            sums[7] += Number(r.category7Score ?? r.category7_score ?? 0)
            sums[8] += Number(r.category8Score ?? r.category8_score ?? 0)
          })

          return {
            1: sums[1] / count,
            2: sums[2] / count,
            3: sums[3] / count,
            4: sums[4] / count,
            5: sums[5] / count,
            6: sums[6] / count,
            7: sums[7] / count,
            8: sums[8] / count,
          }
        }

        const currentAverages = currentSurvey ? computeCategoryAverages(currentSurvey[1].summaries) : null
        const previousAverages = previousSurvey ? computeCategoryAverages(previousSurvey[1].summaries) : null

        const categories = [
          { id: 1, label: "変化意識" },
          { id: 2, label: "成果視点" },
          { id: 3, label: "行動優先意識" },
          { id: 4, label: "結果明確" },
          { id: 5, label: "自己評価意識" },
          { id: 6, label: "時感覚" },
          { id: 7, label: "組織内位置認識" },
          { id: 8, label: "免責意識" },
        ]

        const catData = categories.map((cat) => ({
          category: cat.label,
          current: currentAverages ? Number((currentAverages[cat.id as 1] ?? 0).toFixed(1)) : null,
          previous: previousAverages ? Number((previousAverages[cat.id as 1] ?? 0).toFixed(1)) : null,
        }))

        setCategoryData(catData)

        // Department data
        if (employees.length && departments.length) {
          const deptMeta = new Map<
            number,
            {
              name: string
              codeNum: number | null
            }
          >()
          departments.forEach((d: any) => {
            const idNum = Number(d.id)
            if (!Number.isFinite(idNum)) return
            const rawCode = d.code != null ? String(d.code).trim() : null
            const numeric = rawCode !== null && rawCode !== "" ? Number(rawCode) : NaN
            const codeNum = Number.isFinite(numeric) ? numeric : null
            deptMeta.set(idNum, {
              name: d.name || d.departmentName || "未設定",
              codeNum,
            })
          })

          const userDeptMeta = new Map<
            number,
            {
              name: string
              codeNum: number | null
            }
          >()
          employees.forEach((e: any) => {
            const userId = Number(e.id)
            const deptId = Number(e.departmentId)
            if (!Number.isFinite(userId) || !Number.isFinite(deptId)) return
            const meta = deptMeta.get(deptId)
            if (!meta) return
            userDeptMeta.set(userId, meta)
          })

          const computeDepartmentAverages = (rows: any[]) => {
            const deptAgg = new Map<
              string,
              {
                sum: number
                count: number
                codeNum: number | null
              }
            >()

            rows.forEach((r) => {
              const userId = Number(r.userId ?? r.user_id)
              if (!Number.isFinite(userId)) return
              const meta = userDeptMeta.get(userId)
              if (!meta) return
              if (meta.codeNum === null || meta.codeNum < 3) return
              const deptName = meta.name || "未設定"
              const totalScore = Number(r.totalScore ?? r.total_score ?? 0)
              if (!deptAgg.has(deptName)) {
                deptAgg.set(deptName, { sum: 0, count: 0, codeNum: meta.codeNum })
              }
              const entry = deptAgg.get(deptName)!
              entry.sum += totalScore
              entry.count += 1
              if (
                meta.codeNum !== null &&
                (entry.codeNum === null || (entry.codeNum as number) > (meta.codeNum as number))
              ) {
                entry.codeNum = meta.codeNum
              }
            })

            const result = new Map<
              string,
              {
                avg: number
                codeNum: number | null
              }
            >()

            deptAgg.forEach((v, key) => {
              if (v.count > 0) {
                result.set(key, {
                  avg: Number((v.sum / v.count).toFixed(1)),
                  codeNum: v.codeNum,
                })
              }
            })

            return result
          }

          const currentDeptAvg =
            currentSurvey && currentSurvey[1].summaries.length > 0
              ? computeDepartmentAverages(currentSurvey[1].summaries)
              : new Map<string, { avg: number; codeNum: number | null }>()

          const previousDeptAvg =
            previousSurvey && previousSurvey[1].summaries.length > 0
              ? computeDepartmentAverages(previousSurvey[1].summaries)
              : new Map<string, { avg: number; codeNum: number | null }>()

          const allDept = new Map<
            string,
            {
              codeNum: number | null
              current: number | null
              previous: number | null
            }
          >()

          currentDeptAvg.forEach((v, name) => {
            allDept.set(name, {
              codeNum: v.codeNum,
              current: v.avg,
              previous: null,
            })
          })

          previousDeptAvg.forEach((v, name) => {
            if (!allDept.has(name)) {
              allDept.set(name, {
                codeNum: v.codeNum,
                current: null,
                previous: v.avg,
              })
            } else {
              const existing = allDept.get(name)!
              allDept.set(name, {
                codeNum: existing.codeNum ?? v.codeNum,
                current: existing.current,
                previous: v.avg,
              })
            }
          })

          const deptData: { name: string; current: number | null; previous: number | null; codeNum: number | null }[] = []
          allDept.forEach((v, name) => {
            deptData.push({
              name,
              current: v.current,
              previous: v.previous,
              codeNum: v.codeNum,
            })
          })

          deptData.sort((a, b) => {
            const aCode = a.codeNum ?? Number.POSITIVE_INFINITY
            const bCode = b.codeNum ?? Number.POSITIVE_INFINITY
            if (aCode !== bCode) return aCode - bCode
            return a.name.localeCompare(b.name)
          })

          setDepartmentData(
            deptData.map((d) => ({
              name: d.name,
              current: d.current,
              previous: d.previous,
            })),
          )
        }
      } catch (error) {
              } finally {
        setLoading(false)
      }
    }

    loadReportData()
  }, [])

  // Calculate trend direction
  const getTrendDirection = () => {
    if (historicalData.length < 2) return { direction: "none", change: 0 }
    const recent = historicalData.slice(-2)
    const change = recent[1].score - recent[0].score
    if (change > 0) return { direction: "up", change: Number(change.toFixed(1)) }
    if (change < 0) return { direction: "down", change: Number(Math.abs(change).toFixed(1)) }
    return { direction: "none", change: 0 }
  }

  // Find highest and lowest departments
  const getDepartmentRankings = () => {
    const withScores = departmentData.filter((d) => d.current !== null)
    if (withScores.length === 0) return { highest: null, lowest: null }
    const sorted = [...withScores].sort((a, b) => (b.current ?? 0) - (a.current ?? 0))
    return {
      highest: sorted[0],
      lowest: sorted[sorted.length - 1],
    }
  }

  // Find categories needing improvement
  const getImprovementCategories = () => {
    return categoryData
      .filter((c) => c.current !== null && c.current < 70)
      .sort((a, b) => (a.current ?? 0) - (b.current ?? 0))
      .slice(0, 3)
  }

  const trend = getTrendDirection()
  const deptRankings = getDepartmentRankings()
  const improvementCategories = getImprovementCategories()

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
    <>
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="flex flex-col md:flex-row">
        <DashboardNav />
        <main className="flex-1 p-3 sm:p-4 md:p-8 w-full overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
            {/* Page Header */}
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground mb-1 sm:mb-2">
                分析レポート
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">詳細な分析結果とインサイト</p>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">読み込み中です…</div>
            ) : (
              <>
                {/* Trend Analysis Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <CardTitle>トレンド分析</CardTitle>
                    <CardDescription>過去のスコア推移と傾向分析</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historicalData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">データがありません。</p>
                    ) : (
                      <>
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            {trend.direction === "up" && (
                              <>
                                <ArrowUp className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-600">
                                  前回比 +{trend.change}点の改善
                                </span>
                              </>
                            )}
                            {trend.direction === "down" && (
                              <>
                                <ArrowDown className="h-4 w-4 text-red-600" />
                                <span className="text-sm font-medium text-red-600">
                                  前回比 -{trend.change}点の低下
                                </span>
                              </>
                            )}
                            {trend.direction === "none" && (
                              <>
                                <Minus className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">変化なし</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {historicalData.length > 0
                              ? `最新スコア: ${historicalData[historicalData.length - 1].score}点`
                              : ""}
                          </p>
                        </div>
                        <ChartContainer
                          config={{
                            score: {
                              label: "スコア",
                              color: "oklch(0.45 0.15 264)",
                            },
                          }}
                          className="h-[250px] sm:h-[300px] w-full"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historicalData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 264)" />
                              <XAxis
                                dataKey="month"
                                tick={{ fill: "oklch(0.55 0.01 264)", fontSize: 10 }}
                              />
                              <YAxis
                                domain={[0, 100]}
                                tick={{ fill: "oklch(0.55 0.01 264)", fontSize: 10 }}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "oklch(0.98 0.002 264)",
                                  border: "1px solid oklch(0.92 0.005 264)",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="score"
                                stroke="oklch(0.45 0.15 264)"
                                strokeWidth={2}
                                dot={{ fill: "oklch(0.45 0.15 264)", r: 4 }}
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Department Comparison Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <CardTitle>部門別比較</CardTitle>
                    <CardDescription>各部門のパフォーマンス比較分析</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {departmentData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">データがありません。</p>
                    ) : (
                      <>
                        {deptRankings.highest && (
                          <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                              最高スコア: {deptRankings.highest.name} ({deptRankings.highest.current}点)
                            </p>
                          </div>
                        )}
                        {deptRankings.lowest && deptRankings.lowest.name !== deptRankings.highest?.name && (
                          <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                              改善が必要: {deptRankings.lowest.name} ({deptRankings.lowest.current}点)
                            </p>
                          </div>
                        )}
                        <ChartContainer
                          config={{
                            current: {
                              label: "現在サーベイ",
                              color: "oklch(0.45 0.15 264)",
                            },
                            previous: {
                              label: "前回サーベイ",
                              color: "oklch(0.65 0.12 264)",
                            },
                          }}
                          className="h-[250px] sm:h-[300px] w-full"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={departmentData} margin={{ top: 10, right: 10, bottom: 60, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 264)" />
                              <XAxis
                                dataKey="name"
                                tick={{ fill: "oklch(0.55 0.01 264)", fontSize: 10 }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                              />
                              <YAxis
                                domain={[0, 100]}
                                tick={{ fill: "oklch(0.55 0.01 264)", fontSize: 10 }}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar
                                dataKey="previous"
                                name="前回サーベイ"
                                fill="oklch(0.75 0.12 264)"
                                radius={[4, 4, 0, 0]}
                              />
                              <Bar
                                dataKey="current"
                                name="現在サーベイ"
                                fill="oklch(0.45 0.15 264)"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Improvement Suggestions Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                        <Target className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <CardTitle>改善提案</CardTitle>
                    <CardDescription>データに基づく具体的な改善施策</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {improvementCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        すべてのカテゴリが良好な状態です。現在の取り組みを継続してください。
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {improvementCategories.map((cat, idx) => {
                          const diff = cat.previous !== null && cat.current !== null ? cat.current - cat.previous : 0
                          return (
                            <div key={idx} className="p-4 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-foreground">{cat.category}</h4>
                                <span className="text-sm font-medium text-orange-600">
                                  {cat.current}点
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                現在のスコアは70点未満です。このカテゴリの改善に重点を置くことを推奨します。
                              </p>
                              {cat.previous !== null && (
                                <div className="flex items-center gap-2 text-xs">
                                  {diff > 0 ? (
                                    <>
                                      <ArrowUp className="h-3 w-3 text-green-600" />
                                      <span className="text-green-600">前回比 +{diff.toFixed(1)}点</span>
                                    </>
                                  ) : diff < 0 ? (
                                    <>
                                      <ArrowDown className="h-3 w-3 text-red-600" />
                                      <span className="text-red-600">前回比 {diff.toFixed(1)}点</span>
                                    </>
                                  ) : (
                                    <>
                                      <Minus className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">変化なし</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Detailed Category Report Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <CardTitle>詳細レポート</CardTitle>
                    <CardDescription>全カテゴリの詳細分析レポート</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <>
                        {/* Original category data display */}
                    {categoryData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">データがありません。</p>
                    ) : (
                      <div className="space-y-3">
                        {categoryData.map((cat, idx) => {
                          const diff = cat.previous !== null && cat.current !== null ? cat.current - cat.previous : null
                          return (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-foreground">{cat.category}</span>
                                  {diff !== null && (
                                    <span className="text-xs">
                                      {diff > 0 ? (
                                        <span className="text-green-600">↑ +{diff.toFixed(1)}</span>
                                      ) : diff < 0 ? (
                                        <span className="text-red-600">↓ {diff.toFixed(1)}</span>
                                      ) : (
                                        <span className="text-muted-foreground">→</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {cat.current !== null && <span>現在: {cat.current}点</span>}
                                  {cat.previous !== null && <span>前回: {cat.previous}点</span>}
                                </div>
                              </div>
                              <div className="text-right">
                                {cat.current !== null && (
                                  <div
                                    className={`text-lg font-semibold ${
                                      cat.current >= 85
                                        ? "text-blue-600"
                                        : cat.current >= 70
                                          ? "text-green-600"
                                          : cat.current >= 55
                                            ? "text-yellow-600"
                                            : cat.current >= 46
                                              ? "text-orange-600"
                                              : "text-red-600"
                                    }`}
                                  >
                                    {cat.current}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    </>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
    </>
  )
}
