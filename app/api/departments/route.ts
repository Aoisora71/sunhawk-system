import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"
import { tableExists, parseIntSafe } from "@/lib/db-helpers"
import { successResponse, handleError, badRequestResponse, conflictResponse } from "@/lib/api-errors"
import { cache, cacheKeys } from "@/lib/cache"
import type { Department } from "@/lib/types"
import { departmentListQuery, fetchDepartmentById, mapDepartmentRow } from "./utils"

// GET /api/departments - List all departments
async function handleGet(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = cacheKeys.departments()
    const cached = cache.get<Department[]>(cacheKey)
    if (cached !== null) {
      return successResponse({ departments: cached })
    }

    // Check if departments table exists
    const exists = await tableExists('departments')
    
    if (!exists) {
      return successResponse({ departments: [] })
    }

    const result = await query(departmentListQuery)
    const departments: Department[] = result.rows.map(mapDepartmentRow)

    // Cache for 5 minutes (departments change infrequently) - increased for 70 users
    cache.set(cacheKey, departments, 5 * 60 * 1000)

    return successResponse({ departments })
  } catch (error) {
    return handleError(error, "部門一覧の取得に失敗しました", "List departments")
  }
}

// POST /api/departments - Create new department
async function handlePost(request: NextRequest, user: { userId: number; email: string }) {
  try {
    const body = await request.json()
    const { createDepartmentSchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(createDepartmentSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { name, code, description, parentId } = validation.data

    const result = await query<{
      id: number
      name: string
      code?: string | null
      description?: string | null
      parent_id?: number | null
      created_at: string
    }>(
      `INSERT INTO departments (name, code, description, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, code, description, parent_id, created_at`,
      [
        name.trim(),
        code?.trim() || null,
        description?.trim() || null,
        parentId === "" || parentId === null || parentId === undefined 
          ? null 
          : parseIntSafe(parentId)
      ]
    )

    if (result.rows.length === 0) {
      return handleError(new Error("Failed to create department"), "部門の作成に失敗しました")
    }

    const insertedId = Number(result.rows[0].id)
    const department = await fetchDepartmentById(insertedId)

    // Invalidate cache
    cache.delete(cacheKeys.departments())
    cache.delete(cacheKeys.department(insertedId))

    return successResponse({ department })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return conflictResponse("この部門名は既に登録されています")
    }
    return handleError(error, "部門の作成に失敗しました", "Create department")
  }
}

export const GET = handleGet
export const POST = withAdmin(handlePost)

