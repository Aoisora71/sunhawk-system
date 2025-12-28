/**
 * Overall Score Card Component
 * Displays current and latest organizational survey scores
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScoreBadge } from '@/components/score-badge'
import { ScoreDescription } from '@/components/score-description'
import api from '@/lib/api-client'
import { log } from '@/lib/logger'
import { useState } from 'react'

interface OverallScoreCardProps {
  currentOrgScore: number | null
  currentOrgParticipantCount: number
  currentSurveyId: string | null
  latestOrgScore: number | null
  latestOrgParticipantCount: number
  latestSurveyId: string | null
  orgScoreLoading: boolean
  onShowDetails: (surveyId: string, surveyName: string | null) => void
}

function getLatestOrgScoreText(score: number): string {
  if (score <= 45) {
    return '組織の状態が非常に深刻です。早急な改善が必要です。'
  } else if (score <= 54) {
    return '組織の状態に課題があります。改善が必要です。'
  } else if (score <= 69) {
    return '組織の状態は普通です。さらなる改善の余地があります。'
  } else if (score <= 84) {
    return '組織の状態は良好です。維持とさらなる向上を目指しましょう。'
  } else {
    return '組織の状態は非常に良好です。この状態を維持しましょう。'
  }
}

export function OverallScoreCard({
  currentOrgScore,
  currentOrgParticipantCount,
  currentSurveyId,
  latestOrgScore,
  latestOrgParticipantCount,
  latestSurveyId,
  orgScoreLoading,
  onShowDetails,
}: OverallScoreCardProps) {
  const [loading, setLoading] = useState(false)

  const handleShowDetails = async (surveyId: string) => {
    setLoading(true)
    try {
      const response = await api.organizationalSurveySummary.getDetailed(surveyId)
      if (response?.success && response.details) {
        onShowDetails(surveyId, response.surveyName || null)
      }
    } catch (error) {
      log.error('Failed to load details', error instanceof Error ? error : new Error(String(error)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="text-lg sm:text-xl">ソシキサーベイ総合スコア</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          現在のソシキサーベイ結果と、直近に完了したソシキサーベイ結果を詳細します
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Current organizational survey */}
          <div className="space-y-2">
            <div className="text-xs sm:text-sm text-muted-foreground">現在のソシキサーベイ結果</div>
            {orgScoreLoading ? (
              <div className="text-sm text-muted-foreground">読み込み中です…</div>
            ) : currentOrgScore === null ? (
              <div className="text-sm text-muted-foreground">
                現在、集計可能なソシキサーベイ結果はありません。
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <ScoreBadge score={currentOrgScore} />
                    <ScoreDescription score={currentOrgScore} />
                    {currentOrgParticipantCount > 0 && (
                      <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                        （{currentOrgParticipantCount}名が参加）
                      </div>
                    )}
                  </div>
                  {currentSurveyId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowDetails(currentSurveyId)}
                      disabled={loading}
                      className="text-xs sm:text-sm"
                      aria-label="現在のサーベイ詳細を詳細"
                    >
                      詳細
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Latest completed organizational survey */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="text-xs sm:text-sm text-muted-foreground">最新のソシキサーベイ結果（完了分）</div>
            {latestOrgScore === null ? (
              <div className="text-sm text-muted-foreground">
                過去のソシキサーベイ結果がありません。
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <ScoreBadge score={latestOrgScore} />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {getLatestOrgScoreText(latestOrgScore)}
                    </p>
                    {latestOrgParticipantCount > 0 && (
                      <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                        （{latestOrgParticipantCount}名が参加）
                      </div>
                    )}
                  </div>
                  {latestSurveyId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowDetails(latestSurveyId)}
                      disabled={loading}
                      className="text-xs sm:text-sm"
                      aria-label="最新のサーベイ詳細を詳細"
                    >
                      詳細
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

