import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"
import { tableExists } from "@/lib/db-helpers"
import { successResponse, handleError } from "@/lib/api-errors"
import { cache, cacheKeys } from "@/lib/cache"

// GET /api/jobs - List all jobs/positions
async function handleGet(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = cacheKeys.jobs()
    const cached = cache.get<any[]>(cacheKey)
    if (cached !== null) {
      return successResponse({ jobs: cached })
    }

    // Check if jobs table exists
    const exists = await tableExists('jobs')
    
    if (!exists) {
      return successResponse({ jobs: [] })
    }

    const result = await query(
      `SELECT 
        j.id,
        j.name,
        j.code,
        j.description,
        COUNT(u.id) as employee_count,
        j.created_at,
        j.updated_at
       FROM jobs j
       LEFT JOIN users u ON u.job_id = j.id
       GROUP BY j.id
       ORDER BY j.name`
    )

    const jobs = result.rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      code: row.code,
      description: row.description,
      employeeCount: parseInt(row.employee_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    // Cache for 5 minutes (jobs change infrequently) - increased for 70 users
    cache.set(cacheKey, jobs, 5 * 60 * 1000)

    return successResponse({ jobs })
  } catch (error) {
    return handleError(error, "職位一覧の取得に失敗しました", "List jobs")
  }
}

// POST /api/jobs - Create new job/position
async function handlePost(request: NextRequest, user: { userId: number; email: string }) {
  try {
    const body = await request.json()
    const { createJobSchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(createJobSchema, body)

    if (!validation.success) {
      const { badRequestResponse } = await import("@/lib/api-errors")
      return badRequestResponse(validation.error)
    }

    const { name, code, description } = validation.data

    const result = await query(
      `INSERT INTO jobs (name, code, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, code, description, created_at`,
      [name.trim(), code?.trim() || null, description?.trim() || null]
    )

    const job = result.rows[0]

    // Invalidate cache
    cache.delete(cacheKeys.jobs())
    cache.delete(cacheKeys.job(Number(job.id)))

    return successResponse({
      job: {
        id: job.id.toString(),
        name: job.name,
        code: job.code,
        description: job.description,
        createdAt: job.created_at,
      },
    })
  } catch (error: any) {
    if (error.code === "23505") {
      const { conflictResponse } = await import("@/lib/api-errors")
      return conflictResponse("この職位名は既に登録されています")
    }
    return handleError(error, "職位の作成に失敗しました", "Create job")
  }
}

export const GET = handleGet
export const POST = withAdmin(handlePost)

