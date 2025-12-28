"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [resetPassword, setResetPassword] = useState("")
  const [resetMessage, setResetMessage] = useState("")
  const [isResetLoading, setIsResetLoading] = useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setResetMessage("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // Include cookies in cross-origin requests
      })

      const data = await response.json()

      if (!response.ok) {
        // Show detailed error in development
        const errorMsg = data.error || "ログインに失敗しました"
        const details = data.details ? `\n詳細: ${data.details}` : ""

        const nextAttempts = failedAttempts + 1
        setFailedAttempts(nextAttempts)

        let message = errorMsg + details
        if (nextAttempts >= 5) {
          message += "\nパスワードを忘れた場合は管理者に連絡してください。"
        }
        setError(message)
        setIsLoading(false)
        
        // Log error for debugging
                return
      }

      // 成功した場合は失敗回数をリセット
      setFailedAttempts(0)
      
      // Authentication is now handled via httpOnly cookies (JWT token)
      // No need to store in localStorage for security

      if (data.user.role === "admin") {
        router.push("/dashboard")
      } else if (data.user.role === "employee") {
        router.push("/employee-portal")
      }
    } catch (err: any) {
            const errorMsg = err?.message || "ログイン処理に失敗しました"
      const nextAttempts = failedAttempts + 1
      setFailedAttempts(nextAttempts)

      let message =
        errorMsg +
        "\nサーバーに接続できません。ネットワーク接続とサーバーの状態を確認してください。"
      if (nextAttempts >= 5) {
        message += "\nパスワードを忘れた場合は管理者に連絡してください。"
      }
      setError(message)
      setIsLoading(false)
    }
  }

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetMessage("")

    if (!email) {
      setResetMessage("メールアドレスを入力してください。")
      return
    }

    if (!resetPassword || resetPassword.length < 6) {
      setResetMessage("新しいパスワードを6文字以上で入力してください。")
      return
    }

    setIsResetLoading(true)

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword: resetPassword }),
        credentials: "include", // Include cookies in cross-origin requests
      })

      const data = await response.json()

      if (!response.ok) {
        setResetMessage(data.error || "パスワードリセット要求の送信に失敗しました。")
        return
      }

      setResetMessage(
        data.message ||
          "パスワードリセット要求をサービスに送信しました。\n管理者に連絡して承認を依頼してください。",
      )
      setResetPassword("")
    } catch (err: any) {
            setResetMessage("サーバーに接続できません。しばらくしてから再度お試しください。")
    } finally {
      setIsResetLoading(false)
    }
  }

  const handleForgotPasswordClick = () => {
    setIsResetDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 sm:mb-6">
            <Image 
              src="/logo.png" 
              alt="サンホーク ロゴ" 
              width={40} 
              height={40} 
              className="h-9 w-9 sm:h-10 sm:w-10 rounded" 
              priority 
            />
            <span className="text-lg sm:text-xl font-medium text-foreground">サンホーク</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4 sm:pb-6">
            <CardTitle className="text-xl sm:text-2xl font-medium">ログイン</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              メールアドレスとパスワードを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs sm:text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm sm:text-base">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@sunhawk.co.jp"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm sm:text-base">パスワード</Label>
                  <button
                    type="button"
                    className="text-xs sm:text-sm text-muted-foreground hover:text-foreground underline transition-colors"
                    onClick={handleForgotPasswordClick}
                  >
                    パスワードを忘れた場合
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              <Button type="submit" className="w-full h-10 sm:h-11 text-sm sm:text-base" disabled={isLoading}>
                {isLoading ? "ログイン中..." : "ログイン"}
              </Button>
            </form>

            <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">アカウントをお持ちでない場合は、</span>
              </div>
              <div>
                <Link
                  href="/register"
                  className="text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  新規登録はこちら
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* パスワードリセット用ダイアログ */}
        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">パスワードリセット</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                パスワードを忘れた場合は、新しいパスワードを入力してリセットを申請してください。
                申請後、管理者に連絡して承認を依頼してください。
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                handlePasswordResetRequest(e)
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="resetPassword" className="text-sm sm:text-base">新しいパスワード</Label>
                <Input
                  id="resetPassword"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="新しいパスワード（6文字以上）"
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              {resetMessage && (
                <div className="p-3 sm:p-4 bg-muted border rounded text-xs sm:text-sm whitespace-pre-line">
                  {resetMessage}
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                  onClick={() => {
                    setIsResetDialogOpen(false)
                    setResetMessage("")
                    setResetPassword("")
                  }}
                >
                  キャンセル
                </Button>
                <Button 
                  type="submit" 
                  disabled={isResetLoading}
                  className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
                >
                  {isResetLoading ? "申請中..." : "リセットを申請"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <p className="mt-6 sm:mt-8 text-center text-xs text-muted-foreground">
          このシステムは株式会社サンホークの職員専用です
        </p>
      </div>
    </div>
  )
}
