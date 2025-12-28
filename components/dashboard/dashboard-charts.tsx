/**
 * Dashboard Charts Component
 * Displays radar, bar, and line charts for survey data
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts'
import { useIsMobile } from '@/hooks/use-mobile'

interface DashboardChartsProps {
  radarData: Array<{ category: string; current: number | null; previous: number | null; fullMark: number }>
  radarLoading: boolean
  radarCurrentParticipantCount: number
  radarPreviousParticipantCount: number
  radarCurrentSurveyId: string | null
  radarPreviousSurveyId: string | null
  departmentChartData: Array<{ name: string; current: number; previous: number }>
  organizationGrowthData: Array<{ category: string; current: number; previous: number; fullMark: number }>
  organizationGrowthLoading: boolean
  growthCurrentParticipantCount: number
  growthPreviousParticipantCount: number
  historicalData: Array<{ month: string; score: number }>
  onShowDepartmentCategory: () => void
  onShowAllSurveys: () => void
}

export function DashboardCharts({
  radarData,
  radarLoading,
  radarCurrentParticipantCount,
  radarPreviousParticipantCount,
  radarCurrentSurveyId,
  radarPreviousSurveyId,
  departmentChartData,
  organizationGrowthData,
  organizationGrowthLoading,
  growthCurrentParticipantCount,
  growthPreviousParticipantCount,
  historicalData,
  onShowDepartmentCategory,
  onShowAllSurveys,
}: DashboardChartsProps) {
  const isMobile = useIsMobile()

  return (
    <>
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
        {/* Radar Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 sm:pb-3 md:pb-4">
            <CardTitle className="text-base sm:text-lg md:text-xl">カテゴリ別評価</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3 md:p-6">
            <ChartContainer
              config={{
                current: {
                  label: `現在サーベイ${radarCurrentParticipantCount > 0 ? `（${radarCurrentParticipantCount}）` : ''}`,
                  color: 'oklch(0.45 0.15 264)',
                },
                previous: {
                  label: `前回サーベイ${radarPreviousParticipantCount > 0 ? `（${radarPreviousParticipantCount}）` : ''}`,
                  color: 'oklch(0.65 0.12 264)',
                },
              }}
              className="h-[200px] sm:h-[250px] md:h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <PolarGrid stroke="oklch(0.92 0.005 264)" />
                  <PolarAngleAxis
                    dataKey="category"
                    tick={{ fill: 'oklch(0.55 0.01 264)', fontSize: isMobile ? 9 : 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: 'oklch(0.55 0.01 264)', fontSize: isMobile ? 8 : 10 }}
                  />
                  <Radar
                    name={`現在サーベイ${radarCurrentParticipantCount > 0 ? `（${radarCurrentParticipantCount}）` : ''}`}
                    dataKey="current"
                    stroke="oklch(0.45 0.15 264)"
                    fill="oklch(0.45 0.15 264)"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name={`前回サーベイ${radarPreviousParticipantCount > 0 ? `（${radarPreviousParticipantCount}）` : ''}`}
                    dataKey="previous"
                    stroke="oklch(0.65 0.12 264)"
                    fill="oklch(0.65 0.12 264)"
                    fillOpacity={0.1}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'oklch(0.98 0.002 264)',
                      border: '1px solid oklch(0.92 0.005 264)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Department Comparison */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 sm:pb-3 md:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg md:text-xl">部門別スコア</CardTitle>
              {radarCurrentSurveyId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onShowDepartmentCategory}
                  className="text-xs sm:text-sm"
                  aria-label="部門別カテゴリスコアを詳細"
                >
                  詳細
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-3 md:p-6">
            <ChartContainer
              config={{
                current: {
                  label: `現在サーベイ${radarCurrentParticipantCount > 0 ? `（${radarCurrentParticipantCount}）` : ''}`,
                  color: 'oklch(0.45 0.15 264)',
                },
                previous: {
                  label: `前回サーベイ${radarPreviousParticipantCount > 0 ? `（${radarPreviousParticipantCount}）` : ''}`,
                  color: 'oklch(0.65 0.12 264)',
                },
              }}
              className="h-[200px] sm:h-[250px] md:h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} margin={{ top: 10, right: 10, bottom: 30, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 264)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'oklch(0.55 0.01 264)', fontSize: isMobile ? 9 : 10 }}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? 'end' : 'middle'}
                    height={isMobile ? 60 : 30}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'oklch(0.55 0.01 264)', fontSize: isMobile ? 8 : 10 }}
                    width={isMobile ? 30 : 40}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="previous"
                    name={`前回サーベイ${radarPreviousParticipantCount > 0 ? `（${radarPreviousParticipantCount}）` : ''}`}
                    fill="oklch(0.75 0.12 264)"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="current"
                    name={`現在サーベイ${radarCurrentParticipantCount > 0 ? `（${radarCurrentParticipantCount}）` : ''}`}
                    fill="oklch(0.45 0.15 264)"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Organization Growth */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3 md:pb-4">
          <CardTitle className="text-base sm:text-lg md:text-xl">組織のグロース状態</CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-3 md:p-6">
          {organizationGrowthLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">読み込み中です…</div>
          ) : organizationGrowthData.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 space-y-2">
              <p>現在、集計可能なグロースサーベイ結果がありません。</p>
              <p className="text-xs">グロースサーベイが作成されていないか、回答データが存在しない可能性があります。</p>
            </div>
          ) : (
            <ChartContainer
              config={{
                current: {
                  label: `現在サーベイ${growthCurrentParticipantCount > 0 ? `（${growthCurrentParticipantCount}）` : ''}`,
                  color: 'oklch(0.50 0.20 240)',
                },
                previous: {
                  label: `前回サーベイ${growthPreviousParticipantCount > 0 ? `（${growthPreviousParticipantCount}）` : ''}`,
                  color: 'oklch(0.60 0.18 30)',
                },
              }}
              className="h-[200px] sm:h-[250px] md:h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={organizationGrowthData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <PolarGrid stroke="oklch(0.92 0.005 120)" />
                  <PolarAngleAxis
                    dataKey="category"
                    tick={{ fill: 'oklch(0.55 0.01 120)', fontSize: isMobile ? 9 : 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 6]}
                    tickCount={7}
                    tick={{ fill: 'oklch(0.55 0.01 120)', fontSize: isMobile ? 8 : 10 }}
                  />
                  <Radar
                    name={`現在サーベイ${growthCurrentParticipantCount > 0 ? `（${growthCurrentParticipantCount}）` : ''}`}
                    dataKey="current"
                    stroke="oklch(0.50 0.20 240)"
                    fill="oklch(0.50 0.20 240)"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name={`前回サーベイ${growthPreviousParticipantCount > 0 ? `（${growthPreviousParticipantCount}）` : ''}`}
                    dataKey="previous"
                    stroke="oklch(0.60 0.18 30)"
                    fill="oklch(0.60 0.18 30)"
                    fillOpacity={0.2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'oklch(0.98 0.002 120)',
                      border: '1px solid oklch(0.92 0.005 120)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Historical Trend */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3 md:pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg md:text-xl">スコア推移</CardTitle>
              <CardDescription className="text-xs sm:text-sm">過去6ヶ月間の総合スコアの変化</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onShowAllSurveys}
              className="text-xs sm:text-sm"
              aria-label="全サーベイ詳細を詳細"
            >
              詳細
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-3 md:p-6">
          <ChartContainer
            config={{
              score: {
                label: 'スコア',
                color: 'oklch(0.45 0.15 264)',
              },
            }}
            className="h-[180px] sm:h-[220px] md:h-[280px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 264)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'oklch(0.55 0.01 264)', fontSize: isMobile ? 9 : 10 }}
                  width={isMobile ? 30 : 40}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'oklch(0.55 0.01 264)', fontSize: isMobile ? 8 : 10 }}
                  width={isMobile ? 30 : 40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'oklch(0.98 0.002 264)',
                    border: '1px solid oklch(0.92 0.005 264)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="oklch(0.45 0.15 264)"
                  strokeWidth={2}
                  dot={{ fill: 'oklch(0.45 0.15 264)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  )
}

