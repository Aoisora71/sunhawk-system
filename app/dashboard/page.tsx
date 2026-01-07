"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardNav } from "@/components/dashboard-nav"
import { ScoreBadge } from "@/components/score-badge"
import { ScoreDescription } from "@/components/score-description"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronDown, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_ID_MAP } from "@/lib/categories"
import api from "@/lib/api-client"
import type { User, Department } from "@/lib/types"

const ORGANIZATIONAL_SURVEY_SCALE_OPTIONS = [
  { value: 1, label: "まったくそう思わない" },
  { value: 2, label: "そう思わない" },
  { value: 3, label: "どちらかと言えばそう思わない" },
  { value: 4, label: "どちらかといえばそう思う" },
  { value: 5, label: "そう思う" },
  { value: 6, label: "非常にそう思う" },
]

function getAnswerLabel(answerIndex: number | null): string {
  if (answerIndex === null || answerIndex < 1 || answerIndex > 6) return "-"
  const option = ORGANIZATIONAL_SURVEY_SCALE_OPTIONS.find((opt) => opt.value === answerIndex)
  return option ? option.label : `選択肢${answerIndex}`
}

export default function DashboardPage() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [currentOrgScore, setCurrentOrgScore] = useState<number | null>(null)
  const [currentOrgParticipantCount, setCurrentOrgParticipantCount] = useState<number>(0)
  const [currentSurveyId, setCurrentSurveyId] = useState<string | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState<boolean>(false)
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false)
  const [currentSurveyName, setCurrentSurveyName] = useState<string | null>(null)
  const [detailsData, setDetailsData] = useState<Array<{
    id: number
    userId: number
    surveyId: number
    userName: string
    email: string
    departmentName: string
    departmentCode: string | null
    jobName: string
    jobCode: string | null
    category1Score: number
    category2Score: number
    category3Score: number
    category4Score: number
    category5Score: number
    category6Score: number
    category7Score: number
    category8Score: number
    totalScore: number
    responseRate: number | null
    updatedAt: string
  }>>([])
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: 'asc' | 'desc'
  }>({ key: null, direction: 'asc' })
  const [detailsSearchQuery, setDetailsSearchQuery] = useState<string>("")
  const [departmentCategorySearchQuery, setDepartmentCategorySearchQuery] = useState<string>("")
  const [allSurveysSearchQuery, setAllSurveysSearchQuery] = useState<string>("")
  const [groupByDepartment, setGroupByDepartment] = useState<boolean>(true) // 詳細スコアモーダル用
  const [groupByDepartmentAllSurveys, setGroupByDepartmentAllSurveys] = useState<boolean>(true) // 全サーベイ詳細モーダル用
  const [showDetailedAnalysisModal, setShowDetailedAnalysisModal] = useState(false)
  const [availableSurveys, setAvailableSurveys] = useState<Array<{ id: number; name: string; startDate: string | null; endDate: string | null }>>([])
  const [departmentsForAnalysis, setDepartmentsForAnalysis] = useState<Department[]>([])
  const [availableJobs, setAvailableJobs] = useState<Array<{ id: number; name: string; code: string | null }>>([])
  const [selectedSurveyIds, setSelectedSurveyIds] = useState<number[]>([])
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([])
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [detailedResponsesSearchQuery, setDetailedResponsesSearchQuery] = useState<string>("")
  const [groupByDepartmentDetailedResponses, setGroupByDepartmentDetailedResponses] = useState<boolean>(false)
  const [detailedResponsesSortConfig, setDetailedResponsesSortConfig] = useState<{
    key: string | null
    direction: 'asc' | 'desc'
  }>({ key: null, direction: 'asc' })
  const [detailedResponsesLoading, setDetailedResponsesLoading] = useState(false)
  const detailedResponsesTableRef = useRef<HTMLDivElement>(null)
  
  // Sort handler for detailed responses table
  const handleDetailedResponsesSort = (key: string) => {
    setDetailedResponsesSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }
  
  // Keyboard scroll handler for detailed responses table
  useEffect(() => {
    const tableContainer = detailedResponsesTableRef.current
    if (!tableContainer || !showDetailedAnalysisModal) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const scrollAmount = 100
        if (e.key === 'ArrowLeft') {
          tableContainer.scrollLeft -= scrollAmount
        } else {
          tableContainer.scrollLeft += scrollAmount
        }
        e.preventDefault()
      }
    }

    tableContainer.addEventListener('keydown', handleKeyDown)
    tableContainer.setAttribute('tabIndex', '0')
    
    return () => {
      tableContainer.removeEventListener('keydown', handleKeyDown)
    }
  }, [showDetailedAnalysisModal])

  // Sort icon component for detailed responses
  const DetailedResponsesSortIcon = ({ columnKey }: { columnKey: string }) => {
    if (detailedResponsesSortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-50" />
    }
    return detailedResponsesSortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />
  }
  const [detailedResponsesData, setDetailedResponsesData] = useState<{
    employees: Array<{
      employeeId: number
      employeeName: string
      employeeEmail: string
      departmentId: number | null
      departmentName: string | null
      departmentCode: string | null
      jobId: number | null
      jobName: string | null
      surveys: Array<{
        surveyId: number
        questions: Array<{
          questionId: number
          questionText: string
          score: number | null
          answerText: string | null
          answerIndex: number | null
        }>
      }>
    }>
    problems: Array<{
      id: number
      questionText: string
    }>
  } | null>(null)

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const filteredAndSortedData = useMemo(() => {
    // 検索フィルタリング
    let filtered = detailsData
    if (detailsSearchQuery.trim()) {
      const query = detailsSearchQuery.toLowerCase().trim()
      filtered = detailsData.filter((detail) => {
        return (
          detail.userName?.toLowerCase().includes(query) ||
          detail.departmentName?.toLowerCase().includes(query) ||
          detail.jobName?.toLowerCase().includes(query) ||
          detail.email?.toLowerCase().includes(query)
        )
      })
    }

    // 部署でソートする場合、部署ごとにグループ化して各部署内でスコア順にソート
    if (sortConfig.key === 'departmentName') {
      // 部署ごとにグループ化
      const groupedByDept = filtered.reduce((acc, detail) => {
        const deptName = detail.departmentName || '未分類'
        if (!acc[deptName]) {
          acc[deptName] = []
        }
        acc[deptName].push(detail)
        return acc
      }, {} as Record<string, typeof filtered>)

      // 部署をソート（codeフィールドを使用）
      const sortedDeptNames = Object.keys(groupedByDept).sort((a, b) => {
        const deptA = groupedByDept[a][0]
        const deptB = groupedByDept[b][0]
        const codeA = deptA.departmentCode || deptA.departmentName || ''
        const codeB = deptB.departmentCode || deptB.departmentName || ''
        const compareResult = codeA.localeCompare(codeB, 'ja')
        return sortConfig.direction === 'asc' ? compareResult : -compareResult
      })

      // 各部署内で従業員をスコア順（降順、高いスコアから）にソート
      const result: typeof filtered = []
      for (const deptName of sortedDeptNames) {
        const deptEmployees = [...groupedByDept[deptName]].sort((a, b) => {
          return b.totalScore - a.totalScore // Higher score first
        })
        result.push(...deptEmployees)
      }
      return result
    }

    // スコア関連のカラムでソートする場合
    if (sortConfig.key && (sortConfig.key === 'totalScore' || 
        sortConfig.key.startsWith('category') || 
        sortConfig.key === 'responseRate')) {
      // 部門別グループ化が有効な場合
      if (groupByDepartment) {
        // 部署ごとにグループ化
        const groupedByDept = filtered.reduce((acc, detail) => {
          const deptName = detail.departmentName || '未分類'
          if (!acc[deptName]) {
            acc[deptName] = []
          }
          acc[deptName].push(detail)
          return acc
        }, {} as Record<string, typeof filtered>)

        // 部署をソート（codeフィールドを使用）
        const sortedDeptNames = Object.keys(groupedByDept).sort((a, b) => {
          const deptA = groupedByDept[a][0]
          const deptB = groupedByDept[b][0]
          const codeA = deptA.departmentCode || deptA.departmentName || ''
          const codeB = deptB.departmentCode || deptB.departmentName || ''
          return codeA.localeCompare(codeB, 'ja')
        })

        // 各部署内で選択したカラムでソート
        const result: typeof filtered = []
        for (const deptName of sortedDeptNames) {
          const deptEmployees = [...groupedByDept[deptName]].sort((a, b) => {
            let aVal: any
            let bVal: any

            switch (sortConfig.key) {
              case 'totalScore':
                aVal = a.totalScore
                bVal = b.totalScore
                break
              case 'responseRate':
                aVal = a.responseRate ?? -1
                bVal = b.responseRate ?? -1
                break
              case 'category1Score':
                aVal = a.category1Score
                bVal = b.category1Score
                break
              case 'category2Score':
                aVal = a.category2Score
                bVal = b.category2Score
                break
              case 'category3Score':
                aVal = a.category3Score
                bVal = b.category3Score
                break
              case 'category4Score':
                aVal = a.category4Score
                bVal = b.category4Score
                break
              case 'category5Score':
                aVal = a.category5Score
                bVal = b.category5Score
                break
              case 'category6Score':
                aVal = a.category6Score
                bVal = b.category6Score
                break
              case 'category7Score':
                aVal = a.category7Score
                bVal = b.category7Score
                break
              default:
                return 0
            }

            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
          })
          result.push(...deptEmployees)
        }
        return result
      } else {
        // 部門別グループ化が無効な場合、組織全体でソート
        return [...filtered].sort((a, b) => {
          let aVal: any
          let bVal: any

          switch (sortConfig.key) {
            case 'totalScore':
              aVal = a.totalScore
              bVal = b.totalScore
              break
            case 'responseRate':
              aVal = a.responseRate ?? -1
              bVal = b.responseRate ?? -1
              break
            case 'category1Score':
              aVal = a.category1Score
              bVal = b.category1Score
              break
            case 'category2Score':
              aVal = a.category2Score
              bVal = b.category2Score
              break
            case 'category3Score':
              aVal = a.category3Score
              bVal = b.category3Score
              break
            case 'category4Score':
              aVal = a.category4Score
              bVal = b.category4Score
              break
            case 'category5Score':
              aVal = a.category5Score
              bVal = b.category5Score
              break
            case 'category6Score':
              aVal = a.category6Score
              bVal = b.category6Score
              break
            case 'category7Score':
              aVal = a.category7Score
              bVal = b.category7Score
              break
            default:
              return 0
          }

          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
        })
      }
    }

    // ソート指定がない場合、デフォルトで部署ごとにグループ化して各部署内でスコア順にソート
    if (!sortConfig.key) {
      // 部門別グループ化が有効な場合
      if (groupByDepartment) {
        // 部署ごとにグループ化
        const groupedByDept = filtered.reduce((acc, detail) => {
          const deptName = detail.departmentName || '未分類'
          if (!acc[deptName]) {
            acc[deptName] = []
          }
          acc[deptName].push(detail)
          return acc
        }, {} as Record<string, typeof filtered>)

        // 部署をソート（codeフィールドを使用）
        const sortedDeptNames = Object.keys(groupedByDept).sort((a, b) => {
          const deptA = groupedByDept[a][0]
          const deptB = groupedByDept[b][0]
          const codeA = deptA.departmentCode || deptA.departmentName || ''
          const codeB = deptB.departmentCode || deptB.departmentName || ''
          return codeA.localeCompare(codeB, 'ja')
        })

        // 各部署内で従業員をスコア順（降順、高いスコアから）にソート
        const result: typeof filtered = []
        for (const deptName of sortedDeptNames) {
          const deptEmployees = [...groupedByDept[deptName]].sort((a, b) => {
            return b.totalScore - a.totalScore // Higher score first
          })
          result.push(...deptEmployees)
        }
        return result
      } else {
        // 部門別グループ化が無効な場合、組織全体でスコア順にソート
        return [...filtered].sort((a, b) => {
          return b.totalScore - a.totalScore // Higher score first
        })
      }
    }

    // 詳細のカラム（userName, jobName, updatedAt）でソートする場合、通常のソート
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortConfig.key) {
        case 'jobName':
          aVal = a.jobCode || a.jobName || ''
          bVal = b.jobCode || b.jobName || ''
          break
        case 'updatedAt':
          aVal = new Date(a.updatedAt).getTime()
          bVal = new Date(b.updatedAt).getTime()
          break
        case 'userName':
          aVal = a.userName || ''
          bVal = b.userName || ''
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal, 'ja')
          : bVal.localeCompare(aVal, 'ja')
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
    })

    return sorted
  }, [detailsData, sortConfig, detailsSearchQuery, groupByDepartment])


  const DetailsSortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-50" />
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />
  }

  // スコア範囲に応じた背景色を返す関数
  const getScoreColorClass = (score: number): string => {
    // 0.0の場合は無色（データなしまたは未回答の可能性）
    if (score === 0) {
      return "bg-red-300 dark:bg-red-900/40 text-red-900 dark:text-red-100"
    }
    if (score <= 45) {
      return "bg-red-300 dark:bg-red-900/40 text-red-900 dark:text-red-100"
    } else if (score <= 54) {
      return "bg-red-200 dark:bg-pink-900/25 text-pink-900 dark:text-pink-200"
    } else if (score <= 69) {
      return "bg-transparent text-foreground"
    } else if (score <= 84) {
      return "bg-blue-200 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
    } else {
      return "bg-blue-300 dark:bg-blue-800/40 text-blue-950 dark:text-blue-50"
    }
  }
  const [latestOrgScore, setLatestOrgScore] = useState<number | null>(null)
  const [latestOrgParticipantCount, setLatestOrgParticipantCount] = useState<number>(0)
  const [latestSurveyId, setLatestSurveyId] = useState<string | null>(null)
  const [orgScoreLoading, setOrgScoreLoading] = useState<boolean>(true)
  const [radarData, setRadarData] = useState<
    { category: string; current: number | null; previous: number | null; fullMark: number }[]
  >([])
  const [radarLoading, setRadarLoading] = useState<boolean>(true)
  const [radarCurrentParticipantCount, setRadarCurrentParticipantCount] = useState<number>(0)
  const [radarPreviousParticipantCount, setRadarPreviousParticipantCount] = useState<number>(0)
  const [radarCurrentSurveyId, setRadarCurrentSurveyId] = useState<string | null>(null)
  const [radarPreviousSurveyId, setRadarPreviousSurveyId] = useState<string | null>(null)
  const [showDepartmentCategoryDialog, setShowDepartmentCategoryDialog] = useState<boolean>(false)
  const [departmentCategoryLoading, setDepartmentCategoryLoading] = useState<boolean>(false)
  const [departmentCategoryData, setDepartmentCategoryData] = useState<Array<{
    departmentId: number
    departmentName: string
    departmentCode: string | null
    category1Avg: number
    category2Avg: number
    category3Avg: number
    category4Avg: number
    category5Avg: number
    category6Avg: number
    category7Avg: number
    category8Avg: number
    totalAvg: number
    participantCount: number
  }>>([])
  const [departmentCategoryPreviousData, setDepartmentCategoryPreviousData] = useState<Array<{
    departmentId: number
    departmentName: string
    departmentCode: string | null
    category1Avg: number
    category2Avg: number
    category3Avg: number
    category4Avg: number
    category5Avg: number
    category6Avg: number
    category7Avg: number
    category8Avg: number
    totalAvg: number
    participantCount: number
  }>>([])
  const [departmentCategorySurveyName, setDepartmentCategorySurveyName] = useState<string | null>(null)
  const [departmentCategoryPreviousSurveyName, setDepartmentCategoryPreviousSurveyName] = useState<string | null>(null)
  
  const filteredDepartmentCategoryData = useMemo(() => {
    if (!departmentCategorySearchQuery.trim()) return departmentCategoryData.filter((dept: typeof departmentCategoryData[0]) => dept.departmentName != null && dept.departmentName.trim() !== '')
    const query = departmentCategorySearchQuery.toLowerCase().trim()
    return departmentCategoryData.filter((dept: typeof departmentCategoryData[0]) => {
      return dept.departmentName != null && dept.departmentName.trim() !== '' && dept.departmentName.toLowerCase().includes(query)
    })
  }, [departmentCategoryData, departmentCategorySearchQuery])
  
  const [showAllSurveysDialog, setShowAllSurveysDialog] = useState<boolean>(false)
  const [allSurveysLoading, setAllSurveysLoading] = useState<boolean>(false)
  const [allSurveysData, setAllSurveysData] = useState<Array<{
    surveyId: number
    surveyName: string
    startDate: string
    endDate: string
    status: string
    createdAt: string
    updatedAt: string
    totalParticipants: number
    overallAverageScore: number
    departments: Array<{
      departmentId: number
      departmentName: string
      departmentCode: string | null
      participantCount: number
      averageTotalScore: number
      averageCategory1: number
      averageCategory2: number
      averageCategory3: number
      averageCategory4: number
      averageCategory5: number
      averageCategory6: number
      averageCategory7: number
      averageCategory8: number
    }>
    participants: Array<{
      id: number
      userId: number
      userName: string
      email: string
      departmentId: number | null
      departmentName: string
      departmentCode: string | null
      jobName: string
      jobCode: string | null
      category1Score: number
      category2Score: number
      category3Score: number
      category4Score: number
      category5Score: number
      category6Score: number
      category7Score: number
      category8Score: number
      totalScore: number
      responseRate: number | null
      createdAt: string
      updatedAt: string
    }>
  }>>([])
  
  const filteredAllSurveysData = useMemo(() => {
    if (!allSurveysSearchQuery.trim()) return allSurveysData
    const query = allSurveysSearchQuery.toLowerCase().trim()
    return allSurveysData.map((survey: typeof allSurveysData[0]) => {
      const filteredDepartments = survey.departments.filter((dept: typeof survey.departments[0]) => {
        return dept.departmentName?.toLowerCase().includes(query)
      })
      const filteredParticipants = survey.participants.filter((participant: typeof survey.participants[0]) => {
        return (
          participant.userName?.toLowerCase().includes(query) ||
          participant.departmentName?.toLowerCase().includes(query) ||
          participant.jobName?.toLowerCase().includes(query) ||
          survey.surveyName?.toLowerCase().includes(query)
        )
      })
      return {
        ...survey,
        departments: filteredDepartments,
        participants: filteredParticipants,
      }
    }).filter((survey: typeof allSurveysData[0]) => {
      return (
        survey.departments.length > 0 ||
        survey.participants.length > 0 ||
        survey.surveyName?.toLowerCase().includes(query)
      )
    })
  }, [allSurveysData, allSurveysSearchQuery])
  
  const [deptSortConfig, setDeptSortConfig] = useState<{
    surveyId: number
    key: string | null
    direction: 'asc' | 'desc'
  }>({ surveyId: 0, key: null, direction: 'asc' })
  const [participantSortConfig, setParticipantSortConfig] = useState<{
    surveyId: number
    key: string | null
    direction: 'asc' | 'desc'
  }>({ surveyId: 0, key: null, direction: 'asc' })

  // Sort functions for all surveys modal
  const handleDeptSort = (surveyId: number, key: string) => {
    setDeptSortConfig((prev) => {
      if (prev.surveyId === surveyId && prev.key === key) {
        return { surveyId, key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { surveyId, key, direction: 'asc' }
    })
  }

  const handleParticipantSort = (surveyId: number, key: string) => {
    setParticipantSortConfig((prev) => {
      if (prev.surveyId === surveyId && prev.key === key) {
        return { surveyId, key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { surveyId, key, direction: 'asc' }
    })
  }

  const AllSurveysSortIcon = ({ columnKey, currentSortConfig }: { columnKey: string; currentSortConfig: { key: string | null; direction: 'asc' | 'desc' } }) => {
    if (currentSortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-50" />
    }
    return currentSortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />
  }

  const getSortedDepartments = (surveyId: number, departments: typeof allSurveysData[0]['departments']) => {
    if (deptSortConfig.surveyId !== surveyId || !deptSortConfig.key) return departments

    return [...departments].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (deptSortConfig.key!) {
        case 'departmentName':
          aVal = a.departmentCode || a.departmentName || ''
          bVal = b.departmentCode || b.departmentName || ''
          break
        case 'participantCount':
          aVal = a.participantCount
          bVal = b.participantCount
          break
        case 'averageTotalScore':
          aVal = a.averageTotalScore
          bVal = b.averageTotalScore
          break
        case 'averageCategory1':
          aVal = a.averageCategory1
          bVal = b.averageCategory1
          break
        case 'averageCategory2':
          aVal = a.averageCategory2
          bVal = b.averageCategory2
          break
        case 'averageCategory3':
          aVal = a.averageCategory3
          bVal = b.averageCategory3
          break
        case 'averageCategory4':
          aVal = a.averageCategory4
          bVal = b.averageCategory4
          break
        case 'averageCategory5':
          aVal = a.averageCategory5
          bVal = b.averageCategory5
          break
        case 'averageCategory6':
          aVal = a.averageCategory6
          bVal = b.averageCategory6
          break
        case 'averageCategory7':
          aVal = a.averageCategory7
          bVal = b.averageCategory7
          break
        case 'averageCategory8':
          aVal = a.averageCategory8
          bVal = b.averageCategory8
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return deptSortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal, 'ja')
          : bVal.localeCompare(aVal, 'ja')
      }

      return deptSortConfig.direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }

  const getSortedParticipants = (surveyId: number, participants: typeof allSurveysData[0]['participants']) => {
    // If sorting by department, group by department and sort employees within each department by score
    if (participantSortConfig.surveyId === surveyId && participantSortConfig.key === 'departmentName') {
      // Group by department
      const groupedByDept = participants.reduce((acc, participant) => {
        const deptName = participant.departmentName || '未分類'
        if (!acc[deptName]) {
          acc[deptName] = []
        }
        acc[deptName].push(participant)
        return acc
      }, {} as Record<string, typeof participants>)

      // Sort departments (using code field)
      const sortedDeptNames = Object.keys(groupedByDept).sort((a, b) => {
        const deptA = groupedByDept[a][0]
        const deptB = groupedByDept[b][0]
        const codeA = deptA.departmentCode || deptA.departmentName || ''
        const codeB = deptB.departmentCode || deptB.departmentName || ''
        const compareResult = codeA.localeCompare(codeB, 'ja')
        return participantSortConfig.direction === 'asc' ? compareResult : -compareResult
      })

      // Sort employees within each department by total score (descending by default)
      const result: typeof participants = []
      for (const deptName of sortedDeptNames) {
        const deptEmployees = [...groupedByDept[deptName]].sort((a, b) => {
          return b.totalScore - a.totalScore // Higher score first
        })
        result.push(...deptEmployees)
      }
      return result
    }

    // If no sort config or other sort keys, apply normal sorting
    if (participantSortConfig.surveyId !== surveyId || !participantSortConfig.key) {
      // 部門別グループ化が有効な場合
      if (groupByDepartmentAllSurveys) {
        // Default: group by department and sort by score within each department
        const groupedByDept = participants.reduce((acc, participant) => {
          const deptName = participant.departmentName || '未分類'
          if (!acc[deptName]) {
            acc[deptName] = []
          }
          acc[deptName].push(participant)
          return acc
        }, {} as Record<string, typeof participants>)

        // Sort departments (using code field)
        const sortedDeptNames = Object.keys(groupedByDept).sort((a, b) => {
          const deptA = groupedByDept[a][0]
          const deptB = groupedByDept[b][0]
          const codeA = deptA.departmentCode || deptA.departmentName || ''
          const codeB = deptB.departmentCode || deptB.departmentName || ''
          return codeA.localeCompare(codeB, 'ja')
        })
        const result: typeof participants = []
        for (const deptName of sortedDeptNames) {
          const deptEmployees = [...groupedByDept[deptName]].sort((a, b) => {
            return b.totalScore - a.totalScore // Higher score first
          })
          result.push(...deptEmployees)
        }
        return result
      } else {
        // 部門別グループ化が無効な場合、組織全体でスコア順にソート
        return [...participants].sort((a, b) => {
          return b.totalScore - a.totalScore // Higher score first
        })
      }
    }

    // For other sort keys, apply normal sorting but still group by department first if sorting by score
    if (participantSortConfig.key === 'totalScore' || 
        participantSortConfig.key.startsWith('category') || 
        participantSortConfig.key === 'responseRate') {
      // 部門別グループ化が有効な場合
      if (groupByDepartmentAllSurveys) {
        // Group by department first
        const groupedByDept = participants.reduce((acc, participant) => {
          const deptName = participant.departmentName || '未分類'
          if (!acc[deptName]) {
            acc[deptName] = []
          }
          acc[deptName].push(participant)
          return acc
        }, {} as Record<string, typeof participants>)

        // Sort employees within each department by the selected key
        // Sort departments (using code field)
        const sortedDeptNames = Object.keys(groupedByDept).sort((a, b) => {
          const deptA = groupedByDept[a][0]
          const deptB = groupedByDept[b][0]
          const codeA = deptA.departmentCode || deptA.departmentName || ''
          const codeB = deptB.departmentCode || deptB.departmentName || ''
          return codeA.localeCompare(codeB, 'ja')
        })
        const result: typeof participants = []
        
        for (const deptName of sortedDeptNames) {
          const deptEmployees = [...groupedByDept[deptName]].sort((a, b) => {
            let aVal: any
            let bVal: any

            switch (participantSortConfig.key) {
              case 'totalScore':
                aVal = a.totalScore
                bVal = b.totalScore
                break
              case 'responseRate':
                aVal = a.responseRate ?? -1
                bVal = b.responseRate ?? -1
                break
              case 'category1Score':
                aVal = a.category1Score
                bVal = b.category1Score
                break
              case 'category2Score':
                aVal = a.category2Score
                bVal = b.category2Score
                break
              case 'category3Score':
                aVal = a.category3Score
                bVal = b.category3Score
                break
              case 'category4Score':
                aVal = a.category4Score
                bVal = b.category4Score
                break
              case 'category5Score':
                aVal = a.category5Score
                bVal = b.category5Score
                break
              case 'category6Score':
                aVal = a.category6Score
                bVal = b.category6Score
                break
              case 'category7Score':
                aVal = a.category7Score
                bVal = b.category7Score
                break
              case 'category8Score':
                aVal = a.category8Score
                bVal = b.category8Score
                break
              default:
                return 0
            }

            return participantSortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
          })
          result.push(...deptEmployees)
        }
        return result
      } else {
        // 部門別グループ化が無効な場合、組織全体でソート
        return [...participants].sort((a, b) => {
          let aVal: any
          let bVal: any

          switch (participantSortConfig.key) {
            case 'totalScore':
              aVal = a.totalScore
              bVal = b.totalScore
              break
            case 'responseRate':
              aVal = a.responseRate ?? -1
              bVal = b.responseRate ?? -1
              break
            case 'category1Score':
              aVal = a.category1Score
              bVal = b.category1Score
              break
            case 'category2Score':
              aVal = a.category2Score
              bVal = b.category2Score
              break
            case 'category3Score':
              aVal = a.category3Score
              bVal = b.category3Score
              break
            case 'category4Score':
              aVal = a.category4Score
              bVal = b.category4Score
              break
            case 'category5Score':
              aVal = a.category5Score
              bVal = b.category5Score
              break
            case 'category6Score':
              aVal = a.category6Score
              bVal = b.category6Score
              break
            case 'category7Score':
              aVal = a.category7Score
              bVal = b.category7Score
              break
            case 'category8Score':
              aVal = a.category8Score
              bVal = b.category8Score
              break
            default:
              return 0
          }

          return participantSortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
        })
      }
    }

    // For other sort keys (userName, jobName, updatedAt), apply normal sorting
    return [...participants].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (participantSortConfig.key) {
        case 'userName':
          aVal = a.userName || ''
          bVal = b.userName || ''
          break
        case 'jobName':
          aVal = a.jobCode || a.jobName || ''
          bVal = b.jobCode || b.jobName || ''
          break
        case 'updatedAt':
          aVal = new Date(a.updatedAt).getTime()
          bVal = new Date(b.updatedAt).getTime()
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return participantSortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal, 'ja')
          : bVal.localeCompare(aVal, 'ja')
      }

      return participantSortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
    })
  }
  const [organizationGrowthData, setOrganizationGrowthData] = useState<
    { category: string; current: number | null; previous: number | null; fullMark: number }[]
  >([])
  const [organizationGrowthLoading, setOrganizationGrowthLoading] = useState<boolean>(true)
  const [growthCurrentParticipantCount, setGrowthCurrentParticipantCount] = useState<number>(0)
  const [growthPreviousParticipantCount, setGrowthPreviousParticipantCount] = useState<number>(0)
  const [showGrowthQuestionResponsesDialog, setShowGrowthQuestionResponsesDialog] = useState<boolean>(false)
  const [growthQuestionResponsesLoading, setGrowthQuestionResponsesLoading] = useState<boolean>(false)
  const [growthQuestionResponsesData, setGrowthQuestionResponsesData] = useState<Array<{
    questionId: number
    questionText: string
    category: string | null
    options: Array<{
      label: string
      score: number | null
      count: number
    }>
    totalRespondents: number
  }>>([])
  const [selectedGrowthSurveyId, setSelectedGrowthSurveyId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentChartData, setDepartmentChartData] = useState<
    { name: string; current: number | null; previous: number | null }[]
  >([])
  const [historicalData, setHistoricalData] = useState<{ month: string; score: number }[]>([])
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [highestScoreDepartment, setHighestScoreDepartment] = useState<{ name: string; score: number } | null>(null)
  const [nextOrganizationalSurvey, setNextOrganizationalSurvey] = useState<{ name: string; startDate: string } | null>(
    null,
  )
  const [nextGrowthSurvey, setNextGrowthSurvey] = useState<{ name: string; startDate: string } | null>(null)
  const [lowestScoreCategory, setLowestScoreCategory] = useState<{ name: string; score: number } | null>(null)

  // Authorization is handled server-side via layout.tsx
  // No need for client-side checks (security improvement)
  useEffect(() => {
    setIsAuthorized(true) // Layout already verified admin access
  }, [])

  // Helper to compute overall organizational score (average of 8 category totals)
  const computeOrganizationalOverallScore = (rows: any[]): number | null => {
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
      if (cats.some((v) => Number.isFinite(v))) {
        for (let i = 0; i < categoryCount; i++) {
          sums[i] += cats[i]
        }
        count++
      }
    })

    if (count === 0) return null

    const categoryAverages = sums.map((sum) => sum / count)
    const overall = categoryAverages.reduce((acc, v) => acc + v, 0) / categoryCount
    return Number.isFinite(overall) ? Number(overall.toFixed(1)) : null
  }

  // Helper to get latest organizational survey qualitative text (for dashboard latest result)
  const getLatestOrgScoreText = (score: number | null): string => {
    if (score === null || Number.isNaN(score)) return ""
    const s = Math.round(score)
    if (s <= 45) return "サンホークの考えから遠く離れています"
    if (s <= 54) return "サンホークの考えから少し離れています"
    if (s <= 69) return "普通です"
    if (s <= 84) return "サンホークの考えに近いです"
    return "サンホークの考えにかなり近いです"
  }

  // Check if mobile on client side
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load current organizational survey overall score (active survey)
  useEffect(() => {
    const loadCurrentOrganizationalScore = async () => {
      try {
        setOrgScoreLoading(true)

        // 現在アクティブなソシキサーベイを取得
        const period = await api.surveyPeriodApi.checkAvailability("organizational")
        if (!period?.success || !period.available || !period.survey?.id) {
          setCurrentOrgScore(null)
          setCurrentOrgParticipantCount(0)
          setCurrentSurveyId(null)
          return
        }

        const surveyId = period.survey.id
        setCurrentSurveyId(surveyId)

        // アクティブなサーベイのサマリーを取得（組織全体）
        const summaryRes = await api.organizationalSurveySummary.list(surveyId, true)

        if (!summaryRes?.success || !Array.isArray(summaryRes.summaries) || summaryRes.summaries.length === 0) {
          setCurrentOrgScore(null)
          setCurrentOrgParticipantCount(0)
          return
        }

        const validSummaries = summaryRes.summaries || []
        const count = validSummaries.length

        if (count === 0) {
          setCurrentOrgScore(null)
          setCurrentOrgParticipantCount(0)
          return
        }

        const overall = computeOrganizationalOverallScore(validSummaries)
        setCurrentOrgScore(overall)
        setCurrentOrgParticipantCount(count)
      } catch (error) {
        console.error("Failed to load current organizational survey score:", error)
        setCurrentOrgScore(null)
        setCurrentOrgParticipantCount(0)
      } finally {
        setOrgScoreLoading(false)
      }
    }

    loadCurrentOrganizationalScore()
  }, [])

  // Load latest completed organizational survey overall score (last survey ended before today)
  useEffect(() => {
    const loadLatestOrganizationalScore = async () => {
      try {
        const summaryRes = await api.organizationalSurveySummary.list(undefined, true)

        if (!summaryRes?.success || !Array.isArray(summaryRes.summaries) || summaryRes.summaries.length === 0) {
          setLatestOrgScore(null)
          setLatestOrgParticipantCount(0)
          setLatestSurveyId(null)
          return
        }

        const summaries = summaryRes.summaries

        // サーベイIDごとにグルーピングし、endDate を持たせる
        const bySurvey = new Map<
          number,
          {
            summaries: any[]
            endDate: string | null
          }
        >()

        summaries.forEach((row: any) => {
          const sid = Number(row.surveyId)
          if (!Number.isFinite(sid)) return

          if (!bySurvey.has(sid)) {
            bySurvey.set(sid, {
              summaries: [],
              endDate: row.endDate || row.end_date || null,
            })
          }

          const entry = bySurvey.get(sid)!
          entry.summaries.push(row)

          const newEnd = row.endDate || row.end_date || null
          if (newEnd && (!entry.endDate || new Date(newEnd) > new Date(entry.endDate))) {
            entry.endDate = newEnd
          }
        })

        if (bySurvey.size === 0) {
          setLatestOrgScore(null)
          setLatestOrgParticipantCount(0)
          setLatestSurveyId(null)
          return
        }

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        // 現在日付より前に終了したサーベイのみ対象
        const completedSurveys = Array.from(bySurvey.entries()).filter(([, info]) => {
          if (!info.endDate) return false
          const end = new Date(info.endDate)
          return end < today
        })

        if (completedSurveys.length === 0) {
          setLatestOrgScore(null)
          setLatestOrgParticipantCount(0)
          setLatestSurveyId(null)
          return
        }

        // endDate の降順（最新完了サーベイが先頭）
        completedSurveys.sort((a, b) => {
          const aEnd = a[1].endDate ? new Date(a[1].endDate).getTime() : 0
          const bEnd = b[1].endDate ? new Date(b[1].endDate).getTime() : 0
          return bEnd - aEnd
        })

        const latestSurveyIdNum = completedSurveys[0][0]
        const latest = completedSurveys[0][1]
        const latestSummaries = latest.summaries || []

        if (!latestSummaries.length) {
          setLatestOrgScore(null)
          setLatestOrgParticipantCount(0)
          setLatestSurveyId(null)
          return
        }

        const overall = computeOrganizationalOverallScore(latestSummaries)
        setLatestOrgScore(overall)
        setLatestOrgParticipantCount(latestSummaries.length)
        setLatestSurveyId(String(latestSurveyIdNum))
      } catch (error) {
        console.error("Failed to load latest organizational survey score:", error)
        setLatestOrgScore(null)
        setLatestOrgParticipantCount(0)
        setLatestSurveyId(null)
      }
    }

    loadLatestOrganizationalScore()
  }, [])

  // Load employees and departments (for department mapping)
  useEffect(() => {
    const loadEmployeesAndDepartments = async () => {
      try {
        // Cookies are automatically sent, no need for manual headers
        const [empRes, deptRes] = await Promise.all([
          fetch("/api/employees", { headers: {} }),
          fetch("/api/departments", { headers: {} }),
        ])

        if (empRes.ok) {
          const data = await empRes.json().catch(() => null)
          if (data?.success && Array.isArray(data.employees)) {
            setEmployees(data.employees)
          }
        }

        if (deptRes.ok) {
          const deptData = await deptRes.json().catch(() => null)
          if (deptData?.success && Array.isArray(deptData.departments)) {
            setDepartments(deptData.departments)
            setDepartmentsForAnalysis(deptData.departments)
          }
        }
      } catch (error) {
        console.error("Failed to load employees/departments for department chart:", error)
      }
    }
    loadEmployeesAndDepartments()
  }, [])

  // Load available surveys for detailed analysis
  useEffect(() => {
    const loadAvailableSurveys = async () => {
      try {
        const surveysRes = await api.surveys.list()
        if (surveysRes?.success && Array.isArray(surveysRes.surveys)) {
          const orgSurveys = surveysRes.surveys
            .filter((s: any) => s.surveyType === 'organizational')
            .map((s: any) => ({
              id: Number(s.id),
              name: s.name || `サーベイ ${s.id}`,
              startDate: s.startDate || null,
              endDate: s.endDate || null,
            }))
            .sort((a, b) => {
              const aEnd = a.endDate ? new Date(a.endDate).getTime() : 0
              const bEnd = b.endDate ? new Date(b.endDate).getTime() : 0
              return bEnd - aEnd
            })
          setAvailableSurveys(orgSurveys)
        }
      } catch (error) {
        console.error("Failed to load available surveys:", error)
      }
    }

    if (showDetailedAnalysisModal) {
      loadAvailableSurveys()
    }
  }, [showDetailedAnalysisModal])

  // Load departments and jobs for detailed analysis modal
  useEffect(() => {
    const loadDepartmentsAndJobs = async () => {
      try {
        const [deptResponse, jobsResponse] = await Promise.all([
          api.departments.list(),
          api.jobs.list(),
        ])
        if (deptResponse?.success && Array.isArray(deptResponse.departments)) {
          // Filter out departments with code "1" or "2"
          const filteredDepartments = deptResponse.departments.filter((dept: any) => {
            const code = dept.code?.toString().trim()
            return code !== "1" && code !== "2"
          })
          setDepartmentsForAnalysis(filteredDepartments)
        }
        if (jobsResponse?.success && Array.isArray(jobsResponse.jobs)) {
          // Filter out jobs with code "1"
          const filteredJobs = jobsResponse.jobs
            .filter((job: any) => {
              const code = job.code?.toString().trim()
              return code !== "1"
            })
            .map((job: any) => ({
              id: parseInt(job.id, 10),
              name: job.name,
              code: job.code || null,
            }))
          setAvailableJobs(filteredJobs)
        }
      } catch (error) {
        console.error("Failed to load departments and jobs:", error)
      }
    }

    if (showDetailedAnalysisModal) {
      loadDepartmentsAndJobs()
    }
  }, [showDetailedAnalysisModal])

  // Load radar chart data (category-wise averages for current and previous surveys)
  useEffect(() => {
    const loadRadarData = async () => {
      try {
        setRadarLoading(true)

        // Get all organizational survey summaries for the organization
        const summaryRes = await api.organizationalSurveySummary.list(undefined, true)
        if (!summaryRes?.success || !Array.isArray(summaryRes.summaries) || summaryRes.summaries.length === 0) {
          setRadarData([])
          setDepartmentChartData([])
          return
        }

        const summaries = summaryRes.summaries

        // Group by surveyId and collect date info
        const bySurvey = new Map<
          number,
          {
            summaries: any[]
            endDate: string | null
          }
        >()

        summaries.forEach((row: any) => {
          const sid = Number(row.surveyId)
          if (!Number.isFinite(sid)) return
          if (!bySurvey.has(sid)) {
            bySurvey.set(sid, { summaries: [], endDate: row.endDate || row.end_date || null })
          }
          bySurvey.get(sid)!.summaries.push(row)
          // Prefer the latest endDate if multiple
          const currentEnd = bySurvey.get(sid)!.endDate
          const newEnd = row.endDate || row.end_date || null
          if (newEnd && (!currentEnd || new Date(newEnd) > new Date(currentEnd))) {
            bySurvey.get(sid)!.endDate = newEnd
          }
        })

        if (bySurvey.size === 0) {
          setRadarData([])
          setDepartmentChartData([])
          return
        }

        // Sort surveys by endDate desc (latest first)
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
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
            6: 0,
            7: 0,
            8: 0,
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

        // Store participant counts and survey IDs for radar chart
        setRadarCurrentParticipantCount(currentSurvey ? currentSurvey[1].summaries.length : 0)
        setRadarPreviousParticipantCount(previousSurvey ? previousSurvey[1].summaries.length : 0)
        setRadarCurrentSurveyId(currentSurvey ? String(currentSurvey[0]) : null)
        setRadarPreviousSurveyId(previousSurvey ? String(previousSurvey[0]) : null)

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



        const data = categories.map((cat) => ({
          category: cat.label,
          current: currentAverages ? Number((currentAverages[cat.id as 1] ?? 0).toFixed(1)) : null,
          previous: previousAverages ? Number((previousAverages[cat.id as 1] ?? 0).toFixed(1)) : null,
          fullMark: 100,
        }))

        setRadarData(data)

        // ---- Historical overall scores per survey (by survey start month) ----
        type SurveyBucket = {
          startDate: string | null
          endDate: string | null
          total: number
          count: number
        }

        const surveyBuckets = new Map<number, SurveyBucket>()

        summaries.forEach((row: any) => {
          const sid = Number(row.surveyId)
          if (!Number.isFinite(sid)) return
          const start = row.startDate || row.start_date || null
          const end = row.endDate || row.end_date || null
          if (!surveyBuckets.has(sid)) {
            surveyBuckets.set(sid, { startDate: start, endDate: end, total: 0, count: 0 })
          }
          const bucket = surveyBuckets.get(sid)!
          bucket.total += Number(row.totalScore ?? row.total_score ?? 0)
          bucket.count += 1
          // 最も早い startDate / 最も遅い endDate を保持
          if (start && (!bucket.startDate || new Date(start) < new Date(bucket.startDate))) {
            bucket.startDate = start
          }
          if (end && (!bucket.endDate || new Date(end) > new Date(bucket.endDate))) {
            bucket.endDate = end
          }
        })

        const historical: { month: string; score: number }[] = []
        surveyBuckets.forEach((bucket, sid) => {
          if (!bucket.count) return
          const avg = Number((bucket.total / bucket.count).toFixed(1))
          const d = bucket.startDate ? new Date(bucket.startDate) : null
          const label =
            d != null
              ? `${d.getFullYear()}年${d.getMonth() + 1}月`
              : `ID:${sid}`
          historical.push({
            month: label,
            score: avg,
          })
        })

        // サーベイ開始月の昇順で並べる
        historical.sort((a, b) => {
          // "YYYY年M月" から Date を再構成
          const parse = (s: string) => {
            const m = s.match(/^(\d{4})年(\d{1,2})月$/)
            if (!m) return 0
            return new Date(Number(m[1]), Number(m[2]) - 1, 1).getTime()
          }
          return parse(a.month) - parse(b.month)
        })

        setHistoricalData(historical)

        // ---- Department chart data (average total_score per department for current & previous survey) ----
        if (!employees.length || !departments.length) {
          // Without employees or departments we can't map user -> department; keep existing chart data
          return
        }

        // Build department meta map (id -> { name, codeNum })
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

        // Build user -> department meta map
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
            // 部門コードが 3 未満または未設定の場合は集計対象外
            if (meta.codeNum === null || meta.codeNum < 3) return
            const deptName = meta.name || "未設定"
            const totalScore = Number(r.totalScore ?? r.total_score ?? 0)
            if (!deptAgg.has(deptName)) {
              deptAgg.set(deptName, { sum: 0, count: 0, codeNum: meta.codeNum })
            }
            const entry = deptAgg.get(deptName)!
            entry.sum += totalScore
            entry.count += 1
            // keep smallest code number as representative
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

        // Collect union of department names
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

        // Sort departments by code (ascending), then by name
        deptData.sort((a, b) => {
          const aCode = a.codeNum ?? Number.POSITIVE_INFINITY
          const bCode = b.codeNum ?? Number.POSITIVE_INFINITY
          if (aCode !== bCode) return aCode - bCode
          return a.name.localeCompare(b.name)
        })

        setDepartmentChartData(
          deptData.map((d) => ({
            name: d.name,
            current: d.current,
            previous: d.previous,
          })),
        )
      } catch (error) {
        console.error("Failed to load radar data:", error)
        setRadarData([])
        setDepartmentChartData([])
      } finally {
        setRadarLoading(false)
      }
    }

    loadRadarData()
  }, [employees, departments])

  // Load organization growth status radar chart data (current and previous surveys)
  useEffect(() => {
    const loadOrganizationGrowthData = async () => {
      try {
        setOrganizationGrowthLoading(true)

        // Get all surveys and filter for growth surveys
        const surveysRes = await api.surveys.list()
        if (!surveysRes?.success || !Array.isArray(surveysRes.surveys)) {
          setOrganizationGrowthData([])
          return
        }

        // Get list of survey IDs that have response data in growth_survey_responses
        // This ensures we only consider surveys with actual data
        let surveysWithData: number[] = []
        try {
          const responseSurveysRes = await fetch('/api/growth-survey-category-scores/surveys', {
            headers: {
              // Cookies are automatically sent with requests
            },
          })
          
          if (responseSurveysRes.ok) {
            const responseData = await responseSurveysRes.json()
            if (responseData?.success && Array.isArray(responseData.surveyIds)) {
              surveysWithData = responseData.surveyIds.map((id: any) => Number(id))
              console.log(`[Growth Survey Chart] Surveys with response data:`, surveysWithData)
            }
          }
        } catch (error) {
          console.warn(`[Growth Survey Chart] Failed to fetch surveys with data, using all growth surveys:`, error)
        }

        // Filter for growth surveys
        // If we have surveys with data, only include those. Otherwise, include all growth surveys.
        const allGrowthSurveys = surveysRes.surveys.filter((s: any) => s.surveyType === 'growth')
        const growthSurveys = surveysWithData.length > 0
          ? allGrowthSurveys.filter((s: any) => surveysWithData.includes(Number(s.id)))
          : allGrowthSurveys

        // Sort by endDate, then created_at, then id
        growthSurveys.sort((a: any, b: any) => {
            // Primary sort: endDate (descending, nulls last)
            const aEnd = a.endDate ? new Date(a.endDate).getTime() : 0
            const bEnd = b.endDate ? new Date(b.endDate).getTime() : 0
            if (aEnd !== bEnd) {
              return bEnd - aEnd
            }
            // Secondary sort: created_at (descending)
            const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
            if (aCreated !== bCreated) {
              return bCreated - aCreated
            }
            // Tertiary sort: id (descending)
            return Number(b.id) - Number(a.id)
          })

        // Fallback scores (0 when no surveys exist - no bonus points)
        const fallbackCategories = {
          "ルール": 0,
          "組織体制": 0,
          "評価制度": 0,
          "週報・会議": 0,
          "識学サーベイ": 1.5, // This is calculated from organizational survey, not from growth survey
        }

        // Find current survey (most recent with data, or most recent overall if no data)
        const currentSurvey = growthSurveys.length > 0 ? growthSurveys[0] : null
        
        // Find previous survey: the one before currentSurvey in the sorted list
        // This ensures we get the actual previous survey based on gsid in growth_survey_responses
        let previousSurvey = null
        if (growthSurveys.length > 1) {
          // Find the index of current survey in the sorted list
          const currentIndex = currentSurvey 
            ? growthSurveys.findIndex((s: any) => Number(s.id) === Number(currentSurvey.id))
            : -1
          
          // Previous survey is the one at index + 1 (since list is sorted descending)
          if (currentIndex >= 0 && currentIndex + 1 < growthSurveys.length) {
            previousSurvey = growthSurveys[currentIndex + 1]
          } else if (currentIndex === -1 && growthSurveys.length > 0) {
            // If current survey not found in list, previous is the first one
            previousSurvey = growthSurveys[0]
          }
        }

        // Debug logging
        console.log(`[Growth Survey Chart] Total growth surveys with data: ${growthSurveys.length}`)
        if (currentSurvey) {
          console.log(`[Growth Survey Chart] Current survey ID: ${currentSurvey.id}, Name: ${currentSurvey.name}, EndDate: ${currentSurvey.endDate}`)
        }
        if (previousSurvey) {
          console.log(`[Growth Survey Chart] Previous survey ID: ${previousSurvey.id}, Name: ${previousSurvey.name}, EndDate: ${previousSurvey.endDate}`)
        } else {
          console.log(`[Growth Survey Chart] No previous survey found`)
        }

        // Get category scores for current and previous surveys
        const getCategoryScores = async (surveyId: number) => {
          try {
            const response = await api.growthSurveyCategoryScores.get(surveyId)
            if (!response) {
              console.warn(`No response for survey ${surveyId}`)
              return null
            }
            if (!response.success) {
              console.warn(`Failed to get category scores for survey ${surveyId}:`, response)
              return null
            }
            if (!response.categories) {
              console.warn(`No categories in response for survey ${surveyId}`)
              return null
            }
            return response.categories
          } catch (error) {
            console.error(`Error getting category scores for survey ${surveyId}:`, error)
            return null
          }
        }

        // Get category scores for current and previous surveys
        let currentCategories = null
        let previousCategories = null

        if (currentSurvey) {
          const currentSurveyId = Number(currentSurvey.id)
          console.log(`[Growth Survey Chart] Fetching current survey scores for ID: ${currentSurveyId}`)
          currentCategories = await getCategoryScores(currentSurveyId)
          if (currentCategories) {
            console.log(`[Growth Survey Chart] Current categories:`, currentCategories)
          }
        }

        if (previousSurvey) {
          const previousSurveyId = Number(previousSurvey.id)
          console.log(`[Growth Survey Chart] Fetching previous survey scores for ID: ${previousSurveyId}`)
          previousCategories = await getCategoryScores(previousSurveyId)
          if (previousCategories) {
            console.log(`[Growth Survey Chart] Previous categories:`, previousCategories)
          }
        }

        const categories = [
          { name: "ルール" },
          { name: "組織体制" },
          { name: "評価制度" },
          { name: "週報・会議" },
          { name: "識学サーベイ" },
        ]

        // Use retrieved categories or fallback to bonus points only
        const data = categories.map((cat) => ({
          category: cat.name,
          current: currentCategories 
            ? Number(((currentCategories as any)[cat.name] || fallbackCategories[cat.name as keyof typeof fallbackCategories] || 0).toFixed(2))
            : fallbackCategories[cat.name as keyof typeof fallbackCategories] || 0,
          previous: previousCategories 
            ? Number(((previousCategories as any)[cat.name] || fallbackCategories[cat.name as keyof typeof fallbackCategories] || 0).toFixed(2))
            : null,
          fullMark: 6, // Maximum score is 6
        }))

        // Always set data (even if only bonus points are available)
        setOrganizationGrowthData(data)

        // Get participant counts for current and previous growth surveys
        try {
          if (currentSurvey) {
            const currentSurveyId = Number(currentSurvey.id)
            const currentSummaryRes = await api.growthSurveySummary.list(String(currentSurveyId), true)
            if (currentSummaryRes?.success && Array.isArray(currentSummaryRes.summaries)) {
              setGrowthCurrentParticipantCount(currentSummaryRes.summaries.length)
            }
          } else {
            setGrowthCurrentParticipantCount(0)
          }

          if (previousSurvey) {
            const previousSurveyId = Number(previousSurvey.id)
            const previousSummaryRes = await api.growthSurveySummary.list(String(previousSurveyId), true)
            if (previousSummaryRes?.success && Array.isArray(previousSummaryRes.summaries)) {
              setGrowthPreviousParticipantCount(previousSummaryRes.summaries.length)
            }
          } else {
            setGrowthPreviousParticipantCount(0)
          }
        } catch (error) {
          console.error("Failed to load growth survey participant counts:", error)
          setGrowthCurrentParticipantCount(0)
          setGrowthPreviousParticipantCount(0)
        }
      } catch (error) {
        console.error("Failed to load organization growth data:", error)
        // On error, show zero scores (no bonus points)
        const fallbackCategories = {
          "ルール": 0,
          "組織体制": 0,
          "評価制度": 0,
          "週報・会議": 0,
          "識学サーベイ": 1.5, // This is calculated from organizational survey
        }
        const errorData = [
          { name: "ルール" },
          { name: "組織体制" },
          { name: "評価制度" },
          { name: "週報・会議" },
          { name: "識学サーベイ" },
        ].map((cat) => ({
          category: cat.name,
          current: fallbackCategories[cat.name as keyof typeof fallbackCategories] || 0,
          previous: null,
          fullMark: 6,
        }))
        setOrganizationGrowthData(errorData)
        setGrowthCurrentParticipantCount(0)
        setGrowthPreviousParticipantCount(0)
      } finally {
        setOrganizationGrowthLoading(false)
      }
    }

    loadOrganizationGrowthData()
  }, [])

  // Load upcoming surveys (next organizational & growth surveys after today)
  useEffect(() => {
    const loadNextSurveys = async () => {
      try {
        const surveysRes = await api.surveys.list()
        if (!surveysRes?.success || !Array.isArray(surveysRes.surveys)) {
          setNextOrganizationalSurvey(null)
          setNextGrowthSurvey(null)
          return
        }

        const now = new Date()

        const findNextByType = (type: "organizational" | "growth") => {
          const upcoming = surveysRes.surveys
            .filter((s: any) => {
              if (s.surveyType !== type || !s.startDate) return false
              const d = new Date(s.startDate)
              if (Number.isNaN(d.getTime())) return false
              // Only surveys that start after "now" are considered "next"
              return d.getTime() > now.getTime()
            })
            .sort((a: any, b: any) => {
              const da = new Date(a.startDate).getTime()
              const db = new Date(b.startDate).getTime()
              return da - db
            })

          if (upcoming.length === 0) return null
          const s = upcoming[0]
          return { name: s.name as string, startDate: String(s.startDate) }
        }

        setNextOrganizationalSurvey(findNextByType("organizational"))
        setNextGrowthSurvey(findNextByType("growth"))
      } catch (error) {
        console.error("Failed to load next surveys:", error)
        setNextOrganizationalSurvey(null)
        setNextGrowthSurvey(null)
      }
    }

    loadNextSurveys()
  }, [])

  // Calculate highest scoring department from departmentChartData
  useEffect(() => {
    if (departmentChartData.length === 0) {
      setHighestScoreDepartment(null)
      return
    }

    // Find department with highest current score
    let highest: { name: string; score: number } | null = null
    for (const dept of departmentChartData) {
      if (dept.current !== null && dept.current !== undefined) {
        if (highest === null || dept.current > highest.score) {
          highest = { name: dept.name, score: dept.current }
        }
      }
    }

    setHighestScoreDepartment(highest)
  }, [departmentChartData])

  // Calculate lowest scoring category from radarData
  useEffect(() => {
    if (radarData.length === 0) {
      setLowestScoreCategory(null)
      return
    }

    // Find category with lowest current score
    let lowest: { name: string; score: number } | null = null
    for (const cat of radarData) {
      if (cat.current !== null && cat.current !== undefined) {
        if (lowest === null || cat.current < lowest.score) {
          lowest = { name: cat.category, score: cat.current }
        }
      }
    }

    setLowestScoreCategory(lowest)
  }, [radarData])

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
          <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
            {/* Page Header */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground mb-1 sm:mb-2">
                  ダッシュボード
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                  組織の健全性を一目で確認できます
                </p>
              </div>
            </div>

            {/* Overall Score Card (Current & Latest Organizational Survey Results) */}
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
                              onClick={async () => {
                                setShowDetailsDialog(true)
                                setDetailsLoading(true)
                                try {
                                  const response = await api.organizationalSurveySummary.getDetailed(currentSurveyId)
                                  if (response?.success && response.details) {
                                    setDetailsData(response.details)
                                    setCurrentSurveyName(response.surveyName || null)
                                  } else {
                                    setDetailsData([])
                                    setCurrentSurveyName(null)
                                  }
                                } catch (error) {
                                  console.error("Failed to load details:", error)
                                  setDetailsData([])
                                  setCurrentSurveyName(null)
                                } finally {
                                  setDetailsLoading(false)
                                }
                              }}
                              className="text-xs sm:text-sm"
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
                              onClick={async () => {
                                setShowDetailsDialog(true)
                                setDetailsLoading(true)
                                try {
                                  const response = await api.organizationalSurveySummary.getDetailed(latestSurveyId)
                                  if (response?.success && response.details) {
                                    setDetailsData(response.details)
                                    setCurrentSurveyName(response.surveyName || null)
                                  } else {
                                    setDetailsData([])
                                    setCurrentSurveyName(null)
                                  }
                                } catch (error) {
                                  console.error("Failed to load details:", error)
                                  setDetailsData([])
                                  setCurrentSurveyName(null)
                                } finally {
                                  setDetailsLoading(false)
                                }
                              }}
                              className="text-xs sm:text-sm"
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

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
              {/* Radar Chart */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2 sm:pb-3 md:pb-4">
                  <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg md:text-xl">カテゴリ別評価</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDetailedAnalysisModal(true)}
                    >
                      詳細
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-2 sm:p-3 md:p-6">
                  <ChartContainer
                    config={{
                      current: {
                        label: `現在サーベイ${radarCurrentParticipantCount > 0 ? `（${radarCurrentParticipantCount}）` : ""}`,
                        color: "oklch(0.45 0.15 264)",
                      },
                      previous: {
                        label: `前回サーベイ${radarPreviousParticipantCount > 0 ? `（${radarPreviousParticipantCount}）` : ""}`,
                        color: "oklch(0.65 0.12 264)",
                      },
                    }}
                    className="h-[200px] sm:h-[250px] md:h-[300px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <PolarGrid stroke="oklch(0.92 0.005 264)" />
                        <PolarAngleAxis
                          dataKey="category"
                          tick={{ fill: "oklch(0.55 0.01 264)", fontSize: isMobile ? 9 : 11 }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 100]}
                          tick={{ fill: "oklch(0.55 0.01 264)", fontSize: isMobile ? 8 : 10 }}
                        />
                        <Radar
                          name={`現在サーベイ${radarCurrentParticipantCount > 0 ? `（${radarCurrentParticipantCount}）` : ""}`}
                          dataKey="current"
                          stroke="oklch(0.45 0.15 264)"
                          fill="oklch(0.45 0.15 264)"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name={`前回サーベイ${radarPreviousParticipantCount > 0 ? `（${radarPreviousParticipantCount}）` : ""}`}
                          dataKey="previous"
                          stroke="oklch(0.65 0.12 264)"
                          fill="oklch(0.65 0.12 264)"
                          fillOpacity={0.1}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "oklch(0.98 0.002 264)",
                            border: "1px solid oklch(0.92 0.005 264)",
                            borderRadius: "6px",
                            fontSize: "12px",
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
                        onClick={async () => {
                          setShowDepartmentCategoryDialog(true)
                          setDepartmentCategoryLoading(true)
                          try {
                            // 現在のサーベイデータを取得
                            const currentResponse = await api.organizationalSurveySummary.getDepartmentCategory(radarCurrentSurveyId)
                            if (currentResponse?.success && currentResponse.departmentCategoryScores) {
                              setDepartmentCategoryData(currentResponse.departmentCategoryScores)
                              setDepartmentCategorySurveyName(currentResponse.surveyName || null)
                            } else {
                              setDepartmentCategoryData([])
                              setDepartmentCategorySurveyName(null)
                            }

                            // 以前のサーベイデータを取得（存在する場合）
                            if (radarPreviousSurveyId) {
                              try {
                                const previousResponse = await api.organizationalSurveySummary.getDepartmentCategory(radarPreviousSurveyId)
                                if (previousResponse?.success && previousResponse.departmentCategoryScores) {
                                  setDepartmentCategoryPreviousData(previousResponse.departmentCategoryScores)
                                  setDepartmentCategoryPreviousSurveyName(previousResponse.surveyName || null)
                                } else {
                                  setDepartmentCategoryPreviousData([])
                                  setDepartmentCategoryPreviousSurveyName(null)
                                }
                              } catch (error) {
                                console.error("Failed to load previous department category scores:", error)
                                setDepartmentCategoryPreviousData([])
                                setDepartmentCategoryPreviousSurveyName(null)
                              }
                            } else {
                              setDepartmentCategoryPreviousData([])
                              setDepartmentCategoryPreviousSurveyName(null)
                            }
                          } catch (error) {
                            console.error("Failed to load department category scores:", error)
                            setDepartmentCategoryData([])
                            setDepartmentCategorySurveyName(null)
                            setDepartmentCategoryPreviousData([])
                            setDepartmentCategoryPreviousSurveyName(null)
                          } finally {
                            setDepartmentCategoryLoading(false)
                          }
                        }}
                        className="text-xs sm:text-sm"
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
                        label: `現在サーベイ${radarCurrentParticipantCount > 0 ? `（${radarCurrentParticipantCount}）` : ""}`,
                        color: "oklch(0.45 0.15 264)",
                      },
                      previous: {
                        label: `前回サーベイ${radarPreviousParticipantCount > 0 ? `（${radarPreviousParticipantCount}）` : ""}`,
                        color: "oklch(0.65 0.12 264)",
                      },
                    }}
                    className="h-[200px] sm:h-[250px] md:h-[300px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentChartData} margin={{ top: 10, right: 10, bottom: 30, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 264)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "oklch(0.55 0.01 264)", fontSize: isMobile ? 9 : 10 }}
                          angle={isMobile ? -45 : 0}
                          textAnchor={isMobile ? "end" : "middle"}
                          height={isMobile ? 60 : 30}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: "oklch(0.55 0.01 264)", fontSize: isMobile ? 8 : 10 }}
                          width={isMobile ? 30 : 40}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {/* 並んだ棒グラフ（前回：薄い色、現在：濃い色） */}
                        <Bar
                          dataKey="previous"
                          name={`前回サーベイ${radarPreviousParticipantCount > 0 ? `（${radarPreviousParticipantCount}）` : ""}`}
                          fill="oklch(0.75 0.12 264)"
                          radius={[4, 4, 0, 0]}
                          barSize={14}
                        />
                        <Bar
                          dataKey="current"
                          name={`現在サーベイ${radarCurrentParticipantCount > 0 ? `（${radarCurrentParticipantCount}）` : ""}`}
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

       
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 sm:pb-3 md:pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg md:text-xl">組織の グロース状態</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Get current survey ID from the loaded data
                      const surveysRes = await api.surveys.list()
                      if (surveysRes?.success && Array.isArray(surveysRes.surveys)) {
                        const growthSurveys = surveysRes.surveys.filter((s: any) => s.surveyType === 'growth')
                        if (growthSurveys.length > 0) {
                          // Get the current (most recent) survey
                          const currentSurvey = growthSurveys.sort((a: any, b: any) => {
                            const aEnd = a.endDate ? new Date(a.endDate).getTime() : 0
                            const bEnd = b.endDate ? new Date(b.endDate).getTime() : 0
                            if (aEnd !== bEnd) return bEnd - aEnd
                            const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
                            const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
                            if (aCreated !== bCreated) return bCreated - aCreated
                            return Number(b.id) - Number(a.id)
                          })[0]
                          
                          if (currentSurvey) {
                            setSelectedGrowthSurveyId(String(currentSurvey.id))
                            setShowGrowthQuestionResponsesDialog(true)
                            setGrowthQuestionResponsesLoading(true)
                            try {
                              const response = await api.growthSurveyResponses.getQuestionResponses(String(currentSurvey.id))
                              if (response?.success && response.questions) {
                                setGrowthQuestionResponsesData(response.questions)
                              } else {
                                setGrowthQuestionResponsesData([])
                              }
                            } catch (error) {
                              console.error("Failed to load growth question responses:", error)
                              setGrowthQuestionResponsesData([])
                            } finally {
                              setGrowthQuestionResponsesLoading(false)
                            }
                          }
                        }
                      }
                    }}
                  >
                    詳細
                  </Button>
                </div>
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
                        label: `現在サーベイ${growthCurrentParticipantCount > 0 ? `（${growthCurrentParticipantCount}）` : ""}`,
                        color: "oklch(0.50 0.20 240)",
                      },
                      previous: {
                        label: `前回サーベイ${growthPreviousParticipantCount > 0 ? `（${growthPreviousParticipantCount}）` : ""}`,
                        color: "oklch(0.60 0.18 30)",
                      },
                    }}
                    className="h-[200px] sm:h-[250px] md:h-[300px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={organizationGrowthData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <PolarGrid stroke="oklch(0.92 0.005 120)" />
                        <PolarAngleAxis
                          dataKey="category"
                          tick={{ fill: "oklch(0.55 0.01 120)", fontSize: isMobile ? 9 : 11 }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 6]}
                          tickCount={7}
                          tick={{ fill: "oklch(0.55 0.01 120)", fontSize: isMobile ? 8 : 10 }}
                        />
                        <Radar
                          name={`現在サーベイ${growthCurrentParticipantCount > 0 ? `（${growthCurrentParticipantCount}）` : ""}`}
                          dataKey="current"
                          stroke="oklch(0.50 0.20 240)"
                          fill="oklch(0.50 0.20 240)"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name={`前回サーベイ${growthPreviousParticipantCount > 0 ? `（${growthPreviousParticipantCount}）` : ""}`}
                          dataKey="previous"
                          stroke="oklch(0.60 0.18 30)"
                          fill="oklch(0.60 0.18 30)"
                          fillOpacity={0.2}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "oklch(0.98 0.002 120)",
                            border: "1px solid oklch(0.92 0.005 120)",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Growth Survey Question Responses Dialog */}
            <Dialog open={showGrowthQuestionResponsesDialog} onOpenChange={setShowGrowthQuestionResponsesDialog}>
              <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[95vw] md:w-[90vw] lg:w-[85vw] xl:w-[80vw] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-3 sm:p-4 md:p-6">
                <DialogHeader className="pb-2 flex-shrink-0">
                  <DialogTitle className="text-base sm:text-lg md:text-xl">グロースサーベイ回答状況</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm mt-1">
                    各問題に対する回答状況を確認できます
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-0">
                {growthQuestionResponsesLoading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm sm:text-base">読み込み中です…</div>
                ) : growthQuestionResponsesData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm sm:text-base">回答データがありません</div>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                    {growthQuestionResponsesData.map((question) => (
                      <Card key={question.questionId}>
                          <CardHeader className="pb-2 sm:pb-3">
                            <CardTitle className="text-sm sm:text-base md:text-lg break-words">
                            {question.questionText}
                          </CardTitle>
                          {question.category && (
                              <CardDescription className="text-xs sm:text-sm">カテゴリ: {question.category}</CardDescription>
                          )}
                            <CardDescription className="text-xs sm:text-sm">回答者数: {question.totalRespondents}名</CardDescription>
                        </CardHeader>
                          <CardContent className="p-3 sm:p-4 md:p-6">
                            <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                    <TableHead className="w-[50%] sm:w-[60%] text-xs sm:text-sm">回答</TableHead>
                                    <TableHead className="text-center text-xs sm:text-sm">選択人数</TableHead>
                                    <TableHead className="text-center text-xs sm:text-sm">割合</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {question.options.map((option, index) => {
                                const percentage = question.totalRespondents > 0
                                  ? ((option.count / question.totalRespondents) * 100).toFixed(1)
                                  : '0.0'
                                return (
                                  <TableRow key={index}>
                                        <TableCell className="text-xs sm:text-sm break-words">{option.label}</TableCell>
                                        <TableCell className="text-center font-medium text-xs sm:text-sm">{option.count}名</TableCell>
                                        <TableCell className="text-center text-xs sm:text-sm">{percentage}%</TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                            </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                </div>
              </DialogContent>
            </Dialog>

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
                    onClick={async () => {
                      setShowAllSurveysDialog(true)
                      setAllSurveysLoading(true)
                      try {
                        const response = await api.organizationalSurveySummary.getAllSurveysDetails()
                        if (response?.success && response.surveys) {
                          setAllSurveysData(response.surveys)
                        } else {
                          setAllSurveysData([])
                        }
                      } catch (error) {
                        console.error("Failed to load all surveys details:", error)
                        setAllSurveysData([])
                      } finally {
                        setAllSurveysLoading(false)
                      }
                    }}
                    className="text-xs sm:text-sm"
                  >
                    詳細
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2 sm:p-3 md:p-6">
                <ChartContainer
                  config={{
                    score: {
                      label: "スコア",
                      color: "oklch(0.45 0.15 264)",
                    },
                  }}
                  className="h-[180px] sm:h-[220px] md:h-[280px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 264)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "oklch(0.55 0.01 264)", fontSize: isMobile ? 9 : 10 }}
                        width={isMobile ? 30 : 40}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "oklch(0.55 0.01 264)", fontSize: isMobile ? 8 : 10 }}
                        width={isMobile ? 30 : 40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "oklch(0.98 0.002 264)",
                          border: "1px solid oklch(0.92 0.005 264)",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [`スコア：${value}`, ""]}
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
              </CardContent>
            </Card>

            {/* Quick Stats */}
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
                  <CardDescription className="text-xs sm:text-sm">次回サーベイ</CardDescription>
                </CardHeader>
                <CardContent>
                  {(!nextOrganizationalSurvey && !nextGrowthSurvey) ? (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      現在、予定されているサーベイはありません。
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-xs sm:text-sm">
                        <span className="font-medium">ソシキサーベイ: </span>
                        {nextOrganizationalSurvey ? (
                          <>
                            <span>{nextOrganizationalSurvey.name}</span>
                            <span className="ml-1 text-[11px] sm:text-xs text-muted-foreground">
                              ({nextOrganizationalSurvey.startDate.slice(0, 10)})
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">未定</span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm">
                        <span className="font-medium">グロースサーベイ: </span>
                        {nextGrowthSurvey ? (
                          <>
                            <span>{nextGrowthSurvey.name}</span>
                            <span className="ml-1 text-[11px] sm:text-xs text-muted-foreground">
                              ({nextGrowthSurvey.startDate.slice(0, 10)})
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">未定</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* 個別スコア詳細ダイアログ */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[99vw] md:w-[98vw] lg:w-[97vw] xl:w-[96vw] 2xl:w-[95vw] max-w-[95vw] md:max-w-[98vw] lg:max-w-[97vw] xl:max-w-[96vw] 2xl:max-w-[95vw] h-[85vh] lg:h-[80vh] max-h-[90vh] overflow-hidden flex flex-col p-3 md:p-4">
          <DialogHeader className="pb-2 flex-shrink-0">
            <DialogTitle className="text-base md:text-lg">現在のソシキサーベイ結果 - 個別スコア</DialogTitle>
            {currentSurveyName && (
              <div className="mt-1 text-xs md:text-sm font-medium text-foreground">
                サーベイ名: {currentSurveyName}
              </div>
            )}
            <DialogDescription className="text-xs mt-1">
              参加メンバーの個別スコアを詳細します
            </DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="group-by-department"
                checked={groupByDepartment}
                onCheckedChange={setGroupByDepartment}
              />
              <Label htmlFor="group-by-department" className="text-xs cursor-pointer">
                部門別に並べ替え
              </Label>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden min-h-0">
          {detailsLoading ? (
            <div className="text-center py-8 text-base text-muted-foreground">読み込み中...</div>
          ) : detailsData.length === 0 ? (
            <div className="text-center py-8 text-base text-muted-foreground">データがありません</div>
          ) : (
            <div className="w-full h-full overflow-auto md:overflow-x-hidden md:overflow-y-auto">
              <Table className="w-full min-w-[900px] md:min-w-0 md:table-fixed md:w-full">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[35px] md:w-[4%] px-1 md:px-0.5 py-1.5 text-center">番号</TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[85px] md:w-[9%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('userName')}
                    >
                      名前 <DetailsSortIcon columnKey="userName" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[75px] md:w-[8%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('departmentName')}
                    >
                      部署 <DetailsSortIcon columnKey="departmentName" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[75px] md:w-[7%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('jobName')}
                    >
                      職務 <DetailsSortIcon columnKey="jobName" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[110px] md:w-[11%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('updatedAt')}
                    >
                      応答日時 <DetailsSortIcon columnKey="updatedAt" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[70px] md:w-[7%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('category1Score')}
                    >
                      自己評価 <DetailsSortIcon columnKey="category1Score" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[75px] md:w-[7%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('category7Score')}
                    >
                      位置認識 <DetailsSortIcon columnKey="category7Score" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[60px] md:w-[6%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('category5Score')}
                    >
                      結果明確 <DetailsSortIcon columnKey="category5Score" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[60px] md:w-[6%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('category3Score')}
                    >
                      成果視点 <DetailsSortIcon columnKey="category3Score" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[60px] md:w-[6%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('category2Score')}
                    >
                      免責意識 <DetailsSortIcon columnKey="category2Score" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[70px] md:w-[7%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('category4Score')}
                    >
                      行動優先 <DetailsSortIcon columnKey="category4Score" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[60px] md:w-[6%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('category6Score')}
                    >
                      時感覚 <DetailsSortIcon columnKey="category6Score" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[65px] md:w-[7%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('totalScore')}
                    >
                      総合 <DetailsSortIcon columnKey="totalScore" />
                    </TableHead>
                    <TableHead 
                      className="text-[10px] md:text-xs whitespace-nowrap w-[60px] md:w-[7%] px-1 md:px-0.5 py-1.5 cursor-pointer hover:bg-muted/50 text-center"
                      onClick={() => handleSort('responseRate')}
                    >
                      応答率 <DetailsSortIcon columnKey="responseRate" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.map((detail, index) => {
                    const formatDateTime = (dateString: string) => {
                      const date = new Date(dateString)
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      const hours = String(date.getHours()).padStart(2, '0')
                      const minutes = String(date.getMinutes()).padStart(2, '0')
                      return `${year}-${month}-${day} ${hours}:${minutes}`
                    }
                    return (
                      <TableRow key={detail.id}>
                        <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5">{index + 1}</TableCell>
                        <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 truncate" title={detail.userName || "-"}>{detail.userName || "-"}</TableCell>
                        <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 truncate" title={detail.departmentName || "-"}>{detail.departmentName || "-"}</TableCell>
                        <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 truncate" title={detail.jobName || "-"}>{detail.jobName || "-"}</TableCell>
                        <TableCell className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5">{formatDateTime(detail.updatedAt)}</TableCell>
                        <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(detail.category1Score)}`}>{detail.category1Score.toFixed(1)}</TableCell>
                        <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(detail.category7Score)}`}>{detail.category7Score.toFixed(1)}</TableCell>
                        <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(detail.category5Score)}`}>{detail.category5Score.toFixed(1)}</TableCell>
                        <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(detail.category3Score)}`}>{detail.category3Score.toFixed(1)}</TableCell>
                        <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(detail.category2Score)}`}>{detail.category2Score.toFixed(1)}</TableCell>
                        <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(detail.category4Score)}`}>{detail.category4Score.toFixed(1)}</TableCell>
                        <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(detail.category6Score)}`}>{detail.category6Score.toFixed(1)}</TableCell>
                        <TableCell className={`text-[10px] md:text-xs font-medium px-1 md:px-0.5 py-1.5 text-center ${getScoreColorClass(detail.totalScore)}`}>{detail.totalScore.toFixed(1)}</TableCell>
                        <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center">{detail.responseRate !== null ? `${detail.responseRate.toFixed(1)}%` : "-"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 部署別・カテゴリ別スコア詳細ダイアログ */}
      <Dialog open={showDepartmentCategoryDialog} onOpenChange={setShowDepartmentCategoryDialog}>
        <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[99vw] md:w-[98vw] lg:w-[97vw] xl:w-[96vw] 2xl:w-[95vw] max-w-[95vw] md:max-w-[98vw] lg:max-w-[97vw] xl:max-w-[96vw] 2xl:max-w-[95vw] h-[88vh] md:h-[90vh] max-h-[95vh] overflow-hidden flex flex-col p-3 md:p-4">
          <DialogHeader className="pb-2 flex-shrink-0">
            <DialogTitle className="text-base md:text-lg">部署別・カテゴリ別スコア</DialogTitle>
            <div className="mt-1 space-y-1">
              {departmentCategorySurveyName && (
                <div className="text-xs md:text-sm font-medium text-foreground">
                  現在サーベイ: {departmentCategorySurveyName}
                </div>
              )}
              {departmentCategoryPreviousSurveyName && (
                <div className="text-xs md:text-sm font-medium text-muted-foreground">
                  以前サーベイ: {departmentCategoryPreviousSurveyName}
                </div>
              )}
            </div>
            <DialogDescription className="text-xs mt-1">
              各部署のカテゴリ別平均スコアを詳細します（現在サーベイ / 以前サーベイ）
            </DialogDescription>
          </DialogHeader>
          <div className="flex-shrink-0 mb-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="部署名で検索..."
                value={departmentCategorySearchQuery}
                onChange={(e) => setDepartmentCategorySearchQuery(e.target.value)}
                className="pl-8 text-xs md:text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {departmentCategoryLoading ? (
              <div className="text-center py-8 text-base text-muted-foreground">読み込み中...</div>
            ) : departmentCategoryData.length === 0 ? (
              <div className="text-center py-8 text-base text-muted-foreground">データがありません</div>
            ) : (
              <div className="w-full h-full overflow-auto md:overflow-x-hidden md:overflow-y-auto">
                <div className="min-w-[1200px] md:min-w-0 md:w-full">
                  <Table className="w-full md:table-auto md:w-full">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[100px] md:w-auto px-1 py-1.5 text-center" rowSpan={departmentCategoryPreviousData.length > 0 ? 2 : 1}>部署</TableHead>
                      {departmentCategoryPreviousData.length > 0 ? (
                        <>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>参加者</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>変化意識</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>成果視点</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>行動優先</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>結果明確</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>自己評価</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>時感覚</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>位置認識</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>免責意識</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center" colSpan={2}>総合</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[50px] px-1 py-1.5 text-center">参加者</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[70px] px-1 py-1.5 text-center">変化意識</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[70px] px-1 py-1.5 text-center">成果視点</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[80px] px-1 py-1.5 text-center">行動優先</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[70px] px-1 py-1.5 text-center">結果明確</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[80px] px-1 py-1.5 text-center">自己評価</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[70px] px-1 py-1.5 text-center">時感覚</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[80px] px-1 py-1.5 text-center">位置認識</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[70px] px-1 py-1.5 text-center">免責意識</TableHead>
                          <TableHead className="text-[10px] md:text-xs whitespace-nowrap w-[65px] px-1 py-1.5 text-center">総合</TableHead>
                        </>
                      )}
                    </TableRow>
                    {departmentCategoryPreviousData.length > 0 && (
                      <TableRow>
                        {/* 参加者 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 変化意識 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 成果視点 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 行動優先 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 結果明確 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 自己評価 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 時感覚 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 位置認識 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 免責意識 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                        {/* 総合 */}
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">現在</TableHead>
                        <TableHead className="text-[10px] md:text-xs whitespace-nowrap px-1 md:px-0.5 py-1.5 text-center bg-muted/30">以前</TableHead>
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {filteredDepartmentCategoryData.map((dept) => {
                      const previousDept = departmentCategoryPreviousData.find((prev) => prev.departmentName === dept.departmentName)
                      return (
                        <TableRow key={dept.departmentId}>
                          <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 truncate" title={dept.departmentName}>{dept.departmentName}</TableCell>
                          {departmentCategoryPreviousData.length > 0 ? (
                            <>
                              <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center">{dept.participantCount != null ? dept.participantCount : '-'}</TableCell>
                              <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center">{previousDept && previousDept.participantCount != null ? previousDept.participantCount : '-'}</TableCell>
                            </>
                          ) : (
                            <TableCell className="text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center">{dept.participantCount != null ? dept.participantCount : '-'}</TableCell>
                          )}
                          {departmentCategoryPreviousData.length > 0 ? (
                            <>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${dept.category1Avg != null ? getScoreColorClass(dept.category1Avg) : ''}`}>{dept.category1Avg != null ? dept.category1Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${previousDept && previousDept.category1Avg != null ? getScoreColorClass(previousDept.category1Avg) : 'text-muted-foreground'}`}>{previousDept && previousDept.category1Avg != null ? previousDept.category1Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${dept.category2Avg != null ? getScoreColorClass(dept.category2Avg) : ''}`}>{dept.category2Avg != null ? dept.category2Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${previousDept && previousDept.category2Avg != null ? getScoreColorClass(previousDept.category2Avg) : 'text-muted-foreground'}`}>{previousDept && previousDept.category2Avg != null ? previousDept.category2Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${dept.category3Avg != null ? getScoreColorClass(dept.category3Avg) : ''}`}>{dept.category3Avg != null ? dept.category3Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${previousDept && previousDept.category3Avg != null ? getScoreColorClass(previousDept.category3Avg) : 'text-muted-foreground'}`}>{previousDept && previousDept.category3Avg != null ? previousDept.category3Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${dept.category4Avg != null ? getScoreColorClass(dept.category4Avg) : ''}`}>{dept.category4Avg != null ? dept.category4Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${previousDept && previousDept.category4Avg != null ? getScoreColorClass(previousDept.category4Avg) : 'text-muted-foreground'}`}>{previousDept && previousDept.category4Avg != null ? previousDept.category4Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${dept.category5Avg != null ? getScoreColorClass(dept.category5Avg) : ''}`}>{dept.category5Avg != null ? dept.category5Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${previousDept && previousDept.category5Avg != null ? getScoreColorClass(previousDept.category5Avg) : 'text-muted-foreground'}`}>{previousDept && previousDept.category5Avg != null ? previousDept.category5Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${dept.category6Avg != null ? getScoreColorClass(dept.category6Avg) : ''}`}>{dept.category6Avg != null ? dept.category6Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${previousDept && previousDept.category6Avg != null ? getScoreColorClass(previousDept.category6Avg) : 'text-muted-foreground'}`}>{previousDept && previousDept.category6Avg != null ? previousDept.category6Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${dept.category7Avg != null ? getScoreColorClass(dept.category7Avg) : ''}`}>{dept.category7Avg != null ? dept.category7Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${previousDept && previousDept.category7Avg != null ? getScoreColorClass(previousDept.category7Avg) : 'text-muted-foreground'}`}>{previousDept && previousDept.category7Avg != null ? previousDept.category7Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${dept.category8Avg != null ? getScoreColorClass(dept.category8Avg) : ''}`}>{dept.category8Avg != null ? dept.category8Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${previousDept && previousDept.category8Avg != null ? getScoreColorClass(previousDept.category8Avg) : 'text-muted-foreground'}`}>{previousDept && previousDept.category8Avg != null ? previousDept.category8Avg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs font-medium px-1 md:px-0.5 py-1.5 text-center ${dept.totalAvg != null ? getScoreColorClass(dept.totalAvg) : ''}`}>{dept.totalAvg != null ? dept.totalAvg.toFixed(1) : '-'}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs font-medium px-1 md:px-0.5 py-1.5 text-center ${previousDept && previousDept.totalAvg != null ? getScoreColorClass(previousDept.totalAvg) : 'text-muted-foreground'}`}>{previousDept && previousDept.totalAvg != null ? previousDept.totalAvg.toFixed(1) : '-'}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(dept.category1Avg)}`}>{dept.category1Avg.toFixed(1)}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(dept.category2Avg)}`}>{dept.category2Avg.toFixed(1)}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(dept.category3Avg)}`}>{dept.category3Avg.toFixed(1)}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(dept.category4Avg)}`}>{dept.category4Avg.toFixed(1)}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(dept.category5Avg)}`}>{dept.category5Avg.toFixed(1)}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(dept.category6Avg)}`}>{dept.category6Avg.toFixed(1)}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(dept.category7Avg)}`}>{dept.category7Avg.toFixed(1)}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs px-1 md:px-0.5 py-1.5 text-center font-medium ${getScoreColorClass(dept.category8Avg)}`}>{dept.category8Avg.toFixed(1)}</TableCell>
                              <TableCell className={`text-[10px] md:text-xs font-medium px-1 md:px-0.5 py-1.5 text-center ${getScoreColorClass(dept.totalAvg)}`}>{dept.totalAvg.toFixed(1)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 全サーベイ詳細データ詳細ダイアログ */}
      <Dialog open={showAllSurveysDialog} onOpenChange={setShowAllSurveysDialog}>
        <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[99vw] md:w-[98vw] lg:w-[97vw] xl:w-[96vw] 2xl:w-[95vw] max-w-[95vw] md:max-w-[98vw] lg:max-w-[97vw] xl:max-w-[96vw] 2xl:max-w-[95vw] h-[88vh] md:h-[90vh] max-h-[95vh] overflow-hidden flex flex-col p-3 md:p-4">
          <DialogHeader className="pb-2 flex-shrink-0">
            <DialogTitle className="text-base md:text-lg">全ソシキサーベイ詳細データ</DialogTitle>
            <DialogDescription className="text-xs mt-1">
              すべてのソシキサーベイの従業員データ、サーベイデータ、部署データを詳細します
            </DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="group-by-department-all-surveys"
                checked={groupByDepartmentAllSurveys}
                onCheckedChange={setGroupByDepartmentAllSurveys}
              />
              <Label htmlFor="group-by-department-all-surveys" className="text-xs cursor-pointer">
                部門別に並べ替え
              </Label>
            </div>
          </DialogHeader>
          <div className="flex-shrink-0 mb-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="サーベイ名、部署名、従業員名で検索..."
                value={allSurveysSearchQuery}
                onChange={(e) => setAllSurveysSearchQuery(e.target.value)}
                className="pl-8 text-xs md:text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {allSurveysLoading ? (
              <div className="text-center py-8 text-base text-muted-foreground">読み込み中...</div>
            ) : allSurveysData.length === 0 ? (
              <div className="text-center py-8 text-base text-muted-foreground">データがありません</div>
            ) : (
              <div className="w-full h-full overflow-auto md:overflow-x-hidden md:overflow-y-auto">
                <div className="space-y-6">
                  {filteredAllSurveysData.map((survey) => {
                    const formatDate = (dateString: string) => {
                      const date = new Date(dateString)
                      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                    }
                    return (
                      <div key={survey.surveyId} className="border rounded-lg p-4 space-y-4">
                        {/* Survey Header */}
                        <div className="border-b pb-2">
                          <h3 className="text-sm md:text-base font-semibold">{survey.surveyName}</h3>
                          <div className="text-xs text-muted-foreground mt-1">
                            期間: {formatDate(survey.startDate)} ～ {formatDate(survey.endDate)} | 
                            参加者数: {survey.totalParticipants}名 | 
                            平均スコア: {survey.overallAverageScore.toFixed(1)}点
                          </div>
                        </div>

                        {/* Departments Section */}
                        <div>
                          <h4 className="text-xs md:text-sm font-medium mb-2">部署別データ</h4>
                          <div className="overflow-x-auto md:overflow-x-visible">
                            <Table className="w-full min-w-[800px] md:min-w-0 md:table-auto text-[10px] md:text-xs">
                              <TableHeader>
                                <TableRow>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'departmentName')}
                                  >
                                    部署 <AllSurveysSortIcon columnKey="departmentName" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'participantCount')}
                                  >
                                    参加者 <AllSurveysSortIcon columnKey="participantCount" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageTotalScore')}
                                  >
                                    総合 <AllSurveysSortIcon columnKey="averageTotalScore" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageCategory1')}
                                  >
                                    変化 <AllSurveysSortIcon columnKey="averageCategory1" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageCategory2')}
                                  >
                                    成果 <AllSurveysSortIcon columnKey="averageCategory2" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageCategory3')}
                                  >
                                    行動 <AllSurveysSortIcon columnKey="averageCategory3" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageCategory4')}
                                  >
                                    結果 <AllSurveysSortIcon columnKey="averageCategory4" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageCategory5')}
                                  >
                                    自己 <AllSurveysSortIcon columnKey="averageCategory5" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageCategory6')}
                                  >
                                    時感 <AllSurveysSortIcon columnKey="averageCategory6" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageCategory7')}
                                  >
                                    位置 <AllSurveysSortIcon columnKey="averageCategory7" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleDeptSort(survey.surveyId, 'averageCategory8')}
                                  >
                                    免責 <AllSurveysSortIcon columnKey="averageCategory8" currentSortConfig={deptSortConfig.surveyId === survey.surveyId ? deptSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {getSortedDepartments(survey.surveyId, survey.departments).map((dept) => (
                                  <TableRow key={`${survey.surveyId}-${dept.departmentId}`}>
                                    <TableCell className="px-1 py-1">{dept.departmentName}</TableCell>
                                    <TableCell className="px-1 py-1 text-center">{dept.participantCount}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageTotalScore)}`}>{dept.averageTotalScore.toFixed(1)}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageCategory1)}`}>{dept.averageCategory1.toFixed(1)}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageCategory2)}`}>{dept.averageCategory2.toFixed(1)}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageCategory3)}`}>{dept.averageCategory3.toFixed(1)}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageCategory4)}`}>{dept.averageCategory4.toFixed(1)}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageCategory5)}`}>{dept.averageCategory5.toFixed(1)}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageCategory6)}`}>{dept.averageCategory6.toFixed(1)}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageCategory7)}`}>{dept.averageCategory7.toFixed(1)}</TableCell>
                                    <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(dept.averageCategory8)}`}>{dept.averageCategory8.toFixed(1)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* Participants Section */}
                        <div>
                          <h4 className="text-xs md:text-sm font-medium mb-2">従業員データ ({survey.participants.length}名)</h4>
                          <div className="overflow-x-auto md:overflow-x-visible max-h-[300px]">
                            <Table className="w-full min-w-[850px] md:min-w-0 md:table-auto text-[10px] md:text-xs">
                              <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'userName')}
                                  >
                                    名前 <AllSurveysSortIcon columnKey="userName" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'departmentName')}
                                  >
                                    部署 <AllSurveysSortIcon columnKey="departmentName" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'jobName')}
                                  >
                                    職務 <AllSurveysSortIcon columnKey="jobName" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'totalScore')}
                                  >
                                    総合 <AllSurveysSortIcon columnKey="totalScore" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'category1Score')}
                                  >
                                    変化 <AllSurveysSortIcon columnKey="category1Score" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'category2Score')}
                                  >
                                    成果 <AllSurveysSortIcon columnKey="category2Score" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'category3Score')}
                                  >
                                    行動 <AllSurveysSortIcon columnKey="category3Score" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'category4Score')}
                                  >
                                    結果 <AllSurveysSortIcon columnKey="category4Score" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'category5Score')}
                                  >
                                    自己 <AllSurveysSortIcon columnKey="category5Score" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'category6Score')}
                                  >
                                    時感 <AllSurveysSortIcon columnKey="category6Score" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'category7Score')}
                                  >
                                    位置 <AllSurveysSortIcon columnKey="category7Score" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'category8Score')}
                                  >
                                    免責 <AllSurveysSortIcon columnKey="category8Score" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'responseRate')}
                                  >
                                    応答率 <AllSurveysSortIcon columnKey="responseRate" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                  <TableHead 
                                    className="px-1 py-1 cursor-pointer hover:bg-muted/50 text-center"
                                    onClick={() => handleParticipantSort(survey.surveyId, 'updatedAt')}
                                  >
                                    応答日時 <AllSurveysSortIcon columnKey="updatedAt" currentSortConfig={participantSortConfig.surveyId === survey.surveyId ? participantSortConfig : { key: null, direction: 'asc' }} />
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {getSortedParticipants(survey.surveyId, survey.participants).map((participant) => {
                                  const formatDateTime = (dateString: string) => {
                                    const date = new Date(dateString)
                                    const year = date.getFullYear()
                                    const month = String(date.getMonth() + 1).padStart(2, '0')
                                    const day = String(date.getDate()).padStart(2, '0')
                                    const hours = String(date.getHours()).padStart(2, '0')
                                    const minutes = String(date.getMinutes()).padStart(2, '0')
                                    return `${year}-${month}-${day} ${hours}:${minutes}`
                                  }
                                  return (
                                    <TableRow key={participant.id}>
                                      <TableCell className="px-1 py-1">{participant.userName}</TableCell>
                                      <TableCell className="px-1 py-1">{participant.departmentName}</TableCell>
                                      <TableCell className="px-1 py-1">{participant.jobName}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.totalScore)}`}>{participant.totalScore.toFixed(1)}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.category1Score)}`}>{participant.category1Score.toFixed(1)}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.category2Score)}`}>{participant.category2Score.toFixed(1)}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.category3Score)}`}>{participant.category3Score.toFixed(1)}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.category4Score)}`}>{participant.category4Score.toFixed(1)}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.category5Score)}`}>{participant.category5Score.toFixed(1)}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.category6Score)}`}>{participant.category6Score.toFixed(1)}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.category7Score)}`}>{participant.category7Score.toFixed(1)}</TableCell>
                                      <TableCell className={`px-1 py-1 text-center font-medium ${getScoreColorClass(participant.category8Score)}`}>{participant.category8Score.toFixed(1)}</TableCell>
                                      <TableCell className="px-1 py-1 text-center">{participant.responseRate !== null ? `${participant.responseRate.toFixed(1)}%` : "-"}</TableCell>
                                      <TableCell className="px-1 py-1 text-center whitespace-nowrap">{formatDateTime(participant.updatedAt)}</TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detailed Analysis Modal */}
      <Dialog open={showDetailedAnalysisModal} onOpenChange={setShowDetailedAnalysisModal}>
        <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[99vw] md:w-[98vw] lg:w-[97vw] xl:w-[96vw] 2xl:w-[95vw] max-w-[95vw] md:max-w-[98vw] lg:max-w-[97vw] xl:max-w-[96vw] 2xl:max-w-[95vw] h-[88vh] md:h-[90vh] max-h-[95vh] overflow-hidden flex flex-col p-3 md:p-4">
          <DialogHeader className="pb-2 flex-shrink-0">
            <DialogTitle className="text-base md:text-lg">詳細分析レポート</DialogTitle>
            <DialogDescription className="text-xs mt-1">
              各サーベイ別、各カテゴリ別、各部署別、各従業員別、各問題別の回答状況
            </DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="group-by-department-detailed-responses"
                checked={groupByDepartmentDetailedResponses}
                onCheckedChange={setGroupByDepartmentDetailedResponses}
              />
              <Label htmlFor="group-by-department-detailed-responses" className="text-xs cursor-pointer">
                部門別に並べ替え
              </Label>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-6 mt-4">
            {/* Filters Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">フィルター条件</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Survey Multi-Select */}
                <div className="space-y-2">
                  <Label className="text-sm">サーベイ（複数選択）</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between text-sm h-9 sm:h-10">
                        <span className="truncate flex-1 text-left">
                        {selectedSurveyIds.length === 0
                          ? "サーベイを選択"
                          : `${selectedSurveyIds.length}個選択中`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[var(--radix-popover-trigger-width)] p-0 !z-[110]"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                      style={{ 
                        width: 'var(--radix-popover-trigger-width)',
                        maxWidth: 'calc(100vw - 2rem)',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-y'
                      } as React.CSSProperties}
                    >
                      <div 
                        className="p-2 space-y-1 sm:space-y-2 max-h-[60vh] sm:max-h-60 overflow-y-auto overscroll-contain"
                        style={{ 
                          WebkitOverflowScrolling: 'touch',
                          overflowY: 'auto',
                          scrollBehavior: 'smooth',
                          touchAction: 'pan-y'
                        } as React.CSSProperties}
                        onWheel={(e) => {
                          // Ensure wheel scrolling works
                          e.currentTarget.scrollTop += e.deltaY
                        }}
                      >
                        {availableSurveys.map((survey) => (
                          <div
                            key={survey.id}
                            className="flex items-start space-x-2 p-2 sm:p-2.5 hover:bg-muted active:bg-muted rounded-sm cursor-pointer touch-manipulation min-h-[44px] sm:min-h-auto"
                            onClick={() => {
                              setSelectedSurveyIds((prev) =>
                                prev.includes(survey.id)
                                  ? prev.filter((id) => id !== survey.id)
                                  : [...prev, survey.id]
                              )
                            }}
                          >
                            <Checkbox
                              checked={selectedSurveyIds.includes(survey.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSurveyIds((prev) => [...prev, survey.id])
                                } else {
                                  setSelectedSurveyIds((prev) => prev.filter((id) => id !== survey.id))
                                }
                              }}
                              className="mt-0.5 sm:mt-0"
                            />
                            <Label className="flex-1 cursor-pointer text-sm sm:text-base">
                              <div className="font-medium break-words">{survey.name}</div>
                              {survey.endDate && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(survey.endDate).toLocaleDateString("ja-JP")}
                                </div>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {selectedSurveyIds.length > 0 && (
                        <div className="border-t p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-sm h-9 sm:h-8 touch-manipulation"
                            onClick={() => setSelectedSurveyIds([])}
                          >
                            すべてクリア
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  {selectedSurveyIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 sm:gap-1 mt-2">
                      {selectedSurveyIds.map((id) => {
                        const survey = availableSurveys.find((s) => s.id === id)
                        return survey ? (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="text-xs cursor-pointer touch-manipulation px-2 py-1"
                            onClick={() => setSelectedSurveyIds((prev) => prev.filter((sid) => sid !== id))}
                          >
                            <span className="truncate max-w-[120px] sm:max-w-none">{survey.name}</span>
                            <X className="h-3 w-3 ml-1 flex-shrink-0" />
                          </Badge>
                        ) : null
                      })}
                    </div>
                  )}
                </div>

                {/* Department Multi-Select */}
                <div className="space-y-2">
                  <Label className="text-sm">部門（複数選択）</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between text-sm h-9 sm:h-10">
                        <span className="truncate flex-1 text-left">
                        {selectedDepartmentIds.length === 0
                          ? "部門を選択"
                          : `${selectedDepartmentIds.length}個選択中`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[var(--radix-popover-trigger-width)] p-0 !z-[110]"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                      style={{ 
                        width: 'var(--radix-popover-trigger-width)',
                        maxWidth: 'calc(100vw - 2rem)',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-y'
                      } as React.CSSProperties}
                    >
                      <div 
                        className="p-2 space-y-1 sm:space-y-2 max-h-[60vh] sm:max-h-60 overflow-y-auto overscroll-contain"
                        style={{ 
                          WebkitOverflowScrolling: 'touch',
                          overflowY: 'auto',
                          scrollBehavior: 'smooth',
                          touchAction: 'pan-y'
                        } as React.CSSProperties}
                        onWheel={(e) => {
                          // Ensure wheel scrolling works
                          e.currentTarget.scrollTop += e.deltaY
                        }}
                      >
                        {departmentsForAnalysis.map((dept) => (
                          <div
                            key={dept.id}
                            className="flex items-start space-x-2 p-2 sm:p-2.5 hover:bg-muted active:bg-muted rounded-sm cursor-pointer touch-manipulation min-h-[44px] sm:min-h-auto"
                            onClick={() => {
                              setSelectedDepartmentIds((prev) =>
                                prev.includes(dept.id)
                                  ? prev.filter((id) => id !== dept.id)
                                  : [...prev, dept.id]
                              )
                            }}
                          >
                            <Checkbox
                              checked={selectedDepartmentIds.includes(dept.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedDepartmentIds((prev) => [...prev, dept.id])
                                } else {
                                  setSelectedDepartmentIds((prev) => prev.filter((id) => id !== dept.id))
                                }
                              }}
                              className="mt-0.5 sm:mt-0"
                            />
                            <Label className="flex-1 cursor-pointer text-sm sm:text-base break-words">{dept.name}</Label>
                          </div>
                        ))}
                      </div>
                      {selectedDepartmentIds.length > 0 && (
                        <div className="border-t p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-sm h-9 sm:h-8 touch-manipulation"
                            onClick={() => setSelectedDepartmentIds([])}
                          >
                            すべてクリア
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  {selectedDepartmentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 sm:gap-1 mt-2">
                      {selectedDepartmentIds.map((id) => {
                        const dept = departmentsForAnalysis.find((d) => d.id === id)
                        return dept ? (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="text-xs cursor-pointer touch-manipulation px-2 py-1"
                            onClick={() => setSelectedDepartmentIds((prev) => prev.filter((did) => did !== id))}
                          >
                            <span className="truncate max-w-[120px] sm:max-w-none">{dept.name}</span>
                            <X className="h-3 w-3 ml-1 flex-shrink-0" />
                          </Badge>
                        ) : null
                      })}
                    </div>
                  )}
                </div>

                {/* Job Position Multi-Select */}
                <div className="space-y-2">
                  <Label className="text-sm">職位（複数選択）</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between text-sm h-9 sm:h-10">
                        <span className="truncate flex-1 text-left">
                          {selectedJobIds.length === 0
                            ? "職位を選択"
                            : `${selectedJobIds.length}個選択中`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[var(--radix-popover-trigger-width)] p-0 !z-[110]"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                      style={{ 
                        width: 'var(--radix-popover-trigger-width)',
                        maxWidth: 'calc(100vw - 2rem)',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-y'
                      } as React.CSSProperties}
                    >
                      <div 
                        className="p-2 space-y-1 sm:space-y-2 overflow-y-auto overscroll-contain"
                        style={{ 
                          WebkitOverflowScrolling: 'touch',
                          overflowY: 'auto',
                          scrollBehavior: 'smooth',
                          touchAction: 'pan-y',
                          maxHeight: 'calc(44px * 3 + 0.5rem * 2)',
                          minHeight: 'calc(44px * 3 + 0.5rem * 2)'
                        } as React.CSSProperties}
                        onWheel={(e) => {
                          // Ensure wheel scrolling works
                          e.currentTarget.scrollTop += e.deltaY
                        }}
                        onTouchStart={(e) => {
                          // Enable touch scrolling
                          const target = e.currentTarget
                          let startY = e.touches[0].clientY
                          let scrollTop = target.scrollTop
                          
                          const handleTouchMove = (moveEvent: TouchEvent) => {
                            const deltaY = moveEvent.touches[0].clientY - startY
                            target.scrollTop = scrollTop - deltaY
                          }
                          
                          const handleTouchEnd = () => {
                            document.removeEventListener('touchmove', handleTouchMove as any)
                            document.removeEventListener('touchend', handleTouchEnd)
                          }
                          
                          document.addEventListener('touchmove', handleTouchMove as any, { passive: false })
                          document.addEventListener('touchend', handleTouchEnd)
                        }}
                      >
                        {availableJobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex items-start space-x-2 p-2 sm:p-2.5 hover:bg-muted active:bg-muted rounded-sm cursor-pointer touch-manipulation min-h-[44px] sm:min-h-auto"
                            onClick={() => {
                              setSelectedJobIds((prev) =>
                                prev.includes(job.id)
                                  ? prev.filter((id) => id !== job.id)
                                  : [...prev, job.id]
                              )
                            }}
                          >
                            <Checkbox
                              checked={selectedJobIds.includes(job.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedJobIds((prev) => [...prev, job.id])
                                } else {
                                  setSelectedJobIds((prev) => prev.filter((id) => id !== job.id))
                                }
                              }}
                              className="mt-0.5 sm:mt-0"
                            />
                            <Label className="flex-1 cursor-pointer text-sm sm:text-base break-words">{job.name}</Label>
                          </div>
                        ))}
                      </div>
                      {selectedJobIds.length > 0 && (
                        <div className="border-t p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-sm h-9 sm:h-8 touch-manipulation"
                            onClick={() => setSelectedJobIds([])}
                          >
                            すべてクリア
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  {selectedJobIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 sm:gap-1 mt-2">
                      {selectedJobIds.map((id) => {
                        const job = availableJobs.find((j) => j.id === id)
                        return job ? (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="text-xs cursor-pointer touch-manipulation px-2 py-1"
                            onClick={() => setSelectedJobIds((prev) => prev.filter((jid) => jid !== id))}
                          >
                            <span className="truncate max-w-[120px] sm:max-w-none">{job.name}</span>
                            <X className="h-3 w-3 ml-1 flex-shrink-0" />
                          </Badge>
                        ) : null
                      })}
                    </div>
                  )}
                </div>

                {/* Category Single Select */}
                <div className="space-y-2">
                  <Label className="text-sm">カテゴリ（単一選択）</Label>
                  <Select
                    value={selectedCategoryId?.toString() || ""}
                    onValueChange={(value) => setSelectedCategoryId(value ? parseInt(value, 10) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="カテゴリを選択" />
                    </SelectTrigger>
                    <SelectContent className="!z-[110]">
                      {Array.from(new Map(
                        Object.entries(CATEGORY_ID_MAP)
                          .filter(([key]) => {
                            // Only include Japanese labels (exclude English)
                            const englishLabels = [
                              "Self-Evaluation Consciousness",
                              "Transformation Consciousness",
                              "Result View",
                              "Behavioral Precognition",
                              "Result Confirmation",
                              "Time Sensation",
                              "Recognition of Organizational Position",
                              "Freedom of Blame",
                            ]
                            return !englishLabels.includes(key)
                          })
                          .map(([categoryName, categoryId]) => [categoryId, categoryName] as [number, string])
                      ).entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([categoryId, categoryName]) => (
                          <SelectItem key={categoryId} value={categoryId.toString()}>
                            {categoryName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Search Section */}
            {detailedResponsesData && detailedResponsesData.employees.length > 0 && (
              <div className="space-y-2">
                <Label>検索</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="部署名、職位、名前で検索..."
                    value={detailedResponsesSearchQuery}
                    onChange={(e) => setDetailedResponsesSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            )}

            {/* Load Button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={async () => {
                  if (selectedSurveyIds.length === 0 || !selectedCategoryId) {
                    return
                  }
                  setDetailedResponsesLoading(true)
                  try {
                    const response = await api.organizationalSurveySummary.getDetailedResponses(
                      selectedSurveyIds.map((id) => id.toString()),
                      selectedDepartmentIds.map((id) => id.toString()),
                      selectedJobIds.map((id) => id.toString()),
                      selectedCategoryId.toString()
                    )
                    if (response?.success) {
                      setDetailedResponsesData({
                        employees: response.employees,
                        problems: response.problems,
                      })
                    } else {
                      setDetailedResponsesData(null)
                    }
                  } catch (error) {
                    console.error("Failed to load detailed responses:", error)
                    setDetailedResponsesData(null)
                  } finally {
                    setDetailedResponsesLoading(false)
                  }
                }}
                disabled={selectedSurveyIds.length === 0 || !selectedCategoryId || detailedResponsesLoading}
                className="min-w-32"
              >
                {detailedResponsesLoading ? "読み込み中..." : "詳細を詳細"}
              </Button>
            </div>

            {/* Results Table */}
            {detailedResponsesData && detailedResponsesData.employees.length > 0 && detailedResponsesData.problems.length > 0 && (() => {
              // Get category name
              const categoryName = Object.entries(CATEGORY_ID_MAP).find(
                ([_, id]) => id === selectedCategoryId
              )?.[0] || `カテゴリ ${selectedCategoryId}`
              
              // Get survey names (comma-separated if multiple)
              const surveyNames = selectedSurveyIds
                .map(id => availableSurveys.find(s => s.id === id)?.name || `サーベイ ${id}`)
                .join('、')
              
              // Get all problems (questions) - they should be the same across all surveys
              const problems = detailedResponsesData.problems
              
              // Filter and sort employees
              let filteredEmployees = [...detailedResponsesData.employees]
              
              // Apply search filter
              if (detailedResponsesSearchQuery.trim()) {
                const query = detailedResponsesSearchQuery.toLowerCase().trim()
                filteredEmployees = filteredEmployees.filter((employee) => {
                  return (
                    employee.departmentName?.toLowerCase().includes(query) ||
                    employee.jobName?.toLowerCase().includes(query) ||
                    employee.employeeName?.toLowerCase().includes(query)
                  )
                })
              }
              
              // Apply sorting based on sort config
              if (detailedResponsesSortConfig.key) {
                filteredEmployees.sort((a, b) => {
                  const firstSurveyA = a.surveys[0]
                  const firstSurveyB = b.surveys[0]
                  let aVal: any
                  let bVal: any
                  
                  switch (detailedResponsesSortConfig.key) {
                    case 'departmentName':
                      aVal = groupByDepartmentDetailedResponses 
                        ? (a.departmentCode || a.departmentName || '')
                        : (a.departmentName || '')
                      bVal = groupByDepartmentDetailedResponses
                        ? (b.departmentCode || b.departmentName || '')
                        : (b.departmentName || '')
                      break
                    case 'jobName':
                      aVal = a.jobName || ''
                      bVal = b.jobName || ''
                      break
                    case 'totalScore':
                      if (firstSurveyA && firstSurveyB) {
                        aVal = firstSurveyA.questions.reduce((sum, q) => sum + (q.score !== null ? q.score : 0), 0)
                        bVal = firstSurveyB.questions.reduce((sum, q) => sum + (q.score !== null ? q.score : 0), 0)
                      } else {
                        aVal = 0
                        bVal = 0
                      }
                      break
                    default:
                      return 0
                  }
                  
                  // Compare values
                  if (typeof aVal === 'string' && typeof bVal === 'string') {
                    const comparison = aVal.localeCompare(bVal, 'ja')
                    return detailedResponsesSortConfig.direction === 'asc' ? comparison : -comparison
                  } else {
                    const comparison = aVal - bVal
                    return detailedResponsesSortConfig.direction === 'asc' ? comparison : -comparison
                  }
                })
              } else {
                // Default sort: by department code (if group by department is enabled), then by name
                filteredEmployees.sort((a, b) => {
                  if (groupByDepartmentDetailedResponses) {
                    const aCode = a.departmentCode || a.departmentName || ''
                    const bCode = b.departmentCode || b.departmentName || ''
                    if (aCode !== bCode) {
                      return aCode.localeCompare(bCode, 'ja')
                    }
                  }
                  return a.employeeName.localeCompare(b.employeeName, 'ja')
                })
              }
              
              // Get score range for color mapping
              // Find min and max scores across all answers
              let minScore = Infinity
              let maxScore = -Infinity
              filteredEmployees.forEach((employee) => {
                const firstSurvey = employee.surveys[0]
                if (firstSurvey) {
                  firstSurvey.questions.forEach((q) => {
                    if (q.score !== null) {
                      minScore = Math.min(minScore, q.score)
                      maxScore = Math.max(maxScore, q.score)
                    }
                  })
                }
              })
              
              // Calculate total score range for color mapping
              let minTotalScore = Infinity
              let maxTotalScore = -Infinity
              filteredEmployees.forEach((employee) => {
                const firstSurvey = employee.surveys[0]
                if (firstSurvey) {
                  const totalScore = firstSurvey.questions.reduce((sum, q) => {
                    return sum + (q.score !== null ? q.score : 0)
                  }, 0)
                  minTotalScore = Math.min(minTotalScore, totalScore)
                  maxTotalScore = Math.max(maxTotalScore, totalScore)
                }
              })
              
              // Helper function to get color based on total score
              const getTotalScoreColor = (totalScore: number | null): string => {
                if (totalScore === null) return 'oklch(0.98 0.002 264)' // Default light background
                
                // Normalize score to 0-1 range
                const range = maxTotalScore - minTotalScore
                if (range === 0) return 'oklch(0.95 0.01 264)' // Neutral color if all scores are the same
                
                const normalized = (totalScore - minTotalScore) / range
                
                // Use green (positive) to red (negative) gradient
                // Higher scores = more green (positive), lower scores = more red (negative)
                // Using OKLCH for better color perception
                if (normalized >= 0.5) {
                  // Positive range: green hues (120-180)
                  const hue = 120 + (normalized - 0.5) * 2 * 60 // 120 to 180
                  const lightness = 0.92 + (normalized - 0.5) * 2 * 0.05 // 0.92 to 0.97
                  const chroma = 0.02 + (normalized - 0.5) * 2 * 0.03 // 0.02 to 0.05
                  return `oklch(${lightness} ${chroma} ${hue})`
                } else {
                  // Negative range: red hues (0-60)
                  const hue = 60 - normalized * 2 * 60 // 60 to 0
                  const lightness = 0.97 - normalized * 2 * 0.05 // 0.97 to 0.92
                  const chroma = 0.05 - normalized * 2 * 0.03 // 0.05 to 0.02
                  return `oklch(${lightness} ${chroma} ${hue})`
                }
              }
              
              // Helper function to get color based on score
              const getScoreColor = (score: number | null): string => {
                if (score === null) return 'oklch(0.98 0.002 264)' // Default light background
                
                // Normalize score to 0-1 range
                const range = maxScore - minScore
                if (range === 0) return 'oklch(0.95 0.01 264)' // Neutral color if all scores are the same
                
                const normalized = (score - minScore) / range
                
                // Use green (positive) to red (negative) gradient
                // Higher scores = more green (positive), lower scores = more red (negative)
                // Using OKLCH for better color perception
                if (normalized >= 0.5) {
                  // Positive range: green hues (120-180)
                  const hue = 120 + (normalized - 0.5) * 2 * 60 // 120 to 180
                  const lightness = 0.92 + (normalized - 0.5) * 2 * 0.05 // 0.92 to 0.97
                  const chroma = 0.02 + (normalized - 0.5) * 2 * 0.03 // 0.02 to 0.05
                  return `oklch(${lightness} ${chroma} ${hue})`
                } else {
                  // Negative range: red hues (0-60)
                  const hue = 60 - normalized * 2 * 60 // 60 to 0
                  const lightness = 0.97 - normalized * 2 * 0.05 // 0.97 to 0.92
                  const chroma = 0.05 - normalized * 2 * 0.03 // 0.05 to 0.02
                  return `oklch(${lightness} ${chroma} ${hue})`
                }
              }
              
              return (
                <div className="mt-6 border-t pt-6">
                  {/* Survey and Category Info */}
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">サーベイ:</span>
                      <span>{surveyNames}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">カテゴリ:</span>
                      <span>{categoryName}</span>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-4">回答結果</h3>
                  <div 
                    ref={detailedResponsesTableRef}
                    className="rounded-md border overflow-x-auto overflow-y-auto max-h-[60vh] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 relative"
                    tabIndex={0}
                    style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                  >
                    <Table className="relative">
                      <TableHeader className="sticky top-0 bg-background z-20 shadow-sm">
                        <TableRow>
                          <TableHead 
                            className="min-w-[120px] sm:sticky sm:left-0 bg-background sm:z-[5] border-r cursor-pointer hover:bg-muted/50"
                            onClick={() => handleDetailedResponsesSort('departmentName')}
                          >
                            部署名 <DetailedResponsesSortIcon columnKey="departmentName" />
                          </TableHead>
                          <TableHead 
                            className="min-w-[120px] sm:sticky sm:left-[120px] bg-background sm:z-[5] border-r cursor-pointer hover:bg-muted/50"
                            onClick={() => handleDetailedResponsesSort('jobName')}
                          >
                            職位 <DetailedResponsesSortIcon columnKey="jobName" />
                          </TableHead>
                          <TableHead className="min-w-[120px] sm:sticky sm:left-[240px] bg-background sm:z-[5] border-r">職員名</TableHead>
                          {problems.map((problem) => (
                            <TableHead 
                              key={problem.id} 
                              className="min-w-[100px] max-w-[100px] text-center overflow-hidden" 
                              title={problem.questionText}
                            >
                              <div className="truncate" title={problem.questionText}>
                              {problem.questionText}
                              </div>
                            </TableHead>
                          ))}
                          <TableHead 
                            className="min-w-[80px] text-center font-semibold bg-muted/30 cursor-pointer hover:bg-muted/50"
                            onClick={() => handleDetailedResponsesSort('totalScore')}
                          >
                            総点 <DetailedResponsesSortIcon columnKey="totalScore" />
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map((employee) => {
                          // For each employee, get answers from the first selected survey
                          // (since all selected surveys should have the same questions in the selected category)
                          const firstSurvey = employee.surveys[0]
                          if (!firstSurvey) return null
                          
                          // Create a map of questionId -> answer for quick lookup
                          const answerMap = new Map(
                            firstSurvey.questions.map(q => [q.questionId, q])
                          )
                          
                          // Calculate total score
                          const totalScore = firstSurvey.questions.reduce((sum, q) => {
                            return sum + (q.score !== null ? q.score : 0)
                          }, 0)
                          const totalScoreColor = getTotalScoreColor(totalScore)
                          
                          return (
                            <TableRow key={employee.employeeId}>
                              <TableCell className="font-medium sm:sticky sm:left-0 bg-background sm:z-[4] border-r">
                                {employee.departmentName || "部門未設定"}
                              </TableCell>
                              <TableCell className="font-medium sm:sticky sm:left-[120px] bg-background sm:z-[4] border-r">
                                {employee.jobName || "-"}
                              </TableCell>
                              <TableCell className="font-medium sm:sticky sm:left-[240px] bg-background sm:z-[4] border-r">
                                {employee.employeeName}
                              </TableCell>
                              {problems.map((problem) => {
                                const answer = answerMap.get(problem.id)
                                const scoreColor = getScoreColor(answer?.score ?? null)
                                return (
                                  <TableCell 
                                    key={problem.id} 
                                    className="text-center relative z-[1] cursor-help"
                                    style={{ backgroundColor: scoreColor }}
                                    title={problem.questionText}
                                  >
                                    {answer ? (
                                      answer.answerText !== null ? (
                                        <span className="text-sm whitespace-pre-wrap">{answer.answerText}</span>
                                      ) : answer.answerIndex !== null ? (
                                        <span className="text-sm">
                                            {getAnswerLabel(answer.answerIndex)}
                                          </span>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">未回答</span>
                                      )
                                    ) : (
                                      <span className="text-muted-foreground text-sm">未回答</span>
                                    )}
                                  </TableCell>
                                )
                              })}
                              <TableCell 
                                className="text-center font-semibold"
                                style={{ backgroundColor: totalScoreColor }}
                              >
                                {totalScore > 0 ? totalScore.toFixed(1) : '-'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            })()}

            {detailedResponsesData && detailedResponsesData.employees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                選択された条件に該当するデータがありません。
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
