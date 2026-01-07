"use client"

import { useEffect, useMemo, useState, memo, useCallback } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OrgTreeNode } from "@/components/org-tree-node"
import type { Employee as OrgEmployee } from "@/lib/organization-data"
import { Users, Building2, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import api from "@/lib/api-client"
import type { Department, User, Job } from "@/lib/types"

export default function OrganizationPage() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeView, setActiveView] = useState<string>("by-department")
  const [employeeScores, setEmployeeScores] = useState<Map<number, { 
    currentScore: { score: number; surveyName: string } | null
    pastScores: Array<{ score: number; surveyName: string }>
  }>>(new Map())
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null)
  const [scoresLoading, setScoresLoading] = useState(false)
  const [currentOrgAverageScore, setCurrentOrgAverageScore] = useState<number | null>(null)
  const [previousOrgAverageScore, setPreviousOrgAverageScore] = useState<number | null>(null)
  const [orgAverageLoading, setOrgAverageLoading] = useState(false)

  const jobOrderMap = useMemo(() => {
    const map = new Map<string, { numeric: number; codeText: string; rawCode: string | null }>()
    jobs.forEach((job: any) => {
      const rawCode = job.code != null ? String(job.code).trim() : null
      const numericValue = Number(rawCode)
      map.set(String(job.id), {
        numeric: Number.isFinite(numericValue) ? numericValue : Number.MAX_SAFE_INTEGER,
        codeText: rawCode?.toLowerCase() || "",
        rawCode,
      })
    })
    return map
  }, [jobs])

  const getJobOrderMeta = (jobId?: string | number | null) => {
    if (jobId === undefined || jobId === null) {
      return {
        numeric: Number.MAX_SAFE_INTEGER,
        codeText: "",
        rawCode: null as string | null,
      }
    }
    return (
      jobOrderMap.get(String(jobId)) ?? {
        numeric: Number.MAX_SAFE_INTEGER,
        codeText: "",
        rawCode: null as string | null,
      }
    )
  }

  type OrgBranch = {
    id: string
    employee: OrgEmployee
    parentId: string | null
    priority: number
    children: OrgBranch[]
    isDepartment?: boolean
  }

  // Authorization is handled server-side via layout.tsx
  // No need for client-side checks (security improvement)
  useEffect(() => {
    setIsAuthorized(true) // Layout already verified admin access
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        // Cookies are automatically sent, no need for manual headers
        const [deptRes, empRes, jobRes, periodRes] = await Promise.all([
          fetch("/api/departments", { headers: {} }),
          fetch("/api/employees", { headers: {} }),
          fetch("/api/jobs", { headers: {} }),
          api.surveyPeriodApi.checkAvailability("organizational"),
        ])
        const deptData = await deptRes.json().catch(() => ({ success: false, departments: [] }))
        const empData = await empRes.json().catch(() => ({ success: false, employees: [] }))
        const jobData = await jobRes.json().catch(() => ({ success: false, jobs: [] }))
        if (deptData?.success) setDepartments(deptData.departments || [])
        if (empData?.success) setEmployees(empData.employees || [])
        if (jobData?.success) setJobs(jobData.jobs || [])
        
        // Get active survey ID
        if (periodRes?.success && periodRes.available && periodRes.survey?.id) {
          setActiveSurveyId(periodRes.survey.id)
        }
      } catch (error) {
              }
    }
    load()
  }, [])

  // Load employee scores (non-blocking - loads after basic data is displayed)
  useEffect(() => {
    const loadScores = async () => {
      if (!employees.length) {
                return
      }

      try {
        setScoresLoading(true)
        // Cookies are automatically sent, no need for manual headers
        
                
        // Get all summaries (no surveyId filter to get all surveys)
        // Use forOrganization=true to get all employees' scores for organization chart display
        const summaryRes = await fetch("/api/organizational-survey-summary?forOrganization=true", { headers: {} })
        
        if (!summaryRes.ok) {
          return
        }
        
        const summaryData = await summaryRes.json().catch((err) => {
          return { success: false, summaries: [] }
        }) || { success: false, summaries: [] }
        
        if (!summaryData?.success || !Array.isArray(summaryData.summaries)) {
          return
        }

        const scoresMap = new Map<number, { 
          currentScore: { score: number; surveyName: string } | null
          pastScores: Array<{ score: number; surveyName: string }>
        }>()
        
        // Get current date for comparison
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Set to midnight for date comparison

        // Group summaries by user_id with survey date and name information
        const summariesByUser = new Map<number, Array<{ 
          surveyId: number
          totalScore: number
          startDate: string | null
          endDate: string | null
          surveyName: string | null
        }>>()
        summaryData.summaries.forEach((summary: any) => {
          const userId = summary.userId
          if (!summariesByUser.has(userId)) {
            summariesByUser.set(userId, [])
          }
          summariesByUser.get(userId)!.push({
            surveyId: summary.surveyId,
            totalScore: summary.totalScore,
            startDate: summary.startDate || null,
            endDate: summary.endDate || null,
            surveyName: summary.surveyName || null,
          })
        })

        
        // Separate current and past scores for each user based on end_date (latest survey is current)
        summariesByUser.forEach((summaries, userId) => {
          // Sort all summaries by end_date descending (newest first)
          const sortedSummaries = [...summaries].sort((a, b) => {
            // Sort by end_date descending (newest first), fallback to surveyId if dates are missing
            if (a.endDate && b.endDate) {
              const aEnd = new Date(a.endDate).getTime()
              const bEnd = new Date(b.endDate).getTime()
              return bEnd - aEnd
            }
            // If one has endDate and the other doesn't, prioritize the one with endDate
            if (a.endDate && !b.endDate) return -1
            if (!a.endDate && b.endDate) return 1
            // If both don't have endDate, sort by surveyId descending
            const aId = typeof a.surveyId === 'string' ? Number(a.surveyId) : a.surveyId
            const bId = typeof b.surveyId === 'string' ? Number(b.surveyId) : b.surveyId
            return bId - aId
          })

          // The latest survey (first in sorted list) is the current survey
          const currentSummary = sortedSummaries.length > 0 ? sortedSummaries[0] : null
          
          // All other surveys are past surveys
          // Reverse past summaries to show oldest first (ascending order by end_date)
          const pastSummaries = sortedSummaries.length > 1 ? sortedSummaries.slice(1).reverse() : []

          if (currentSummary) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`Current survey score for user ${userId}: surveyId=${currentSummary.surveyId}, score=${currentSummary.totalScore}, endDate=${currentSummary.endDate}`)
            }
          }

          if (pastSummaries.length > 0) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`Past summaries for user ${userId}:`, pastSummaries.length)
            }
          }

          scoresMap.set(userId, {
            currentScore: currentSummary ? {
              score: currentSummary.totalScore,
              surveyName: currentSummary.surveyName || `サーベイ ${currentSummary.surveyId}`,
            } : null,
            pastScores: pastSummaries.map((s) => ({
              score: s.totalScore,
              surveyName: s.surveyName || `サーベイ ${s.surveyId}`,
            })),
          })
        })

        setEmployeeScores(scoresMap)
      } catch (error) {
        console.error("Error loading employee scores:", error)
      } finally {
        setScoresLoading(false)
      }
    }

    // Load scores after a short delay to allow page to render first
    const timeoutId = setTimeout(() => {
      loadScores()
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [employees, activeSurveyId])

  // Load organizational average scores (current and previous surveys)
  useEffect(() => {
    const loadOrganizationalAverageScores = async () => {
      try {
        setOrgAverageLoading(true)

        // Get all organizational survey summaries
        const summaryRes = await api.organizationalSurveySummary.list(undefined, true)
        if (!summaryRes?.success || !Array.isArray(summaryRes.summaries) || summaryRes.summaries.length === 0) {
          setCurrentOrgAverageScore(null)
          setPreviousOrgAverageScore(null)
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
          const currentEnd = bySurvey.get(sid)!.endDate
          const newEnd = row.endDate || row.end_date || null
          if (newEnd && (!currentEnd || new Date(newEnd) > new Date(currentEnd))) {
            bySurvey.get(sid)!.endDate = newEnd
          }
        })

        if (bySurvey.size === 0) {
          setCurrentOrgAverageScore(null)
          setPreviousOrgAverageScore(null)
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

        // Calculate average for current survey
        if (currentSurvey && currentSurvey[1].summaries.length > 0) {
          const validSummaries = currentSurvey[1].summaries.filter(
            (s: any) => s && typeof s.totalScore === "number" && !Number.isNaN(s.totalScore)
          )
          if (validSummaries.length > 0) {
            const total = validSummaries.reduce((acc: number, s: any) => acc + (s.totalScore ?? 0), 0)
            const avg = total / validSummaries.length
            setCurrentOrgAverageScore(Number.isFinite(avg) ? Number(avg.toFixed(1)) : null)
          } else {
            setCurrentOrgAverageScore(null)
          }
        } else {
          setCurrentOrgAverageScore(null)
        }

        // Calculate average for previous survey
        if (previousSurvey && previousSurvey[1].summaries.length > 0) {
          const validSummaries = previousSurvey[1].summaries.filter(
            (s: any) => s && typeof s.totalScore === "number" && !Number.isNaN(s.totalScore)
          )
          if (validSummaries.length > 0) {
            const total = validSummaries.reduce((acc: number, s: any) => acc + (s.totalScore ?? 0), 0)
            const avg = total / validSummaries.length
            setPreviousOrgAverageScore(Number.isFinite(avg) ? Number(avg.toFixed(1)) : null)
          } else {
            setPreviousOrgAverageScore(null)
          }
        } else {
          setPreviousOrgAverageScore(null)
        }
      } catch (error) {
                setCurrentOrgAverageScore(null)
        setPreviousOrgAverageScore(null)
      } finally {
        setOrgAverageLoading(false)
      }
    }

    loadOrganizationalAverageScores()
  }, [])

  const departmentTree = useMemo<OrgBranch[]>(() => {
    if (!departments.length) return []

    type MemberEntry = {
      id: string
      employee: OrgEmployee
      priority: number
      roleWeight: number
    }

    const membersByDept = new Map<string, MemberEntry[]>()
    employees.forEach((emp: any) => {
      const deptKey = String(emp.departmentId ?? "")
      const priority = getJobOrderMeta(emp.jobId).numeric
      const roleWeight = emp.role === "admin" ? 0 : emp.role === "manager" ? 1 : 2
      if (!membersByDept.has(deptKey)) {
        membersByDept.set(deptKey, [])
      }
      // Ensure emp.id is treated as number for lookup
      const empIdNum = typeof emp.id === 'string' ? Number(emp.id) : emp.id
      const scores = employeeScores.get(empIdNum) || { currentScore: null, pastScores: [] }
      membersByDept.get(deptKey)!.push({
        id: String(emp.id),
        priority,
        roleWeight,
        employee: {
          id: String(emp.id),
          name: emp.name || emp.email || "-",
          position: emp.jobName || "-",
          department: emp.departmentName || "-",
          type: emp.role === "admin" ? "executive" : emp.role === "manager" ? "manager" : "employee",
          scores: scores,
        },
      })
    })

    const parsePriority = (value: any) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER
    }

    const pickManager = (entries: MemberEntry[], deptName: string) => {
      if (!entries.length) {
        return {
          manager: {
            id: `${deptName}-mgr`,
            name: deptName,
            position: "未設定",
            department: deptName,
            type: "manager" as OrgEmployee["type"],
          },
          managerId: null,
        }
      }
      const sorted = [...entries].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        if (a.roleWeight !== b.roleWeight) return a.roleWeight - b.roleWeight
        return (a.employee.name || "").localeCompare(b.employee.name || "")
      })
      return { manager: sorted[0].employee, managerId: sorted[0].id }
    }

    const nodes: OrgBranch[] = departments.map((dept) => {
      const deptId = String(dept.id)
      const memberEntries = membersByDept.get(deptId) || []
      const { manager, managerId } = pickManager(memberEntries, dept.name)
      const branch: OrgBranch = {
        id: deptId,
        parentId: dept.parentId ? String(dept.parentId) : null,
        priority: parsePriority(dept.code),
        employee: manager,
        children: [],
        isDepartment: true,
      }

      const employeeChildren = memberEntries
        .filter((entry) => !managerId || entry.id !== managerId)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority
          return (a.employee.name || "").localeCompare(b.employee.name || "")
        })
        .map((entry) => ({
          id: `emp-${entry.id}`,
          parentId: deptId,
          priority: entry.priority,
          employee: entry.employee,
          children: [],
          isDepartment: false,
        }))

      branch.children.push(...employeeChildren)
      return branch
    })

    const nodeMap = new Map<string, OrgBranch>(nodes.map((n) => [n.id, n]))
    nodes.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node)
      }
    })

    const sortNodes = (list: OrgBranch[]) => {
      list.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        if ((a.isDepartment ? 0 : 1) !== (b.isDepartment ? 0 : 1)) {
          return (a.isDepartment ? 0 : 1) - (b.isDepartment ? 0 : 1)
        }
        return (a.employee.name || "").localeCompare(b.employee.name || "")
      })
      list.forEach((child) => sortNodes(child.children))
    }

    const roots = nodes.filter((node) => !node.parentId || !nodeMap.has(node.parentId))
    sortNodes(roots)
    return roots
  }, [departments, employees, jobOrderMap, employeeScores])

  const renderBranch = (branch: OrgBranch, level: number, isLast: boolean) => (
    <OrgTreeNode
      key={branch.id}
      employee={branch.employee}
      level={level}
      isLast={isLast}
      hasChildren={branch.children.length > 0}
    >
      {branch.children.length > 0 && (
        <div className="mt-2 sm:mt-3 md:mt-6 space-y-2 sm:space-y-3 md:space-y-4">
          {branch.children.map((child, idx) => renderBranch(child, level + 1, idx === branch.children.length - 1))}
        </div>
      )}
    </OrgTreeNode>
  )

  // Group by position (jobName) across organization
  const positions = useMemo(() => {
    const map = new Map<
      string,
      {
        members: OrgEmployee[]
        priority: number
        codeText: string
        codeLabel: string | null
      }
    >()

    for (const e of employees) {
      const key = e.jobName || "未設定"
      const { numeric, codeText, rawCode } = getJobOrderMeta(e.jobId)

      if (!map.has(key)) {
        map.set(key, {
          members: [],
          priority: numeric,
          codeText,
          codeLabel: rawCode,
        })
      } else {
        const group = map.get(key)!
        group.priority = Math.min(group.priority, numeric)
        if (!group.codeText && codeText) group.codeText = codeText
        if (!group.codeLabel && rawCode) group.codeLabel = rawCode
      }

      // Ensure e.id is treated as number for lookup
      const empIdNum = typeof e.id === 'string' ? Number(e.id) : e.id
      const scores = employeeScores.get(empIdNum) || { currentScore: null, pastScores: [] }
      map.get(key)!.members.push({
        id: String(e.id),
        name: e.name || e.email || "-",
        position: e.jobName || "-",
        department: e.departmentName || "-",
        type: e.role === "admin" ? "executive" : "employee",
        score: 0,
        scores: scores,
      })
    }

    return Array.from(map.entries())
      .sort((a, b) => {
        const priorityDiff = a[1].priority - b[1].priority
        if (priorityDiff !== 0) return priorityDiff
        const codeCompare = (a[1].codeText || "").localeCompare(b[1].codeText || "")
        if (codeCompare !== 0) return codeCompare
        return a[0].localeCompare(b[0])
      })
      .map(([pos, data]) => ({
        position: pos,
        code: data.codeLabel,
        members: data.members.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      }))
  }, [employees, jobOrderMap, employeeScores])

  const totalEmployees = employees.length

  // Count departments with code >= 3
  // Use the same logic as dashboard and reports pages
  const departmentCount = useMemo(() => {
    if (!departments || departments.length === 0) {
            return 0
    }
    
    let count = 0
    const departmentDetails: Array<{ id: number; name: string; code: string | null; codeNum: number | null }> = []
    
    departments.forEach((d: any) => {
      const rawCode = d.code != null ? String(d.code).trim() : null
      const numeric = rawCode !== null && rawCode !== "" ? Number(rawCode) : NaN
      const codeNum = Number.isFinite(numeric) ? numeric : null
      
      departmentDetails.push({
        id: d.id,
        name: d.name,
        code: rawCode,
        codeNum: codeNum,
      })
      
      // Only count departments with code >= 3
      if (codeNum !== null && codeNum >= 3) {
        count++
      }
    })
    
        
    return count
  }, [departments])

  const ceo: OrgEmployee = useMemo(() => {
    // Pick an admin user as CEO fallback; otherwise a placeholder
    const admin = employees.find((e) => e.role === "admin")
    // Ensure admin.id is treated as number for lookup
    const adminIdNum = admin ? (typeof admin.id === 'string' ? Number(admin.id) : admin.id) : null
    const scores = adminIdNum ? (employeeScores.get(adminIdNum) || { currentScore: null, pastScores: [] }) : { currentScore: null, pastScores: [] }
    return {
      id: admin?.id ? String(admin.id) : "ceo",
      name: admin?.name || "管理者",
      position: admin?.jobName || "管理者",
      department: admin?.departmentName || "経営",
      type: "executive",
      score: 0,
      scores: scores,
    }
  }, [employees, employeeScores])

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
        <main className="flex-1 p-2 sm:p-3 md:p-8 w-full overflow-x-auto">
          <div className="max-w-full mx-auto space-y-3 sm:space-y-4 md:space-y-6">
            <div>
              <h1 className="text-lg sm:text-xl md:text-3xl font-medium text-foreground mb-0.5 sm:mb-1">組織図</h1>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">部署・職位で組織メンバーを分類</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-1.5 sm:pb-2">
                  <CardDescription className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                    総従業員数
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-base sm:text-lg md:text-2xl font-medium text-foreground">{totalEmployees}名</span>
                </CardContent>
              </Card>

              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-1.5 sm:pb-2">
                  <CardDescription className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                    <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    部門数
                  </CardDescription>
                </CardHeader>
                <CardContent>
                    <span className="text-base sm:text-lg md:text-2xl font-medium text-foreground">{departmentCount}部門</span>
                </CardContent>
              </Card>

              <Card className="hover:shadow-sm transition-shadow sm:col-span-2 lg:col-span-1">
                <CardHeader className="pb-1.5 sm:pb-2">
                  <CardDescription className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                    組織平均スコア
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {orgAverageLoading ? (
                    <div className="text-xs sm:text-sm text-muted-foreground">読み込み中...</div>
                  ) : currentOrgAverageScore === null && previousOrgAverageScore === null ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-base sm:text-lg md:text-2xl font-medium text-foreground">-</span>
                      <Badge className="bg-[oklch(0.55_0.15_160)] text-white text-xs">N/A</Badge>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentOrgAverageScore !== null && (
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-xs sm:text-sm text-muted-foreground">現在:</span>
                          <span className="text-base sm:text-lg md:text-2xl font-medium text-foreground">
                            {currentOrgAverageScore}
                          </span>
                        </div>
                      )}
                      {previousOrgAverageScore !== null && (
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-xs sm:text-sm text-muted-foreground">前回:</span>
                          <span className="text-base sm:text-lg md:text-xl font-medium text-foreground">
                            {previousOrgAverageScore}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeView} onValueChange={setActiveView} className="space-y-3 sm:space-y-4">
              <TabsList className="grid w-full grid-cols-2 text-xs sm:text-sm">
                <TabsTrigger
                  value="by-department"
                  className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5 text-center sm:text-left"
                >
                  部門別
                </TabsTrigger>
                <TabsTrigger
                  value="by-position"
                  className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5 text-center sm:text-left"
                >
                  職位別
                </TabsTrigger>
              </TabsList>

              {/* By Department (tree) */}
              <TabsContent value="by-department" className="space-y-3">
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2 sm:pb-3 border-b">
                    <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base md:text-lg">
                      <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                      組織構成図（部門）
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-3 md:p-6 overflow-x-auto">
                    <div className="min-w-max md:min-w-full pb-2 sm:pb-3 md:pb-4">
                      <OrgTreeNode employee={ceo} level={0} hasChildren={departmentTree.length > 0}>
                        <div className="mt-2 sm:mt-3 md:mt-6 space-y-2 sm:space-y-3 md:space-y-6">
                          {departmentTree.map((branch, index) =>
                            renderBranch(branch, 1, index === departmentTree.length - 1),
                          )}
                        </div>
                      </OrgTreeNode>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* By Position (flat grouped) */}
              <TabsContent value="by-position" className="space-y-3">
                {positions.map((group) => (
                  <Card key={group.position}>
                    <CardHeader className="pb-2 sm:pb-3 border-b">
                      <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2 flex-wrap">
                        {group.position}
                        {group.code && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs font-normal">
                            コード: {group.code}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
                        {group.members.map((m) => (
                          <div key={m.id} className="border-2 rounded-lg p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow bg-card">
                            <div className="text-base sm:text-lg font-semibold text-foreground break-words mb-1.5">{m.name}</div>
                            <div className="text-sm sm:text-base text-muted-foreground break-words mb-1">{m.department}</div>
                            {m.scores && (m.scores.currentScore !== null || m.scores.pastScores.length > 0) && (
                              <div className="font-semibold flex flex-col gap-1.5 sm:gap-2 mt-2 pt-2 border-t border-border/50">
                                {/* 現在のサーベイのスコアのみがある場合は、現在のスコアのみを詳細 */}
                                {m.scores.currentScore !== null && m.scores.pastScores.length === 0 && (
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                                      {Math.round(m.scores.currentScore.score)}
                                    </span>
                                    <span className="text-xs sm:text-sm text-muted-foreground">({m.scores.currentScore.surveyName})</span>
                                  </div>
                                )}
                                {/* 過去のサーベイのスコアがある場合は、過去のスコアを最初に、現在のスコアを最後に詳細 */}
                                {m.scores.pastScores.length > 0 && (
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    {/* 過去のサーベイスコアを最初に詳細 */}
                                    {m.scores.pastScores.map((item, idx) => (
                                      <span key={idx} className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                        <span className="text-sm sm:text-base font-semibold">{Math.round(item.score)}</span>
                                        <span className="text-xs sm:text-sm text-yellow-600/70 dark:text-yellow-400/70">
                                          ({item.surveyName})
                                        </span>
                                        {idx < m.scores!.pastScores.length - 1 && (
                                          <span className="text-yellow-600 dark:text-yellow-400 mx-0.5">/</span>
                                        )}
                                      </span>
                                    ))}
                                    {/* 現在のサーベイスコアを最後に詳細 */}
                                    {m.scores.currentScore !== null && (
                                      <>
                                        <span className="text-foreground/50 mx-0.5">/</span>
                                        <span className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                                          {Math.round(m.scores.currentScore.score)}
                                        </span>
                                        <span className="text-xs sm:text-sm text-muted-foreground">
                                          ({m.scores.currentScore.surveyName})
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                                {/* 現在のサーベイのスコアがなく、過去のサーベイのスコアのみがある場合 */}
                                {m.scores.currentScore === null && m.scores.pastScores.length > 0 && (
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    {m.scores.pastScores.map((item, idx) => (
                                      <span key={idx} className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                        <span className="text-sm sm:text-base font-semibold">{Math.round(item.score)}</span>
                                        <span className="text-xs sm:text-sm text-yellow-600/70 dark:text-yellow-400/70">({item.surveyName})</span>
                                        {idx < m.scores!.pastScores.length - 1 && (
                                          <span className="text-yellow-600 dark:text-yellow-400 mx-0.5">/</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}

