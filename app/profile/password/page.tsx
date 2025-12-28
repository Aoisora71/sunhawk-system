"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authApi } from "@/lib/api-client"

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess(false)

    // Client-side validation
    if (!currentPassword) {
      setError("現在のパスワードを入力してください")
      setIsLoading(false)
      return
    }

    if (!newPassword) {
      setError("新しいパスワードを入力してください")
      setIsLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setError("パスワードは6文字以上である必要があります")
      setIsLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError("新しいパスワードと確認用パスワードが一致しません")
      setIsLoading(false)
      return
    }

    if (currentPassword === newPassword) {
      setError("新しいパスワードは現在のパスワードと異なる必要があります")
      setIsLoading(false)
      return
    }

    try {
      await authApi.changePassword(currentPassword, newPassword, confirmPassword)
      setSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
    } catch (err: any) {
      
      const errorMsg = err?.message || "パスワードの変更に失敗しました"
      setError(errorMsg)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">パスワード変更</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              現在のパスワードを入力し、新しいパスワードを設定してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            {success && (
              <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-xs sm:text-sm text-green-700 dark:text-green-300">
                パスワードを変更しました。ダッシュボードにリダイレクトします...
              </div>
            )}
            {error && (
              <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs sm:text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm sm:text-base">
                  現在のパスワード
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={isLoading || success}
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm sm:text-base">
                  新しいパスワード
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading || success}
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
                <p className="text-xs text-muted-foreground">
                  パスワードは6文字以上である必要があります
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm sm:text-base">
                  新しいパスワード（確認）
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading || success}
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 h-10 sm:h-11 text-sm sm:text-base"
                  disabled={isLoading || success}
                >
                  {isLoading ? "変更中..." : "パスワードを変更"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 sm:h-11 text-sm sm:text-base"
                  onClick={() => router.back()}
                  disabled={isLoading || success}
                >
                  キャンセル
                </Button>
              </div>
            </form>
            <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm">
              <Link
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground underline transition-colors"
              >
                ダッシュボードに戻る
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

