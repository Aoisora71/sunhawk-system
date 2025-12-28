"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"

export default function SurveyCompletePage() {
  const [completionTime, setCompletionTime] = useState<string>("")

  useEffect(() => {
    // Get completion time from URL params or use current time as fallback
    const getCompletionTime = () => {
      if (typeof window === "undefined") return

      const urlParams = new URLSearchParams(window.location.search)
      const completedAtParam = urlParams.get("completedAt")
      
      if (completedAtParam) {
        try {
          const completedDate = new Date(completedAtParam)
          const dateString = completedDate.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
          const timeString = completedDate.toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
          setCompletionTime(`${dateString} ${timeString}`)
          return
        } catch (error) {
                  }
      }
      
      // Fallback to current time if no param or parsing fails
      const now = new Date()
      const dateString = now.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      const timeString = now.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      setCompletionTime(`${dateString} ${timeString}`)
    }

    getCompletionTime()
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-[oklch(0.55_0.15_160)]/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-[oklch(0.55_0.15_160)]" />
            </div>
            <CardTitle className="text-2xl">回答が完了しました</CardTitle>
            <CardDescription>ご協力ありがとうございました</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">{completionTime || "--:--:--"}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <Link href="/employee-portal">従業員ポータルに戻る</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1 bg-transparent">
                <Link href="/">ホームに戻る</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
