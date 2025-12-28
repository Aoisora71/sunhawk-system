import { type NextRequest } from "next/server"
import { withAdminParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { fetchDepartmentById } from "../utils"
import { successResponse, handleError, badRequestResponse, notFoundResponse, conflictResponse } from "@/lib/api-errors"
import { cache, cacheKeys } from "@/lib/cache"

// PUT /api/departments/[id] - Update department
async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  const params = await context.params
  try {
    const { name, code, description, parentId } = await request.json()
    const departmentId = params.id

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
    if (parentId !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`)
      // Handle empty string, null, undefined, or string/number values
      const parentIdValue = parentId === "" || parentId === null || parentId === undefined 
        ? null 
        : typeof parentId === "number" 
        ? parentId 
        : parseInt(String(parentId), 10)
      values.push(isNaN(parentIdValue as number) ? null : parentIdValue)
    }

    if (updates.length === 0) {
      return badRequestResponse("更新する項目がありません")
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(departmentId)

    const updateQuery = `
      UPDATE departments 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, code, description, parent_id, created_at, updated_at
    `

    const result = await query(updateQuery, values)

    if (result.rows.length === 0) {
      return notFoundResponse("部門")
    }

    const updatedDept = await fetchDepartmentById(Number(departmentId))
    if (!updatedDept) {
      return notFoundResponse("部門")
    }

    // Invalidate cache
    cache.delete(cacheKeys.departments())
    cache.delete(cacheKeys.department(Number(departmentId)))

    return successResponse({ department: updatedDept })
  } catch (error: any) {
    if (error.code === "23505") {
      return conflictResponse("この部門名は既に使用されています")
    }
    return handleError(error, "部門の更新に失敗しました", "Update department")
  }
}

// DELETE /api/departments/[id] - Delete department
async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  const params = await context.params
  try {
    const departmentId = params.id

    // Check if department has employees
    const employeeCheck = await query("SELECT COUNT(*) as count FROM users WHERE department_id = $1", [departmentId])
    if (parseInt(employeeCheck.rows[0].count) > 0) {
      return badRequestResponse("この部門に従業員が所属しているため削除できません")
    }

    // Check if department has child departments
    const childCheck = await query("SELECT COUNT(*) as count FROM departments WHERE parent_id = $1", [departmentId])
    if (parseInt(childCheck.rows[0].count) > 0) {
      return badRequestResponse("この部門に子部門が存在するため削除できません")
    }

    await query("DELETE FROM departments WHERE id = $1", [departmentId])

    // Invalidate cache
    cache.delete(cacheKeys.departments())
    cache.delete(cacheKeys.department(Number(departmentId)))

    return successResponse({ message: "部門を削除しました" })
  } catch (error) {
    return handleError(error, "部門の削除に失敗しました", "Delete department")
  }
}

export const PUT = withAdminParams(handlePut)
export const DELETE = withAdminParams(handleDelete)

