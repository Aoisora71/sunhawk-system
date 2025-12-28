"use client"

import { useState, useEffect, useRef, type ChangeEvent } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Plus, Edit, Trash2, Building2, Briefcase, Users, Key, Download, Upload } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"

export function OrganizationSection() {
  // Departments
  const [departments, setDepartments] = useState<any[]>([])
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<any>(null)
  const [newDept, setNewDept] = useState({ name: "", code: "", description: "", parentId: null as string | null })

  // Jobs
  const [jobs, setJobs] = useState<any[]>([])
  const [isAddJobOpen, setIsAddJobOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<any>(null)
  const [newJob, setNewJob] = useState({ name: "", code: "", description: "" })

  // Employees
  const [employees, setEmployees] = useState<any[]>([])
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const xlsxInputRef = useRef<HTMLInputElement | null>(null)
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    password: "",
    dateOfBirth: "",
    departmentId: "",
    jobId: "",
    role: "none",
    yearsOfService: "",
    address: "",
  })

  useEffect(() => {
    fetchDepartments()
    fetchJobs()
    fetchEmployees()
  }, [])

  // Departments API
  const fetchDepartments = async () => {
    try {
      // Cookies are automatically sent with requests (no need for localStorage or manual headers)
      const response = await fetch("/api/departments", {
        headers: { 
          "Content-Type": "application/json",
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
                toast.error(errorData.error || "部門データの取得に失敗しました")
        return
      }

      const data = await response.json()
      if (data.success) {
        setDepartments(data.departments || [])
      } else {
                toast.error("部門データの取得に失敗しました")
      }
    } catch (error) {
            toast.error("部門データの取得中にエラーが発生しました")
    }
  }

  const handleCreateDepartment = async () => {
    if (!newDept.name) {
      toast.error("部門名は必須です")
      return
    }

    try {
      // Cookies are automatically sent with requests
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newDept),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "部門の作成に失敗しました")
        return
      }

      await fetchDepartments()
      setNewDept({ name: "", code: "", description: "", parentId: null })
      setIsAddDeptOpen(false)
      toast.success("部門を登録しました")
    } catch (error) {
            toast.error("部門の作成に失敗しました")
    }
  }

  const handleUpdateDepartment = async () => {
    if (!editingDept.name) {
      toast.error("部門名は必須です")
      return
    }

    try {
      // Cookies are automatically sent with requests
      // Ensure parentId is properly formatted: empty string or null becomes null, otherwise keep as string for API to parse
      const updateData = {
        ...editingDept,
        parentId: (editingDept.parentId === null || editingDept.parentId === undefined)
          ? null 
          : (typeof editingDept.parentId === 'number' ? editingDept.parentId : (typeof editingDept.parentId === 'string' ? Number(editingDept.parentId) : null))
      }

      const response = await fetch(`/api/departments/${editingDept.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "部門の更新に失敗しました")
        return
      }

      await fetchDepartments()
      setEditingDept(null)
      toast.success("部門情報を更新しました")
    } catch (error) {
            toast.error("部門の更新に失敗しました")
    }
  }

  const handleDeleteDepartment = async (deptId: string) => {
    toast.info("部門を削除しています…")
    try {
      // Cookies are automatically sent with requests
      const response = await fetch(`/api/departments/${deptId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "部門の削除に失敗しました")
        return
      }

      await fetchDepartments()
      toast.success("部門を削除しました")
    } catch (error) {
            toast.error("部門の削除に失敗しました")
    }
  }

  // Jobs API
  const fetchJobs = async () => {
    try {
      // Cookies are automatically sent with requests
      const response = await fetch("/api/jobs", {
        headers: { 
          "Content-Type": "application/json",
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
                toast.error(errorData.error || "職位データの取得に失敗しました")
        return
      }

      const data = await response.json()
      if (data.success) {
        setJobs(data.jobs || [])
      } else {
                toast.error("職位データの取得に失敗しました")
      }
    } catch (error) {
            toast.error("職位データの取得中にエラーが発生しました")
    }
  }


  const handleCreateJob = async () => {
    if (!newJob.name) {
      toast.error("職位名は必須です")
      return
    }

    try {
      // Cookies are automatically sent with requests
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newJob),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "職位の作成に失敗しました")
        return
      }

      await fetchJobs()
      setNewJob({ name: "", code: "", description: "" })
      setIsAddJobOpen(false)
      toast.success("職位を登録しました")
    } catch (error) {
            toast.error("職位の作成に失敗しました")
    }
  }

  const handleUpdateJob = async () => {
    if (!editingJob.name) {
      toast.error("職位名は必須です")
      return
    }

    try {
      // Cookies are automatically sent with requests
      const response = await fetch(`/api/jobs/${editingJob.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingJob),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "職位の更新に失敗しました")
        return
      }

      await fetchJobs()
      setEditingJob(null)
      toast.success("職位情報を更新しました")
    } catch (error) {
            toast.error("職位の更新に失敗しました")
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    toast.info("職位を削除しています…")
    try {
      // Cookies are automatically sent with requests
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "職位の削除に失敗しました")
        return
      }

      await fetchJobs()
      toast.success("職位を削除しました")
    } catch (error) {
            toast.error("職位の削除に失敗しました")
    }
  }

  // Employees API
  const fetchEmployees = async () => {
    try {
      // Cookies are automatically sent with requests
      const response = await fetch("/api/employees")
      if (!response.ok) {
        let errorData: any = {}
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : { error: `HTTP ${response.status}` }
        } catch (parseError) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
        }
                toast.error(errorData.error || `従業員データの取得に失敗しました (${response.status})`)
        return
      }
      
      const data = await response.json()
      if (data.success) {
        setEmployees(data.employees || [])
      } else {
                toast.error(data.error || "従業員データの取得に失敗しました")
      }
    } catch (error) {
            toast.error("従業員データの取得中にエラーが発生しました")
    }
  }

  const handleCreateEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.password) {
      toast.error("必須項目を入力してください")
      return
    }

    try {
      // Cookies are automatically sent with requests
      // Coerce relational IDs to integers or null
      const payload = {
        ...newEmployee,
        departmentId: newEmployee.departmentId ? Number(newEmployee.departmentId) : null,
        jobId: newEmployee.jobId ? Number(newEmployee.jobId) : null,
        yearsOfService: newEmployee.yearsOfService || null,
      }

      const response = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "従業員の登録に失敗しました")
        return
      }

      await fetchEmployees()
      setNewEmployee({
        name: "",
        email: "",
        password: "",
        dateOfBirth: "",
        departmentId: "",
        jobId: "",
        role: "none",
        yearsOfService: "",
        address: "",
      })
      setIsAddEmployeeOpen(false)
      toast.success("従業員を登録しました")
    } catch (error) {
            toast.error("従業員の登録に失敗しました")
    }
  }

  const handleUpdateEmployee = async () => {
    if (!editingEmployee.name) {
      toast.error("氏名は必須です")
      return
    }

    try {
      // Cookies are automatically sent with requests
      // Prepare update data - only send fields that are defined
      const updateData: Record<string, unknown> = {}
      if (editingEmployee.name !== undefined) updateData.name = editingEmployee.name
      if (editingEmployee.email !== undefined) updateData.email = editingEmployee.email
      if (editingEmployee.dateOfBirth !== undefined) updateData.dateOfBirth = editingEmployee.dateOfBirth || null
      if (editingEmployee.departmentId !== undefined) {
        updateData.departmentId = editingEmployee.departmentId 
          ? (typeof editingEmployee.departmentId === 'string' ? Number(editingEmployee.departmentId) : editingEmployee.departmentId)
          : null
      }
      if (editingEmployee.jobId !== undefined) {
        updateData.jobId = editingEmployee.jobId 
          ? (typeof editingEmployee.jobId === 'string' ? Number(editingEmployee.jobId) : editingEmployee.jobId)
          : null
      }
      if (editingEmployee.role !== undefined) {
        const role = editingEmployee.role
        if (role === 'admin' || role === 'employee' || role === 'none') {
          updateData.role = role
        }
      }
      if (editingEmployee.yearsOfService !== undefined) updateData.yearsOfService = editingEmployee.yearsOfService || null
      if (editingEmployee.address !== undefined) updateData.address = editingEmployee.address || null

      const response = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
                toast.error(data.error || data.message || "従業員情報の更新に失敗しました")
        return
      }

      await fetchEmployees()
      setEditingEmployee(null)
      toast.success("従業員情報を更新しました")
    } catch (error) {
            toast.error("従業員情報の更新に失敗しました")
    }
  }

  const handleApprovePasswordReset = async (employeeId: string) => {
    toast.info("パスワードリセット要求を承認しています…")
    try {
      // Cookies are automatically sent with requests
      const response = await fetch(`/api/employees/${employeeId}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approve: true }),
      })

      const data = await response.json()

      if (!response.ok) {
                toast.error(data.error || data.message || "パスワードリセットの承認に失敗しました")
        return
      }

      await fetchEmployees()
      toast.success("パスワードリセット要求を承認しました")
    } catch (error) {
            toast.error("パスワードリセットの承認に失敗しました")
    }
  }

const EMPLOYEE_HEADERS = [
    "メールアドレス",
    "氏名",
    "生年月日",
    "部門名",
    "職位名",
    "権限",
    "服務年限",
    "住所",
  ]

  const buildEmployeeRow = (emp: any) => [
    emp.email || "",
    emp.name || "",
    emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split("T")[0] : "",
    emp.departmentName || "",
    emp.jobName || "",
    emp.role || "",
    emp.yearsOfService?.toString() || "",
    emp.address || "",
  ]

  const submitImportedEmployees = async (employeesToImport: any[]) => {
    if (!employeesToImport.length) {
      toast.error("インポートできるデータがありません")
      return false
    }

    // Cookies are automatically sent with requests
    toast.info(`${employeesToImport.length}件の従業員データをインポート中...`)

    const response = await fetch("/api/employees/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ employees: employeesToImport }),
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || "インポートに失敗しました")
      return false
    }

    await fetchEmployees()
    toast.success(data.message || `${data.created || 0}件の従業員を登録、${data.updated || 0}件を更新しました`)
    return true
  }

  const handleDownloadXLSX = () => {
    try {
      const rows = [EMPLOYEE_HEADERS, ...employees.map((emp) => buildEmployeeRow(emp))]
      const worksheet = XLSX.utils.aoa_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Employees")
      XLSX.writeFile(workbook, `従業員一覧_${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("XLSXファイルをダウンロードしました")
    } catch (error) {
            toast.error("XLSXのダウンロードに失敗しました")
    }
  }

  const handleXLSXUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      if (!worksheet) {
        toast.error("XLSXファイルにシートが含まれていません")
        return
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: "",
        raw: false,
      })

      const headerMap: Record<string, string> = {
        "メールアドレス": "email",
        "氏名": "name",
        "生年月日": "dateOfBirth",
        "部門名": "departmentName",
        "職位名": "jobName",
        "権限": "role",
        "服務年限": "yearsOfService",
        "住所": "address",
      }

      const employeesToImport: any[] = []
      const invalidRows: string[] = []

      rows.forEach((row: Record<string, any>, index: number) => {
        const employee: any = {}

        const potentialId = row["ID"]
        if (typeof potentialId === "string" && potentialId.trim() !== "") {
          employee.id = potentialId.trim()
        } else if (typeof potentialId === "number" && !Number.isNaN(potentialId)) {
          employee.id = String(potentialId)
        }

        Object.entries(headerMap).forEach(([header, key]) => {
          const value = row[header]
          employee[key] = typeof value === "string" ? value.trim() : value
        })

        employee.dateOfBirth = employee.dateOfBirth || null
        employee.address = employee.address || null
        employee.yearsOfService = employee.yearsOfService !== "" ? employee.yearsOfService : null
        employee.role = employee.role || "none"

        if (!employee.email || !employee.name) {
          invalidRows.push(`XLSX 行 ${index + 2}: メールアドレスと氏名は必須です`)
          return
        }

        if (employee.departmentName) {
          const department = departments.find((dept) => dept.name === employee.departmentName)
          if (!department) {
            invalidRows.push(`XLSX 行 ${index + 2}: 部門「${employee.departmentName}」が見つかりません`)
            return
          }
          employee.departmentId = String(department.id)
        } else {
          employee.departmentId = null
        }

        if (employee.jobName) {
          const job = jobs.find((job) => job.name === employee.jobName)
          if (!job) {
            invalidRows.push(`XLSX 行 ${index + 2}: 職位「${employee.jobName}」が見つかりません`)
            return
          }
          employee.jobId = String(job.id)
        } else {
          employee.jobId = null
        }

        employeesToImport.push(employee)
      })

      if (invalidRows.length) {
        invalidRows.slice(0, 3).forEach((msg) => toast.error(msg))
      }

      const success = await submitImportedEmployees(employeesToImport)
      if (success) {
        event.target.value = ""
      }
    } catch (error) {
            toast.error("XLSXの読み込みに失敗しました")
    }
  }

  const handleDeleteEmployee = async (employeeId: string) => {
    toast.info("従業員を削除しています…")
    try {
      // Cookies are automatically sent with requests
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "従業員の削除に失敗しました")
        return
      }

      await fetchEmployees()
      toast.success("従業員を削除しました")
    } catch (error) {
            toast.error("従業員の削除に失敗しました")
    }
  }

  return (
    <Tabs defaultValue="departments" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 gap-2 p-1.5 sm:p-2 h-auto bg-muted/50 rounded-lg">
        <TabsTrigger 
          value="departments" 
          className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2.5 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
        >
          <Building2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
          <span className="leading-tight text-center sm:text-left whitespace-nowrap">部門管理</span>
        </TabsTrigger>
        <TabsTrigger 
          value="jobs" 
          className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2.5 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
        >
          <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
          <span className="leading-tight text-center sm:text-left whitespace-nowrap">職位管理</span>
        </TabsTrigger>
        <TabsTrigger 
          value="employees" 
          className="group relative flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2.5 px-3 py-3 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground min-h-[56px] sm:min-h-[44px] touch-manipulation active:scale-[0.98]"
        >
          <Users className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
          <span className="leading-tight text-center sm:text-left whitespace-nowrap">従業員管理</span>
        </TabsTrigger>
      </TabsList>

      {/* Departments Tab */}
      <TabsContent value="departments" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">部門管理</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4 space-y-3">
            <CardDescription className="text-xs sm:text-sm">組織の部門を追加・編集・削除</CardDescription>
            <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  新規登録
                </Button>
              </DialogTrigger>
                <DialogContent key={`dept-add` } forceMount>
                  <DialogHeader>
                    <DialogTitle>新規部門登録</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>部門名 *</Label>
                      <Input
                        value={newDept.name}
                        onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                        placeholder="営業部"
                      />
                    </div>
                    <div>
                      <Label>優先順位</Label>
                      <Input
                        value={newDept.code}
                        onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <Label>説明</Label>
                      <Textarea
                        value={newDept.description}
                        onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
                        placeholder="部門の説明"
                      />
                    </div>
                    <div>
                      <Label>親部門</Label>
                      <Select 
                        value={newDept.parentId || "none"} 
                        onValueChange={(value) => setNewDept({ ...newDept, parentId: value === "none" ? null : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="親部門を選択（任意）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={String(dept.id)}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDeptOpen(false)}>
                      キャンセル
                    </Button>
                    <Button onClick={handleCreateDepartment}>登録</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
          </div>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>部門名</TableHead>
                  <TableHead>優先順位</TableHead>
                  <TableHead>親部門</TableHead>
                  <TableHead>従業員数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.code || "-"}</TableCell>
                    <TableCell>{dept.parentName || "-"}</TableCell>
                    <TableCell>{dept.employeeCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingDept({
                            ...dept,
                            parentId: dept.parentId ? String(dept.parentId) : null
                          })}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDepartment(dept.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Jobs Tab */}
      <TabsContent value="jobs" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">職位管理</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4 space-y-3">
            <CardDescription className="text-xs sm:text-sm">職位・役職を追加・編集・削除</CardDescription>
            <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  新規登録
                </Button>
              </DialogTrigger>
                <DialogContent key={`job-add`} forceMount>
                  <DialogHeader>
                    <DialogTitle>新規職位登録</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>職位名 *</Label>
                      <Input
                        value={newJob.name}
                        onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                        placeholder="課長"
                      />
                    </div>
                    <div>
                      <Label>コード</Label>
                      <Input
                        value={newJob.code}
                        onChange={(e) => setNewJob({ ...newJob, code: e.target.value })}
                        placeholder="MGR"
                      />
                    </div>
                    <div>
                      <Label>説明</Label>
                      <Textarea
                        value={newJob.description}
                        onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                        placeholder="職位の説明"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddJobOpen(false)}>
                      キャンセル
                    </Button>
                    <Button onClick={handleCreateJob}>登録</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
          </div>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>職位名</TableHead>
                  <TableHead>コード</TableHead>
                  <TableHead>従業員数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell>{job.code || "-"}</TableCell>
                    <TableCell>{job.employeeCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingJob(job)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteJob(job.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Employees Tab */}
      <TabsContent value="employees" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">従業員管理</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4 space-y-3">
            <CardDescription className="text-xs sm:text-sm">
              組織の従業員を追加・編集・削除
            </CardDescription>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadXLSX}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <Download className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  XLSXダウンロード
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => xlsxInputRef.current?.click()}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <Upload className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Excel一括登録
                </Button>
                <input
                  ref={xlsxInputRef}
                  id="xlsx-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleXLSXUpload}
                />
                <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                      <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      新規登録
                    </Button>
                  </DialogTrigger>
                  <DialogContent key={`emp-add`} forceMount className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>新規従業員登録</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>氏名 *</Label>
                        <Input
                          value={newEmployee.name}
                          onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                          placeholder="山田 太郎"
                        />
                      </div>
                      <div>
                        <Label>メールアドレス *</Label>
                        <Input
                          type="email"
                          value={newEmployee.email}
                          onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                          placeholder="user@sunhawk.co.jp"
                        />
                      </div>
                      <div>
                        <Label>パスワード *</Label>
                        <Input
                          type="password"
                          value={newEmployee.password}
                          onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>生年月日</Label>
                        <Input
                          type="date"
                          value={newEmployee.dateOfBirth}
                          onChange={(e) => setNewEmployee({ ...newEmployee, dateOfBirth: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>部門 *</Label>
                        <Select
                          value={newEmployee.departmentId}
                          onValueChange={(value) => setNewEmployee({ ...newEmployee, departmentId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="部門を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={String(dept.id)}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>職位 *</Label>
                        <Select
                          value={newEmployee.jobId}
                          onValueChange={(value) => setNewEmployee({ ...newEmployee, jobId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="職位を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {jobs.map((job) => (
                              <SelectItem key={job.id} value={String(job.id)}>
                                {job.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>権限</Label>
                        <Select
                          value={newEmployee.role}
                          onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">管理者</SelectItem>
                            <SelectItem value="employee">従業員</SelectItem>
                            <SelectItem value="none">権限なし</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>勤続年数</Label>
                        <Input
                          type="number"
                          value={newEmployee.yearsOfService}
                          onChange={(e) => setNewEmployee({ ...newEmployee, yearsOfService: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>住所</Label>
                        <Input
                          value={newEmployee.address}
                          onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                          placeholder="東京都..."
                        />
                      </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>
                        キャンセル
                      </Button>
                      <Button onClick={handleCreateEmployee}>登録</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </div>
          </div>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead>職位</TableHead>
                  <TableHead>生年月日</TableHead>
                  <TableHead>服務年限</TableHead>
                  <TableHead>権限</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.email}</TableCell>
                    <TableCell>{emp.departmentName || "-"}</TableCell>
                    <TableCell>{emp.jobName || "-"}</TableCell>
                    <TableCell>
                      {emp.dateOfBirth 
                        ? new Date(emp.dateOfBirth).toLocaleDateString('ja-JP', { 
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit' 
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {emp.yearsOfService !== null && emp.yearsOfService !== undefined 
                        ? `${emp.yearsOfService}年`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          emp.role === "admin" 
                            ? "default" 
                            : emp.role === "employee" 
                            ? "secondary" 
                            : "outline"
                        }
                      >
                        {emp.role === "admin" 
                          ? "管理者" 
                          : emp.role === "employee" 
                          ? "従業員" 
                          : "権限なし"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingEmployee(emp)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={emp.hasPendingPasswordReset ? "default" : "ghost"}
                          size="sm"
                          disabled={!emp.hasPendingPasswordReset}
                          onClick={() => emp.hasPendingPasswordReset && handleApprovePasswordReset(emp.id)}
                          title={
                            emp.hasPendingPasswordReset
                              ? "パスワードリセット要求を承認"
                              : "パスワードリセット要求はありません"
                          }
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteEmployee(emp.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Edit Department Dialog */}
      <Dialog 
        open={!!editingDept} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingDept(null)
          }
        }}
      >
        <DialogContent key={`dept-edit-${editingDept?.id ?? 'none'}`} forceMount>
          {editingDept && (
            <>
              <DialogHeader>
                <DialogTitle>部門情報編集</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>部門名 *</Label>
                  <Input
                    value={editingDept.name || ""}
                    onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>優先順位</Label>
                  <Input
                    value={editingDept.code || ""}
                    onChange={(e) => setEditingDept({ ...editingDept, code: e.target.value })}
                  />
                </div>
                <div>
                  <Label>説明</Label>
                  <Textarea
                    value={editingDept.description || ""}
                    onChange={(e) => setEditingDept({ ...editingDept, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>親部門</Label>
                  <Select
                    value={editingDept.parentId ? String(editingDept.parentId) : "none"}
                    onValueChange={(value) => setEditingDept({ ...editingDept, parentId: value === "none" ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="親部門を選択（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">なし</SelectItem>
                      {departments
                        .filter((d) => d.id !== editingDept.id)
                        .map((dept) => (
                          <SelectItem key={dept.id} value={String(dept.id)}>
                            {dept.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingDept(null)}>
                  キャンセル
                </Button>
                <Button onClick={handleUpdateDepartment}>更新</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog 
        open={!!editingJob} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingJob(null)
          }
        }}
      >
        <DialogContent key={`job-edit-${editingJob?.id ?? 'none'}`} forceMount>
          {editingJob && (
            <>
              <DialogHeader>
                <DialogTitle>職位情報編集</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>職位名 *</Label>
                  <Input
                    value={editingJob.name || ""}
                    onChange={(e) => setEditingJob({ ...editingJob, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>コード</Label>
                  <Input
                    value={editingJob.code || ""}
                    onChange={(e) => setEditingJob({ ...editingJob, code: e.target.value })}
                  />
                </div>
                <div>
                  <Label>説明</Label>
                  <Textarea
                    value={editingJob.description || ""}
                    onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingJob(null)}>
                  キャンセル
                </Button>
                <Button onClick={handleUpdateJob}>更新</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog 
        open={!!editingEmployee} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingEmployee(null)
          }
        }}
      >
        <DialogContent key={`emp-edit-${editingEmployee?.id ?? 'none'}`} forceMount className="max-h-[90vh] overflow-y-auto">
          {editingEmployee && (
            <>
              <DialogHeader>
                <DialogTitle>従業員情報編集</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>氏名 *</Label>
                  <Input
                    value={editingEmployee.name || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>メールアドレス</Label>
                  <Input
                    type="email"
                    value={editingEmployee.email || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>生年月日</Label>
                  <Input
                    type="date"
                    value={editingEmployee.dateOfBirth || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, dateOfBirth: e.target.value })}
                  />
                </div>
                <div>
                  <Label>部門</Label>
                  <Select
                    value={editingEmployee.departmentId || ""}
                    onValueChange={(value) => setEditingEmployee({ ...editingEmployee, departmentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="部門を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>職位</Label>
                  <Select
                    value={editingEmployee.jobId || ""}
                    onValueChange={(value) => setEditingEmployee({ ...editingEmployee, jobId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="職位を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={String(job.id)}>
                          {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>権限</Label>
                  <Select
                    value={editingEmployee.role || "none"}
                    onValueChange={(value) => setEditingEmployee({ ...editingEmployee, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">管理者</SelectItem>
                      <SelectItem value="employee">従業員</SelectItem>
                      <SelectItem value="none">権限なし</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>勤続年数</Label>
                  <Input
                    type="number"
                    value={editingEmployee.yearsOfService || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, yearsOfService: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>住所</Label>
                  <Input
                    value={editingEmployee.address || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, address: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingEmployee(null)}>
                キャンセル
              </Button>
              <Button onClick={handleUpdateEmployee}>更新</Button>
            </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 旧パスワード変更ダイアログは仕様変更により削除済み */}
    </Tabs>
  )
}

