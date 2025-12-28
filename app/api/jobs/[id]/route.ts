import { type NextRequest } from "next/server"
import { withAdminParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse, notFoundResponse, conflictResponse } from "@/lib/api-errors"
import { cache, cacheKeys } from "@/lib/cache"

// PUT /api/jobs/[id] - Update job/position
async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  const params = await context.params
  try {
    const { name, code, description } = await request.json()
    const jobId = params.id

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (code !== undefined) {
      updates.push(`code = $${paramIndex++}`)
      values.push(code || null)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description || null)
    }

    if (updates.length === 0) {
      return badRequestResponse("更新する項目がありません")
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(jobId)

    const updateQuery = `
      UPDATE jobs 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, code, description, created_at, updated_at
    `

    const result = await query(updateQuery, values)

    if (result.rows.length === 0) {
      return notFoundResponse("職位")
    }

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
        updatedAt: job.updated_at,
      },
    })
  } catch (error: any) {
    if (error.code === "23505") {
      return conflictResponse("この職位名は既に使用されています")
    }
    return handleError(error, "職位の更新に失敗しました", "Update job")
  }
}

// DELETE /api/jobs/[id] - Delete job/position
async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  const params = await context.params
  try {
    const jobId = params.id

    // Check if job has employees
    const employeeCheck = await query("SELECT COUNT(*) as count FROM users WHERE job_id = $1", [jobId])
    if (parseInt(employeeCheck.rows[0].count) > 0) {
      return badRequestResponse("この職位に従業員が所属しているため削除できません")
    }

    await query("DELETE FROM jobs WHERE id = $1", [jobId])

    // Invalidate cache
    cache.delete(cacheKeys.jobs())
    cache.delete(cacheKeys.job(Number(jobId)))

    return successResponse({ message: "職位を削除しました" })
  } catch (error) {
    return handleError(error, "職位の削除に失敗しました", "Delete job")
  }
}

export const PUT = withAdminParams(handlePut)
export const DELETE = withAdminParams(handleDelete)

