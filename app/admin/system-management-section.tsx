"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Server, 
  Database, 
  RefreshCw, 
  Download, 
  Upload, 
  Activity, 
  Cpu,
  MemoryStick,
  FileText,
  AlertCircle,
  Clock,
  History,
  Trash2,
  Calendar
} from "lucide-react"
import { toast } from "@/lib/toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import api from "@/lib/api-client"

interface SystemStatus {
  status: "healthy" | "warning" | "error"
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  database: {
    status: "connected" | "disconnected" | "error"
    connections: number
    poolSize: number
  }
  timestamp: string
}

interface LoginLog {
  id: number
  userId: number | null
  userName: string | null
  email: string
  loginAt: string
  ipAddress: string
  loginStatus: "success" | "failed"
  failureReason: string | null
}

export function SystemManagementSection() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([])
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [isClearingLogs, setIsClearingLogs] = useState(false)

  useEffect(() => {
    fetchSystemStatus()
    fetchLoginLogs()

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSystemStatus()
        fetchLoginLogs()
      }, 5000) // Refresh every 5 seconds

      return () => clearInterval(interval)
    }
  }, [autoRefresh, startDate, endDate])

  const fetchSystemStatus = async () => {
    try {
      setIsLoadingStatus(true)
      const response = await fetch("/api/system/status")
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSystemStatus(data.status)
        }
      }
    } catch (error) {
      console.error("Error fetching system status:", error)
      toast.error("システム状態の取得に失敗しました")
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const fetchLoginLogs = async () => {
    try {
      setIsLoadingLogs(true)
      const params = new URLSearchParams()
      if (startDate) {
        // Format: YYYY-MM-DD HH:MM:SS
        params.append("startDate", format(startDate, "yyyy-MM-dd") + " 00:00:00")
      }
      if (endDate) {
        // Format: YYYY-MM-DD HH:MM:SS (end of day)
        params.append("endDate", format(endDate, "yyyy-MM-dd") + " 23:59:59")
      }
      
      const queryString = params.toString()
      const response = await api.users.getLoginLogs(queryString)
      if (response?.success) {
        setLoginLogs(response.logs || [])
      } else {
        setLoginLogs([])
      }
    } catch (error) {
      console.error("Error fetching login logs:", error)
      toast.error("ログイン履歴の取得に失敗しました")
      setLoginLogs([])
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const handleClearLogs = async () => {
    if (!confirm("ログイン履歴をすべて削除しますか？この操作は元に戻せません。")) {
      return
    }

    try {
      setIsClearingLogs(true)
      const response = await fetch("/api/users/login-logs", {
        method: "DELETE",
        credentials: "include",
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast.success("ログイン履歴を初期化しました")
          fetchLoginLogs()
        } else {
          toast.error(data.error || "ログイン履歴の初期化に失敗しました")
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "ログイン履歴の初期化に失敗しました" }))
        toast.error(errorData.error || "ログイン履歴の初期化に失敗しました")
      }
    } catch (error) {
      console.error("Error clearing login logs:", error)
      toast.error("ログイン履歴の初期化に失敗しました")
    } finally {
      setIsClearingLogs(false)
    }
  }

  const formatLoginTime = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const seconds = String(date.getSeconds()).padStart(2, "0")
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  const getStatusText = (log: LoginLog) => {
    if (log.loginStatus === "success") {
      return "成功"
    }
    if (log.failureReason === "Invalid password") {
      return "パスワードエラー"
    }
    if (log.failureReason === "User not found") {
      return "未登録ユーザー"
    }
    return log.failureReason || "失敗"
  }

  const handleRestart = async () => {
    if (!confirm("システムを再起動しますか？この操作は不可逆です。")) {
      return
    }

    try {
      setIsRestarting(true)
      const response = await fetch("/api/system/restart", { method: "POST" })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast.success("システム再起動を開始しました")
          // Wait a bit and then reload the page
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else {
          toast.error(data.error || "システム再起動に失敗しました")
        }
      } else {
        toast.error("システム再起動に失敗しました")
      }
    } catch (error) {
      console.error("Error restarting system:", error)
      toast.error("システム再起動に失敗しました")
    } finally {
      setIsRestarting(false)
    }
  }

  const handleBackup = async () => {
    try {
      setIsBackingUp(true)
      const response = await fetch("/api/system/backup", { method: "POST" })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
        a.href = url
        a.download = `sunhawk-backup-${timestamp}.sql`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success("データベースのバックアップが完了しました")
      } else {
        toast.error("バックアップの作成に失敗しました")
      }
    } catch (error) {
      console.error("Error backing up database:", error)
      toast.error("バックアップの作成に失敗しました")
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleRestore = async () => {
    if (!restoreFile) {
      toast.error("復元ファイルを選択してください")
      return
    }

    if (!confirm("データベースを復元しますか？現在のデータは失われます。この操作は不可逆です。")) {
      return
    }

    try {
      setIsRestoring(true)
      const formData = new FormData()
      formData.append("file", restoreFile)

      const response = await fetch("/api/system/restore", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast.success("データベースの復元が完了しました")
          setRestoreFile(null)
          // Reload to reflect changes
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else {
          toast.error(data.error || "データベースの復元に失敗しました")
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "復元に失敗しました" }))
        toast.error(errorData.error || "データベースの復元に失敗しました")
      }
    } catch (error) {
      console.error("Error restoring database:", error)
      toast.error("データベースの復元に失敗しました")
    } finally {
      setIsRestoring(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}日 ${hours}時間 ${minutes}分`
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
        return <Badge className="bg-green-500">正常</Badge>
      case "warning":
        return <Badge className="bg-yellow-500">警告</Badge>
      case "error":
      case "disconnected":
        return <Badge className="bg-red-500">エラー</Badge>
      default:
        return <Badge variant="secondary">不明</Badge>
    }
  }


  return (
    <Tabs defaultValue="status" className="space-y-4">
      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 h-auto">
        <TabsTrigger value="status" className="text-xs sm:text-sm">
          <Activity className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="truncate">システム状態</span>
        </TabsTrigger>
        <TabsTrigger value="login-history" className="text-xs sm:text-sm">
          <History className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="truncate">ログイン履歴</span>
        </TabsTrigger>
        <TabsTrigger value="backup" className="text-xs sm:text-sm">
          <Database className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="truncate">バックアップ</span>
        </TabsTrigger>
      </TabsList>

      {/* System Status Tab */}
      <TabsContent value="status" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg">システム状態</CardTitle>
                <CardDescription className="text-xs sm:text-sm">現在のシステムの状態を詳細します</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <RefreshCw className={`mr-2 h-3 w-3 sm:h-4 sm:w-4 ${autoRefresh ? "animate-spin" : ""}`} />
                  <span className="truncate">{autoRefresh ? "自動更新: ON" : "自動更新: OFF"}</span>
                </Button>
                <Button variant="outline" size="sm" onClick={fetchSystemStatus} disabled={isLoadingStatus} className="w-full sm:w-auto text-xs sm:text-sm">
                  <RefreshCw className={`mr-2 h-3 w-3 sm:h-4 sm:w-4 ${isLoadingStatus ? "animate-spin" : ""}`} />
                  更新
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingStatus ? (
              <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
            ) : systemStatus ? (
              <div className="space-y-4">
                {/* Overall Status */}
                <Alert>
                  <Server className="h-4 w-4" />
                  <AlertTitle>システム状態</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span>システムは{systemStatus.status === "healthy" ? "正常に動作しています" : "問題があります"}</span>
                    {getStatusBadge(systemStatus.status)}
                  </AlertDescription>
                </Alert>

                {/* System Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        稼働時間
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatUptime(systemStatus.uptime)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MemoryStick className="h-4 w-4" />
                        メモリ使用率
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{formatBytes(systemStatus.memory.used)}</span>
                          <span>{formatBytes(systemStatus.memory.total)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              systemStatus.memory.percentage > 80
                                ? "bg-red-500"
                                : systemStatus.memory.percentage > 60
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${systemStatus.memory.percentage}%` }}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {systemStatus.memory.percentage.toFixed(1)}% 使用中
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        CPU使用率
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold">{systemStatus.cpu.usage.toFixed(1)}%</div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              systemStatus.cpu.usage > 80
                                ? "bg-red-500"
                                : systemStatus.cpu.usage > 60
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${systemStatus.cpu.usage}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        データベース接続
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span>状態</span>
                          {getStatusBadge(systemStatus.database.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          アクティブ接続: {systemStatus.database.connections} / {systemStatus.database.poolSize}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* System Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">システム操作</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={handleRestart}
                      disabled={isRestarting}
                      className="w-full sm:w-auto"
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
                      {isRestarting ? "再起動中..." : "システムを再起動"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">システム状態を取得できませんでした</div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Login History Tab */}
      <TabsContent value="login-history" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg">ログイン履歴</CardTitle>
                <CardDescription className="text-xs sm:text-sm">ユーザーのログイン履歴を詳細します</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearLogs}
                  disabled={isClearingLogs || isLoadingLogs}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  <Trash2 className={`mr-2 h-3 w-3 sm:h-4 sm:w-4 ${isClearingLogs ? "animate-spin" : ""}`} />
                  <span className="truncate">{isClearingLogs ? "初期化中..." : "履歴を初期化"}</span>
                </Button>
                <Button variant="outline" size="sm" onClick={fetchLoginLogs} disabled={isLoadingLogs} className="w-full sm:w-auto text-xs sm:text-sm">
                  <RefreshCw className={`mr-2 h-3 w-3 sm:h-4 sm:w-4 ${isLoadingLogs ? "animate-spin" : ""}`} />
                  更新
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Date Range Filter */}
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Label className="text-sm sm:text-base">日付範囲</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">開始日</Label>
                  <Input
                    type="date"
                    value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value + "T00:00:00") : undefined
                      setStartDate(date)
                    }}
                    placeholder="YYYY-MM-DD"
                    pattern="\d{4}-\d{2}-\d{2}"
                    className="text-sm sm:text-base h-10 sm:h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">終了日</Label>
                  <Input
                    type="date"
                    value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value + "T23:59:59") : undefined
                      setEndDate(date)
                    }}
                    placeholder="YYYY-MM-DD"
                    pattern="\d{4}-\d{2}-\d{2}"
                    className="text-sm sm:text-base h-10 sm:h-11"
                  />
                </div>
              </div>
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDate(undefined)
                    setEndDate(undefined)
                  }}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  クリア
                </Button>
              )}
            </div>

            {/* Login Logs Table */}
            {isLoadingLogs ? (
              <div className="text-center py-8 text-muted-foreground text-sm sm:text-base">読み込み中...</div>
            ) : loginLogs.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">ユーザー名</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">Email</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">IPアドレス</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">ログイン時間</TableHead>
                      <TableHead className="text-xs sm:text-sm whitespace-nowrap">ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {log.userName || "-"}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm break-all">{log.email}</TableCell>
                        <TableCell className="text-xs sm:text-sm whitespace-nowrap">{log.ipAddress}</TableCell>
                        <TableCell className="text-xs sm:text-sm whitespace-nowrap">{formatLoginTime(log.loginAt)}</TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {log.loginStatus === "success" ? (
                            <Badge className="bg-green-500 text-xs">成功</Badge>
                          ) : (
                            <Badge className="bg-red-500 text-xs">{getStatusText(log)}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm sm:text-base">ログイン履歴がありません</div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Backup Tab */}
      <TabsContent value="backup" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Backup Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                データベースバックアップ
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">現在のデータベースをファイルとしてダウンロードします</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>バックアップについて</AlertTitle>
                <AlertDescription>
                  バックアップには現在のデータベースの完全なコピーが含まれます。
                  定期的にバックアップを取得することを推奨します。
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="w-full"
                variant="default"
              >
                <Download className={`mr-2 h-4 w-4 ${isBackingUp ? "animate-spin" : ""}`} />
                {isBackingUp ? "バックアップ作成中..." : "バックアップをダウンロード"}
              </Button>
            </CardContent>
          </Card>

          {/* Restore Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                データベース復元
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">バックアップファイルからデータベースを復元します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>警告</AlertTitle>
                <AlertDescription>
                  復元を実行すると、現在のデータベースの内容が完全に置き換えられます。
                  この操作は元に戻せません。復元前に必ずバックアップを取得してください。
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="restore-file">復元ファイル (.sql)</Label>
                <Input
                  id="restore-file"
                  type="file"
                  accept=".sql"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  disabled={isRestoring}
                />
              </div>
              <Button
                onClick={handleRestore}
                disabled={isRestoring || !restoreFile}
                className="w-full"
                variant="destructive"
              >
                <Upload className={`mr-2 h-4 w-4 ${isRestoring ? "animate-spin" : ""}`} />
                {isRestoring ? "復元中..." : "データベースを復元"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}

