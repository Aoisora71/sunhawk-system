"use client"

import { memo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { Employee } from "@/lib/organization-data"
import { getPositionColor } from "@/lib/position-colors"
import { getDepartmentColor } from "@/lib/department-colors"
import { cn } from "@/lib/utils"
import { FileText, Loader2 } from "lucide-react"
import api from "@/lib/api-client"
import { toast } from "@/lib/toast"

interface EmployeeCardProps {
  employee: Employee
  size?: "xs" | "sm" | "md" | "lg"
}

function EmployeeCardComponent({ employee, size = "md" }: EmployeeCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"organizational" | "growth">("organizational")
  const [orgResponses, setOrgResponses] = useState<Array<{
    surveyId: number
    surveyName: string
    questionId: number
    questionText: string
    answerText: string
  }>>([])
  const [growthResponses, setGrowthResponses] = useState<Array<{
    surveyId: number
    surveyName: string
    questionId: number
    questionText: string
    answerText: string
  }>>([])
  const [isLoadingOrg, setIsLoadingOrg] = useState(false)
  const [isLoadingGrowth, setIsLoadingGrowth] = useState(false)
  const [availableOrgSurveys, setAvailableOrgSurveys] = useState<Array<{ id: number; name: string; startDate: string | null; endDate: string | null }>>([])
  const [availableGrowthSurveys, setAvailableGrowthSurveys] = useState<Array<{ id: number; name: string; startDate: string | null; endDate: string | null }>>([])
  const [selectedOrgSurveyId, setSelectedOrgSurveyId] = useState<number | null>(null)
  const [selectedGrowthSurveyId, setSelectedGrowthSurveyId] = useState<number | null>(null)

  const positionColor = getPositionColor(employee.position)
  const departmentColor = getDepartmentColor(employee.department || "未設定")

  const fetchOrganizationalResponses = async (surveyId?: number) => {
    try {
      setIsLoadingOrg(true)
      // Convert employee.id to number (it might be string)
      const employeeIdNum = typeof employee.id === 'string' ? Number(employee.id) : employee.id
      if (isNaN(employeeIdNum) || employeeIdNum <= 0) {
        console.error("Invalid employee ID:", employee.id)
        toast.error("無効な従業員IDです")
        return
      }

      // Get all surveys first to populate available surveys list
      const surveysResponse = await api.surveys.list()
      if (surveysResponse?.success && surveysResponse.surveys) {
        const orgSurveys = surveysResponse.surveys
          .filter((s: any) => s.surveyType === "organizational")
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
        setAvailableOrgSurveys(orgSurveys)

        // If no survey selected, use the first one as default
        const targetSurveyId = surveyId || (orgSurveys.length > 0 ? orgSurveys[0].id : null)
        if (targetSurveyId) {
          setSelectedOrgSurveyId(targetSurveyId)
          try {
            const response = await api.organizationalSurveyResults.getFreeTextResponses(
              targetSurveyId.toString(),
              employeeIdNum.toString()
            )
            if (response?.success && response.responses) {
              setOrgResponses(response.responses)
            } else {
              setOrgResponses([])
            }
          } catch (error) {
            console.error(`Error fetching responses for survey ${targetSurveyId}:`, error)
            setOrgResponses([])
          }
        } else {
          setOrgResponses([])
        }
      }
    } catch (error) {
      console.error("Error fetching organizational responses:", error)
      toast.error("ソシキサーベイの回答取得に失敗しました")
      setOrgResponses([])
    } finally {
      setIsLoadingOrg(false)
    }
  }

  const fetchGrowthResponses = async (surveyId?: number) => {
    try {
      setIsLoadingGrowth(true)
      // Convert employee.id to number (it might be string)
      const employeeIdNum = typeof employee.id === 'string' ? Number(employee.id) : employee.id
      if (isNaN(employeeIdNum) || employeeIdNum <= 0) {
        console.error("Invalid employee ID:", employee.id)
        toast.error("無効な従業員IDです")
        return
      }

      // Get all surveys first to populate available surveys list
      const surveysResponse = await api.surveys.list()
      if (surveysResponse?.success && surveysResponse.surveys) {
        const growthSurveys = surveysResponse.surveys
          .filter((s: any) => s.surveyType === "growth")
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
        setAvailableGrowthSurveys(growthSurveys)

        // If no survey selected, use the first one as default
        const targetSurveyId = surveyId || (growthSurveys.length > 0 ? growthSurveys[0].id : null)
        if (targetSurveyId) {
          setSelectedGrowthSurveyId(targetSurveyId)
          try {
            const response = await api.growthSurveyResults.getFreeTextResponses(
              employeeIdNum.toString(),
              targetSurveyId.toString()
            )
            if (response?.success && response.responses) {
              setGrowthResponses(response.responses)
            } else {
              setGrowthResponses([])
            }
          } catch (error) {
            console.error(`Error fetching responses for survey ${targetSurveyId}:`, error)
            setGrowthResponses([])
          }
        } else {
          setGrowthResponses([])
        }
      }
    } catch (error) {
      console.error("Error fetching growth responses:", error)
      toast.error("グロースサーベイの回答取得に失敗しました")
      setGrowthResponses([])
    } finally {
      setIsLoadingGrowth(false)
    }
  }

  const handleOpenModal = () => {
    setIsModalOpen(true)
    if (activeTab === "organizational") {
      fetchOrganizationalResponses()
    } else {
      fetchGrowthResponses()
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as "organizational" | "growth")
    if (value === "organizational" && orgResponses.length === 0) {
      fetchOrganizationalResponses()
    } else if (value === "growth" && growthResponses.length === 0) {
      fetchGrowthResponses()
    }
  }

  const sizeClasses = {
    xs: "p-2 sm:p-2.5 md:p-3",
    sm: "p-2.5 sm:p-3 md:p-3.5",
    md: "p-3 sm:p-3.5 md:p-4",
    lg: "p-3.5 sm:p-4 md:p-5",
  }

  const nameClasses = {
    xs: "text-xs sm:text-sm font-semibold leading-tight",
    sm: "text-sm sm:text-base font-semibold leading-tight",
    md: "text-base sm:text-lg font-semibold leading-tight",
    lg: "text-lg sm:text-xl font-semibold leading-tight",
  }

  const metaClasses = {
    xs: "text-[11px] sm:text-xs leading-relaxed",
    sm: "text-xs sm:text-sm leading-relaxed",
    md: "text-sm sm:text-base leading-relaxed",
    lg: "text-base sm:text-lg leading-relaxed",
  }

  const badgeTextClasses = {
    xs: "text-[10px] sm:text-[11px] font-medium",
    sm: "text-[11px] sm:text-xs font-medium",
    md: "text-xs sm:text-sm font-medium",
    lg: "text-sm sm:text-base font-medium",
  }

  return (
    <Card className={cn("relative overflow-hidden border-2 shadow-sm hover:shadow-md transition-shadow", departmentColor.border)}>
      <div className="absolute inset-0 pointer-events-none">
        <div className={cn("absolute inset-0 opacity-40 bg-gradient-to-br", departmentColor.accent)} />
        <div className="absolute inset-0 bg-background/90 backdrop-blur-[1px]" />
      </div>
      <div className={cn("absolute inset-y-0 left-0 w-2 z-20", departmentColor.bg)} />
      <div
        className={cn(
          "absolute top-2 sm:top-2.5 right-2 sm:right-2.5 z-20 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 shadow-md",
          positionColor.bg,
          positionColor.text,
        )}
      >
        <span className={cn("font-semibold tracking-tight whitespace-nowrap", badgeTextClasses[size])}>
          {positionColor.label || employee.position || "-"}
        </span>
      </div>
      <CardContent className={cn(sizeClasses[size], "relative z-30 pl-4 sm:pl-5 md:pl-6")}>
        <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5">
          <div className={cn(nameClasses[size], "text-foreground break-words leading-tight")}>
            {employee.name || "-"}
          </div>
          <div className={cn(metaClasses[size], "text-muted-foreground break-words leading-relaxed")}>
            {employee.position || "-"}
          </div>
          <div className={cn(metaClasses[size], "font-medium break-words leading-relaxed", departmentColor.text)}>
            {employee.department || "-"}
          </div>
          {employee.scores && (employee.scores.currentScore !== null || employee.scores.pastScores.length > 0) && (
            <div className={cn("font-semibold flex flex-col gap-1 sm:gap-1.5 pt-1 sm:pt-1.5 border-t border-border/50")}>
              {/* 現在のサーベイのスコアのみがある場合は、現在のスコアのみを詳細 */}
              {employee.scores.currentScore !== null && employee.scores.pastScores.length === 0 && (
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  <span className={cn("font-bold text-green-600 dark:text-green-400", 
                    size === "xs" ? "text-sm sm:text-base" :
                    size === "sm" ? "text-base sm:text-lg" :
                    size === "md" ? "text-lg sm:text-xl" :
                    "text-xl sm:text-2xl"
                  )}>
                    {Math.round(employee.scores.currentScore.score)}
                  </span>
                  <span className={cn("text-muted-foreground", metaClasses[size])}>
                    ({employee.scores.currentScore.surveyName})
                  </span>
                </div>
              )}
              {/* 過去のサーベイのスコアがある場合は、過去のスコアを最初に、現在のスコアを最後に詳細 */}
              {employee.scores.pastScores.length > 0 && (
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  {/* 過去のサーベイスコアを最初に詳細 */}
                  {employee.scores.pastScores.map((item, idx) => (
                    <span key={idx} className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <span className={cn("font-semibold",
                        size === "xs" ? "text-xs sm:text-sm" :
                        size === "sm" ? "text-sm sm:text-base" :
                        "text-base sm:text-lg"
                      )}>
                        {Math.round(item.score)}
                      </span>
                      <span className={cn("text-yellow-600/70 dark:text-yellow-400/70", metaClasses[size])}>
                        ({item.surveyName})
                      </span>
                      {idx < employee.scores!.pastScores.length - 1 && (
                        <span className="text-yellow-600 dark:text-yellow-400 mx-0.5">/</span>
                      )}
                    </span>
                  ))}
                  {/* 現在のサーベイスコアを最後に詳細 */}
                  {employee.scores.currentScore !== null && (
                    <>
                      <span className="text-foreground/50 mx-0.5">/</span>
                      <span className={cn("font-bold text-green-600 dark:text-green-400",
                        size === "xs" ? "text-sm sm:text-base" :
                        size === "sm" ? "text-base sm:text-lg" :
                        size === "md" ? "text-lg sm:text-xl" :
                        "text-xl sm:text-2xl"
                      )}>
                        {Math.round(employee.scores.currentScore.score)}
                      </span>
                      <span className={cn("text-muted-foreground", metaClasses[size])}>
                        ({employee.scores.currentScore.surveyName})
                      </span>
                    </>
                  )}
                </div>
              )}
              {/* 現在のサーベイのスコアがなく、過去のサーベイのスコアのみがある場合 */}
              {employee.scores.currentScore === null && employee.scores.pastScores.length > 0 && (
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  {employee.scores.pastScores.map((item, idx) => (
                    <span key={idx} className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <span className={cn("font-semibold",
                        size === "xs" ? "text-xs sm:text-sm" :
                        size === "sm" ? "text-sm sm:text-base" :
                        "text-base sm:text-lg"
                      )}>
                        {Math.round(item.score)}
                      </span>
                      <span className={cn("text-yellow-600/70 dark:text-yellow-400/70", metaClasses[size])}>
                        ({item.surveyName})
                      </span>
                      {idx < employee.scores!.pastScores.length - 1 && (
                        <span className="text-yellow-600 dark:text-yellow-400 mx-0.5">/</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* 基礎資料詳細ボタン */}
          <div className="pt-2 sm:pt-2.5 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenModal}
              className={cn(
                "w-full text-xs sm:text-sm",
                size === "xs" && "h-6 text-[10px]",
                size === "sm" && "h-7 text-xs",
                size === "md" && "h-8",
                size === "lg" && "h-9"
              )}
            >
              <FileText className="mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
              基礎資料詳細
            </Button>
          </div>
        </div>
      </CardContent>

      {/* 基礎資料詳細モーダル */}
      <Dialog 
        open={isModalOpen} 
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) {
            // Reset when closing
            setSelectedOrgSurveyId(null)
            setSelectedGrowthSurveyId(null)
            setOrgResponses([])
            setGrowthResponses([])
            setAvailableOrgSurveys([])
            setAvailableGrowthSurveys([])
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{employee.name} - 基礎資料</DialogTitle>
            <DialogDescription>
              従業員のサーベイ自由入力回答を詳細します
            </DialogDescription>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="organizational">ソシキサーベイ</TabsTrigger>
              <TabsTrigger value="growth">グロースサーベイ</TabsTrigger>
            </TabsList>
            
            {/* ソシキサーベイタブ */}
            <TabsContent value="organizational" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm">組織サーベイ</Label>
                <Select
                  value={selectedOrgSurveyId?.toString() || ""}
                  onValueChange={async (value) => {
                    const surveyId = value ? parseInt(value, 10) : null
                    await fetchOrganizationalResponses(surveyId || undefined)
                  }}
                >
                  <SelectTrigger className="w-full text-sm h-9 sm:h-10">
                    <SelectValue placeholder="組織サーベイを選択" />
                  </SelectTrigger>
                  <SelectContent className="!z-[110]">
                    {availableOrgSurveys.map((survey) => (
                      <SelectItem key={survey.id} value={survey.id.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{survey.name}</span>
                          {survey.endDate && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(survey.endDate).toLocaleDateString("ja-JP")}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isLoadingOrg ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
                </div>
              ) : orgResponses.length > 0 ? (
                <div className="space-y-6">
                  {orgResponses.map((response, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle className="text-base sm:text-lg">
                          {response.questionText || `質問ID: ${response.questionId}`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-md">
                          {response.answerText || "回答なし"}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  ソシキサーベイの自由入力回答がありません
                </div>
              )}
            </TabsContent>

            {/*グロースサーベイタブ */}
            <TabsContent value="growth" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm">成長サーベイ</Label>
                <Select
                  value={selectedGrowthSurveyId?.toString() || ""}
                  onValueChange={async (value) => {
                    const surveyId = value ? parseInt(value, 10) : null
                    await fetchGrowthResponses(surveyId || undefined)
                  }}
                >
                  <SelectTrigger className="w-full text-sm h-9 sm:h-10">
                    <SelectValue placeholder="成長サーベイを選択" />
                  </SelectTrigger>
                  <SelectContent className="!z-[110]">
                    {availableGrowthSurveys.map((survey) => (
                      <SelectItem key={survey.id} value={survey.id.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{survey.name}</span>
                          {survey.endDate && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(survey.endDate).toLocaleDateString("ja-JP")}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isLoadingGrowth ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
                </div>
              ) : growthResponses.length > 0 ? (
                <div className="space-y-6">
                  {growthResponses.map((response, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle className="text-base sm:text-lg">
                          {response.questionText || `質問ID: ${response.questionId}`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-md">
                          {response.answerText || "回答なし"}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                 グロースサーベイの自由入力回答がありません
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// Memoize to prevent unnecessary re-renders
// Note: We don't use memo comparison function here because the component has internal state (modal, responses)
// The memo will still prevent re-renders when parent re-renders with same props
export const EmployeeCard = memo(EmployeeCardComponent)
