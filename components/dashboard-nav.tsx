"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Settings, BarChart3, FileText } from "lucide-react"

const adminNavItems = [
  {
    title: "ダッシュボード",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "組織図",
    href: "/organization",
    icon: Users,
  },
  {
    title: "分析レポート",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "管理画面",
    href: "/admin",
    icon: Settings,
  },
]

const employeeNavItems = [
  {
    title: "従業員ポータル",
    href: "/employee-portal",
    icon: FileText,
  },
]

export function DashboardNav() {
  const pathname = usePathname()
  // Optimistically assume admin since layouts verify server-side
  // Only hide if we explicitly get a non-admin response
  const [shouldHide, setShouldHide] = useState(false)

  useEffect(() => {
    // Get user role from server (cookies are automatically sent)
    // This is a safety check - layouts already verify admin access server-side
    const fetchUserRole = async () => {
      try {
        const response = await fetch("/api/auth/me")
        if (response.ok) {
          const data = await response.json()
          if (data?.success && data?.user && data.user.role !== "admin") {
            // Only hide if we explicitly get a non-admin response
            setShouldHide(true)
          }
        }
      } catch (error) {
        // On error, keep showing nav (optimistic - layouts handle auth)
              }
    }
    fetchUserRole()
  }, [])

  // Only hide if we explicitly got a non-admin response
  if (shouldHide) {
    return null
  }

  return (
    <nav className="hidden md:block w-56 lg:w-64 border-r border-border bg-card min-h-[calc(100vh-73px)] sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
      <div className="p-3 sm:p-4 space-y-1">
        {adminNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
              <span className="truncate">{item.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
