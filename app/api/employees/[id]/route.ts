import { type NextRequest } from "next/server"
import { withAdminParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse, notFoundResponse, conflictResponse } from "@/lib/api-errors"
import { cache, cacheKeys } from "@/lib/cache"

async function getDepartmentNameById(departmentId?: string | number | null) {
  if (departmentId === undefined || departmentId === null || departmentId === "") return null
  const id = typeof departmentId === "string" ? parseInt(departmentId, 10) : departmentId
  if (Number.isNaN(id)) return null
  const result = await query<{ name: string }>("SELECT name FROM departments WHERE id = $1", [id])
  return result.rows[0]?.name || null
}

async function getJobNameById(jobId?: string | number | null) {
  if (jobId === undefined || jobId === null || jobId === "") return null
  const id = typeof jobId === "string" ? parseInt(jobId, 10) : jobId
  if (Number.isNaN(id)) return null
  const result = await query<{ name: string }>("SELECT name FROM jobs WHERE id = $1", [id])
  return result.rows[0]?.name || null
}

// PUT /api/employees/[id] - Update employee
async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  const params = await context.params
  try {
    const {
      name,
      email,
      dateOfBirth,
      departmentId,
      jobId,
      role,
      yearsOfService,
      address,
    } = await request.json()
    const employeeId = params.id

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (email !== undefined) {
      // Check if new email is already taken
      const emailCheck = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [
        email.toLowerCase(),
        employeeId,
      ])
      if (emailCheck.rows.length > 0) {
        return conflictResponse("このメールアドレスは既に使用されています")
      }
      updates.push(`email = $${paramIndex++}`)
      values.push(email.toLowerCase())
    }
    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramIndex++}`)
      values.push(dateOfBirth || null)
    }
    if (departmentId !== undefined) {
      const departmentIdValue = departmentId ? parseInt(departmentId, 10) : null
      const departmentName = await getDepartmentNameById(departmentIdValue)
      if (departmentIdValue && !departmentName) {
        return badRequestResponse("指定された部門が見つかりません")
      }
      updates.push(`department_id = $${paramIndex++}`)
      values.push(departmentIdValue)
      updates.push(`department = $${paramIndex++}`)
      values.push(departmentName)
    }
    if (jobId !== undefined) {
      const jobIdValue = jobId ? parseInt(jobId, 10) : null
      const jobName = await getJobNameById(jobIdValue)
      if (jobIdValue && !jobName) {
        return badRequestResponse("指定された職位が見つかりません")
      }
      updates.push(`job_id = $${paramIndex++}`)
      values.push(jobIdValue)
      updates.push(`position = $${paramIndex++}`)
      values.push(jobName)
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`)
      values.push(role)
    }
    if (yearsOfService !== undefined) {
      updates.push(`years_of_service = $${paramIndex++}`)
      values.push(yearsOfService ? parseInt(yearsOfService) : null)
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`)
      values.push(address || null)
    }

    if (updates.length === 0) {
      return badRequestResponse("更新する項目がありません")
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(employeeId)

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, email, name, role, department_id, job_id, date_of_birth, 
                years_of_service, address, created_at, updated_at
    `

    const result = await query(updateQuery, values)

    if (result.rows.length === 0) {
      return notFoundResponse("従業員")
    }

    const employee = result.rows[0]

    // Get department and job names
    const deptJobResult = await query(
      `SELECT d.name as department_name, j.name as job_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN jobs j ON u.job_id = j.id
       WHERE u.id = $1`,
      [employee.id]
    )

    const deptJob = deptJobResult.rows[0]

    // Invalidate cache
    cache.delete(cacheKeys.employees()) // All employees cache
    cache.delete(cacheKeys.employees(Number(employee.id))) // Specific user cache
    if (employee.department_id) {
      cache.delete(cacheKeys.department(employee.department_id))
    }
    if (employee.job_id) {
      cache.delete(cacheKeys.job(employee.job_id))
    }

    return successResponse({
      employee: {
        id: employee.id.toString(),
        email: employee.email,
        name: employee.name,
        role: employee.role,
        departmentId: employee.department_id?.toString(),
        departmentName: deptJob?.department_name,
        jobId: employee.job_id?.toString(),
        jobName: deptJob?.job_name,
        dateOfBirth: employee.date_of_birth,
        yearsOfService: employee.years_of_service,
        address: employee.address,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at,
      },
      message: "従業員情報を更新しました",
    })
  } catch (error: any) {
    if (error.code === "23505") {
      return conflictResponse("このメールアドレスは既に使用されています")
    }
    return handleError(error, "従業員情報の更新に失敗しました", "Update employee")
  }
}

// DELETE /api/employees/[id] - Delete employee
async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  const params = await context.params
  try {
    const employeeId = params.id

    // Check if employee exists
    const employeeCheck = await query("SELECT id, email FROM users WHERE id = $1", [employeeId])
    if (employeeCheck.rows.length === 0) {
      return notFoundResponse("従業員")
    }

    // Prevent deleting yourself
    if (employeeCheck.rows[0].id === user.userId) {
      return badRequestResponse("自分自身を削除することはできません")
    }

    // Delete employee
    await query("DELETE FROM users WHERE id = $1", [employeeId])

    // Invalidate cache
    cache.delete(cacheKeys.employees()) // All employees cache
    cache.delete(cacheKeys.employees(Number(employeeId))) // Specific user cache

    return successResponse({ message: "従業員を削除しました" })
  } catch (error) {
    return handleError(error, "従業員の削除に失敗しました", "Delete employee")
  }
}

export const PUT = withAdminParams(handlePut)
export const DELETE = withAdminParams(handleDelete)

