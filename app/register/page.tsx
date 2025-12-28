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

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (password !== confirmPassword) {
      setError("パスワードが一致しません")
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "ユーザー登録に失敗しました")
        setIsLoading(false)
        return
      }

      // 権限は付与せず、通知のみ詳細
      setSuccess("登録が完了しました。\n権限付与については管理者にお問い合わせください。")
      setIsLoading(false)
      // フォームの値は残しておくが、必要ならここでクリアも可能
    } catch (err: any) {
      
      setError("サーバーに接続できません。しばらくしてから再度お試しください。")
      setIsLoading(false)
    }
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
            <CardTitle className="text-xl sm:text-2xl font-medium">新規登録</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              基本情報を入力してアカウントを作成します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs sm:text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-xs sm:text-sm text-green-700 dark:text-green-300 whitespace-pre-line">
                  {success}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm sm:text-base">氏名</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm sm:text-base">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm sm:text-base">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm sm:text-base">パスワード（確認）</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="text-sm sm:text-base h-10 sm:h-11"
                />
              </div>
              <Button type="submit" className="w-full h-10 sm:h-11 text-sm sm:text-base" disabled={isLoading}>
                {isLoading ? "登録中..." : "登録する"}
              </Button>
            </form>

            <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm">
              すでにアカウントをお持ちですか？{" "}
              <Link 
                href="/login" 
                className="text-muted-foreground hover:text-foreground underline transition-colors"
              >
                ログインはこちら
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 sm:mt-8 text-center text-xs text-muted-foreground">
          このシステムは株式会社サンホークの職員専用です
        </p>
      </div>
    </div>
  )
}


