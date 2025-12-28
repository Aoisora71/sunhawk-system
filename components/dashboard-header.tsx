"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Bell, LogOut, User, X, CheckCheck } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import api from "@/lib/api-client"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"

interface CurrentUserInfo {
  name: string
  email: string
  role: string
}

interface Notification {
  id: number
  title: string
  message: string
  isRead: boolean
  createdAt: string
  surveyName?: string | null
}

const MAX_VISIBLE_NOTIFICATIONS = 5

// Constants defined outside component to prevent hydration mismatch
// These MUST be constant strings, not computed values
const LOGO_ALT: string = "サンホーク ロゴ"
const BRAND_NAME: string = "サンホーク"

export function DashboardHeader() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUserInfo | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        // Get current user from server (cookies are httpOnly)
        const res = await fetch("/api/auth/me")
        if (!res.ok) return
        const data = await res.json()
        if (data?.success && data?.user) {
          setCurrentUser({ 
            name: data.user.name || data.user.email, 
            email: data.user.email,
            role: data.user.role || "none"
          })
        }
      } catch (e) {
        // ignore
      }
    }
    load()
  }, [])

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Cookies are automatically sent, no need to check localStorage
        const response = await api.notifications.list()
        if (response?.success) {
          setNotifications((response.notifications || []).slice(0, MAX_VISIBLE_NOTIFICATIONS))
          setUnreadCount(response.unreadCount || 0)
        }
      } catch (error) {
        // Ignore unauthorized errors when the session is missing/expired
        if (error && typeof error === 'object' && 'status' in error && (error as { status?: number }).status === 401) {
          setNotifications([])
          setUnreadCount(0)
          return
        }
        // Ignore network errors silently (user might be offline or API might be unavailable)
        if (error instanceof Error && (error.message.includes('Network error') || error.message.includes('Failed to fetch'))) {
          // Silently fail - notifications are not critical
          return
        }
        // Only log other errors
        if (process.env.NODE_ENV === 'development') {
                  }
      }
    }

    fetchNotifications()

    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      const response = await api.notifications.markAsRead(notificationId)
      if (response?.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
          }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const response = await api.notifications.markAllAsRead()
      if (response?.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        setUnreadCount(0)
      }
    } catch (error) {
          }
  }

  const notificationsToShow = notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS)

  return (
    <header className="border-b border-border bg-card sticky top-0 z-40">
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // 権限に応じて適切なページに遷移
              if (currentUser?.role === "admin") {
                router.push("/dashboard")
              } else if (currentUser?.role === "employee") {
                router.push("/employee-portal")
              } else {
                // 権限がない場合や未ログインの場合はホームページに遷移
                router.push("/")
              }
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <Image
              src="/logo.png"
              alt={LOGO_ALT}
              width={32}
              height={32}
              className="h-7 w-7 sm:h-8 sm:w-8 rounded"
              priority
              suppressHydrationWarning
            />
            <span 
              className="text-base sm:text-lg font-medium text-foreground hidden sm:inline"
              suppressHydrationWarning
            >
              {BRAND_NAME}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
          {/* User menu first */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 sm:w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-xs sm:text-sm font-medium truncate">
                    {currentUser?.name || "ユーザー"}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground break-all">
                    {currentUser?.email || "-"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile/password" className="flex items-center text-xs sm:text-sm">
                  パスワード変更
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link 
                  href="/" 
                  className="flex items-center text-xs sm:text-sm"
                  onClick={async (e) => {
                    e.preventDefault()
                    // Clear cookies via API (localStorage no longer used for auth)
                    try {
                      await fetch("/api/auth/logout", { method: "POST" })
                    } catch (error) {
                                          }
                    // Redirect to home
                    window.location.href = "/"
                  }}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ログアウト
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification icon after user icon */}
          <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-[10px] sm:text-xs"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="notification-popover w-[calc(100vw-4rem)] sm:w-[220px] md:w-[320px] p-0 flex flex-col max-h-[80vh] overflow-hidden"
              align="end"
              side="left"
              sideOffset={255}
              alignOffset={0}
              collisionPadding={16}
            >
              <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b shrink-0">
                <h3 className="font-semibold text-xs sm:text-sm">通知</h3>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] sm:text-xs shrink-0 px-2"
                    onClick={handleMarkAllAsRead}
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    すべて既読
                  </Button>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  {notificationsToShow.length === 0 ? (
                    <div className="p-6 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">
                      通知はありません
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notificationsToShow.map((notification) => (
                        <div
                          key={notification.id}
                          className={`px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors ${!notification.isRead ? "bg-primary/5" : ""
                            }`}
                        >
                          <div className="flex items-start gap-2 sm:gap-2.5">
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-start gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 flex-wrap">
                                <h4 className="font-medium text-xs sm:text-sm break-words overflow-wrap-anywhere leading-tight">
                                  {notification.title}
                                </h4>
                                {!notification.isRead && (
                                  <Badge
                                    variant="default"
                                    className="h-3.5 px-1 sm:h-4 sm:px-1.5 text-[10px] sm:text-xs shrink-0 mt-0.5"
                                  >
                                    新着
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-1 sm:space-y-1.5">
                                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-word leading-relaxed">
                                  {notification.message}
                                </p>
                                {notification.surveyName && (
                                  <p className="text-[10px] sm:text-xs text-muted-foreground break-words">
                                    サーベイ: {notification.surveyName}
                                  </p>
                                )}
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(notification.createdAt), {
                                    addSuffix: true,
                                    locale: ja,
                                  })}
                                </p>
                              </div>
                            </div>
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 mt-0.5 flex-shrink-0"
                                onClick={() => handleMarkAsRead(notification.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>

          <MobileNav />
        </div>
      </div>
    </header>
  )
}
