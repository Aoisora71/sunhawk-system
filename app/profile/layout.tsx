import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { query } from "@/lib/db"

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const userEmail = cookieStore.get("userEmail")?.value

  if (!userEmail) {
    redirect("/login")
  }

  try {
    const result = await query<{ role: string }>(
      "SELECT role FROM users WHERE email = $1",
      [userEmail.toLowerCase().trim()]
    )

    if (result.rows.length === 0) {
      redirect("/login")
    }
  } catch (error) {
    
    redirect("/login")
  }

  return <>{children}</>
}

