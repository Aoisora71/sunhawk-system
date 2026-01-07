/**
 * Custom hook for dashboard data fetching
 * Separates data fetching logic from UI components
 */

import { useState, useEffect } from 'react'
import api from '@/lib/api-client'
import { log } from '@/lib/logger'

/**
 * Compute organizational overall score from summaries
 * Same logic as in app/dashboard/page.tsx
 */
function computeOrganizationalOverallScore(rows: any[]): number | null {
  if (!Array.isArray(rows) || rows.length === 0) return null

  const categoryCount = 8
  const sums = new Array<number>(categoryCount).fill(0)
  let count = 0

  rows.forEach((r: any) => {
    const cats = [
      Number(r.category1Score ?? r.category1_score ?? 0),
      Number(r.category2Score ?? r.category2_score ?? 0),
      Number(r.category3Score ?? r.category3_score ?? 0),
      Number(r.category4Score ?? r.category4_score ?? 0),
      Number(r.category5Score ?? r.category5_score ?? 0),
      Number(r.category6Score ?? r.category6_score ?? 0),
      Number(r.category7Score ?? r.category7_score ?? 0),
      Number(r.category8Score ?? r.category8_score ?? 0),
    ]

    // 少なくとも1カテゴリが数値なら集計対象とする
    const hasValidCategory = cats.some((c) => !isNaN(c) && c > 0)
    if (!hasValidCategory) return

    for (let i = 0; i < categoryCount; i++) {
      if (!isNaN(cats[i]) && cats[i] > 0) {
        sums[i] += cats[i]
      }
    }
    count++
  })

  if (count === 0) return null

  const categoryAverages = sums.map((sum) => sum / count)
  const overall = categoryAverages.reduce((a, b) => a + b, 0) / categoryCount

  return overall
}

interface DashboardData {
  currentOrgScore: number | null
  currentOrgParticipantCount: number
  currentSurveyId: string | null
  latestOrgScore: number | null
  latestOrgParticipantCount: number
  latestSurveyId: string | null
  orgScoreLoading: boolean
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    currentOrgScore: null,
    currentOrgParticipantCount: 0,
    currentSurveyId: null,
    latestOrgScore: null,
    latestOrgParticipantCount: 0,
    latestSurveyId: null,
    orgScoreLoading: true,
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        setData(prev => ({ ...prev, orgScoreLoading: true }))

        // Get all organizational survey summaries
        const summaryRes = await api.organizationalSurveySummary.list(undefined, true)

        if (!summaryRes?.success || !Array.isArray(summaryRes.summaries) || summaryRes.summaries.length === 0) {
          setData(prev => ({
            ...prev,
            currentOrgScore: null,
            currentOrgParticipantCount: 0,
            currentSurveyId: null,
            latestOrgScore: null,
            latestOrgParticipantCount: 0,
            latestSurveyId: null,
            orgScoreLoading: false,
          }))
          return
        }

        const summaries = summaryRes.summaries

        // Group by surveyId and collect date info
        const bySurvey = new Map<
          number,
          {
            summaries: any[]
            endDate: string | null
            startDate: string | null
          }
        >()

        summaries.forEach((row: any) => {
          const sid = Number(row.surveyId)
          if (!Number.isFinite(sid)) return

          if (!bySurvey.has(sid)) {
            bySurvey.set(sid, {
              summaries: [],
              endDate: row.endDate || row.end_date || null,
              startDate: row.startDate || row.start_date || null,
            })
          }

          const entry = bySurvey.get(sid)!
          entry.summaries.push(row)

          const newEnd = row.endDate || row.end_date || null
          if (newEnd && (!entry.endDate || new Date(newEnd) > new Date(entry.endDate))) {
            entry.endDate = newEnd
          }

          const newStart = row.startDate || row.start_date || null
          if (newStart && (!entry.startDate || new Date(newStart) > new Date(entry.startDate))) {
            entry.startDate = newStart
          }
        })

        if (bySurvey.size === 0) {
          setData(prev => ({
            ...prev,
            currentOrgScore: null,
            currentOrgParticipantCount: 0,
            currentSurveyId: null,
            latestOrgScore: null,
            latestOrgParticipantCount: 0,
            latestSurveyId: null,
            orgScoreLoading: false,
          }))
          return
        }

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        // Find current survey (ongoing or starting today)
        const currentSurveys = Array.from(bySurvey.entries()).filter(([, info]) => {
          if (!info.endDate) return true // No end date means ongoing
          const end = new Date(info.endDate)
          return end >= today
        })

        // Find latest completed survey (ended before today)
        const completedSurveys = Array.from(bySurvey.entries()).filter(([, info]) => {
          if (!info.endDate) return false
          const end = new Date(info.endDate)
          return end < today
        })

        // Get current survey - check active survey period first
        try {
          const period = await api.surveyPeriodApi.checkAvailability("organizational")
          if (period?.success && period.available && period.survey?.id) {
            const surveyId = period.survey.id
            const summaryRes = await api.organizationalSurveySummary.list(surveyId, true)
            
            if (summaryRes?.success && Array.isArray(summaryRes.summaries) && summaryRes.summaries.length > 0) {
              const validSummaries = summaryRes.summaries || []
              const overall = computeOrganizationalOverallScore(validSummaries)
              
              setData(prev => ({
                ...prev,
                currentOrgScore: overall,
                currentOrgParticipantCount: validSummaries.length,
                currentSurveyId: surveyId.toString(),
              }))
            }
          }
        } catch (error) {
          log.warn('Failed to load current survey from period API', { error })
        }

        // Get latest completed survey
        if (completedSurveys.length > 0) {
          const latestSurvey = completedSurveys.sort((a, b) => {
            const aEnd = a[1].endDate ? new Date(a[1].endDate).getTime() : 0
            const bEnd = b[1].endDate ? new Date(b[1].endDate).getTime() : 0
            return bEnd - aEnd
          })[0]

          const latestSummaries = latestSurvey[1].summaries || []
          const overall = computeOrganizationalOverallScore(latestSummaries)

          setData(prev => ({
            ...prev,
            latestOrgScore: overall,
            latestOrgParticipantCount: latestSummaries.length,
            latestSurveyId: latestSurvey[0].toString(),
          }))
        }
      } catch (error) {
        log.error('Failed to load dashboard data', error instanceof Error ? error : new Error(String(error)))
      } finally {
        setData(prev => ({ ...prev, orgScoreLoading: false }))
      }
    }

    loadData()
  }, [])

  return data
}

