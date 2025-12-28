/**
 * Quick Stats Component
 * Displays key statistics cards
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

interface QuickStatsProps {
  highestScoreDepartment: { name: string; score: number } | null
  lowestScoreCategory: { name: string; score: number } | null
  averageResponseRate: number | null
}

export function QuickStats({
  highestScoreDepartment,
  lowestScoreCategory,
  averageResponseRate,
}: QuickStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardDescription className="text-xs sm:text-sm">最高スコア部門</CardDescription>
        </CardHeader>
        <CardContent>
          {highestScoreDepartment ? (
            <>
              <div className="text-lg sm:text-2xl font-medium text-foreground">{highestScoreDepartment.name}</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{Math.round(highestScoreDepartment.score)}点</p>
            </>
          ) : (
            <>
              <div className="text-lg sm:text-2xl font-medium text-foreground text-muted-foreground">-</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">データなし</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardDescription className="text-xs sm:text-sm">改善が必要な領域</CardDescription>
        </CardHeader>
        <CardContent>
          {lowestScoreCategory ? (
            <>
              <div className="text-lg sm:text-2xl font-medium text-foreground">{lowestScoreCategory.name}</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{Math.round(lowestScoreCategory.score)}点</p>
            </>
          ) : (
            <>
              <div className="text-lg sm:text-2xl font-medium text-foreground text-muted-foreground">-</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">データなし</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardDescription className="text-xs sm:text-sm">平均回答率</CardDescription>
        </CardHeader>
        <CardContent>
          {averageResponseRate !== null ? (
            <>
              <div className="text-lg sm:text-2xl font-medium text-foreground">{Math.round(averageResponseRate)}%</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">全サーベイ平均</p>
            </>
          ) : (
            <>
              <div className="text-lg sm:text-2xl font-medium text-foreground text-muted-foreground">-</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">データなし</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

