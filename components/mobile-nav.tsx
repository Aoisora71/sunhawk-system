"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Settings, BarChart3, Menu, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

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

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
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

  const navItems = adminNavItems

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="メニューを開く"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsOpen(false)} />

          {/* Mobile Menu */}
          <nav className="fixed top-[73px] left-0 right-0 bg-card border-b border-border z-50 md:hidden max-h-[calc(100vh-73px)] overflow-y-auto">
            <div className="p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.title}
                  </Link>
                )
              })}
            </div>
          </nav>
        </>
      )}
    </>
  )
}
