import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import bcrypt from "bcrypt"
import { query } from "@/lib/db"
import { handleError, conflictResponse } from "@/lib/api-errors"
import { cache, cacheKeys } from "@/lib/cache"
import { parsePaginationParams, createPaginatedResponse, applyPaginationToQuery } from "@/lib/pagination"

async function getDepartmentNameById(departmentId?: string | number | null) {
  if (departmentId === undefined || departmentId === null || departmentId === "") return null
  const id = typeof departmentId === "string" ? parseInt(departmentId, 10) : departmentId
  if (Number.isNaN(id)) return null
  
  // Check cache first
  const cacheKey = cacheKeys.department(id)
  const cached = cache.get<string>(cacheKey)
  if (cached !== null) return cached
  
  const result = await query<{ name: string }>("SELECT name FROM departments WHERE id = $1", [id])
  const name = result.rows[0]?.name || null
  
  if (name) {
      cache.set(cacheKey, name, 15 * 60 * 1000) // Cache for 15 minutes (increased for 70 users)
  }
  
  return name
}

async function getJobNameById(jobId?: string | number | null) {
  if (jobId === undefined || jobId === null || jobId === "") return null
  const id = typeof jobId === "string" ? parseInt(jobId, 10) : jobId
  if (Number.isNaN(id)) return null
  
  // Check cache first
  const cacheKey = cacheKeys.job(id)
  const cached = cache.get<string>(cacheKey)
  if (cached !== null) return cached
  
  const result = await query<{ name: string }>("SELECT name FROM jobs WHERE id = $1", [id])
  const name = result.rows[0]?.name || null
  
  if (name) {
      cache.set(cacheKey, name, 15 * 60 * 1000) // Cache for 15 minutes (increased for 70 users)
  }
  
  return name
}

// GET /api/employees - List all employees (admin only) or get current user info
async function handleGet(request: NextRequest) {
  try {
    // Check authentication using JWT from cookies
    const { requireAuth } = await import("@/lib/middleware")
    const user = await requireAuth(request)
    
    if (!user) {
      const { unauthorizedResponse } = await import("@/lib/api-errors")
      return unauthorizedResponse()
    }

    const isAdmin = user.role === "admin"

    // Parse pagination parameters (only for admin, regular users get single result)
    // Default to 1000 limit (effectively all employees) for backward compatibility
    // Frontend can request pagination by providing page/limit query params
    const pagination = isAdmin ? parsePaginationParams(request, 1000, 1000) : { page: 1, limit: 1, offset: 0 }

    // Check cache for all users (including admin) - aggressive caching for 70 users
    // Note: Cache doesn't include pagination, so we'll skip cache for paginated requests
    const useCache = !isAdmin || (pagination.page === 1 && (pagination.limit ?? 0) >= 1000)
    const cacheKey = isAdmin ? cacheKeys.employees() : cacheKeys.employees(user.userId)
    
    if (useCache) {
      const cached = cache.get<any[]>(cacheKey)
      if (cached !== null) {
        const { successResponse } = await import("@/lib/api-errors")
        // For non-admin, return single item; for admin, return all if not paginated
        if (!isAdmin) {
          return successResponse({ employees: cached })
        } else if ((pagination.limit ?? 0) >= 1000) {
          // Return cached data with employees key for backward compatibility
          return successResponse({ employees: cached })
        }
      }
    }

    // Check if users table exists (employees are stored in users table)
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )`
    )
    
    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist, return empty array
      const { successResponse } = await import("@/lib/api-errors")
      return successResponse({ employees: [] })
    }

    // Get total count for pagination (only for admin)
    let totalCount = 0
    if (isAdmin) {
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM users`
      )
      totalCount = parseInt(countResult.rows[0]?.count || '0', 10)
    } else {
      totalCount = 1 // Non-admin always gets 1 result
    }

    // Build query with pagination
    let baseQuery = `SELECT 
        u.id,
        u.email,
        u.name,
        u.date_of_birth,
        u.role,
        u.years_of_service,
        u.address,
        u.department_id,
        d.name as department_name,
        u.job_id,
        j.name as job_name,
        u.created_at,
        u.updated_at,
        u.pending_password_hash,
        u.password_reset_requested_at
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN jobs j ON u.job_id = j.id
       ${isAdmin ? "" : `WHERE u.id = $1`}
       ORDER BY u.created_at DESC`
    
    // Apply pagination
    const queryParams = isAdmin ? [] : [user.userId]
    const paginatedQuery = applyPaginationToQuery(baseQuery, pagination, queryParams)
    // Add pagination parameters to query params
    queryParams.push(pagination.limit, pagination.offset)

    const result = await query(paginatedQuery, queryParams)

    const employees = result.rows.map((row) => ({
      id: row.id.toString(),
      email: row.email,
      name: row.name,
      dateOfBirth: row.date_of_birth,
      role: row.role,
      yearsOfService: row.years_of_service,
      address: row.address,
      departmentId: row.department_id?.toString(),
      departmentName: row.department_name,
      jobId: row.job_id?.toString(),
      jobName: row.job_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      hasPendingPasswordReset: !!row.pending_password_hash,
      passwordResetRequestedAt: row.password_reset_requested_at,
    }))

    // Cache for all users - increased TTL for 70 concurrent users (only cache full results)
    if (useCache) {
      const cacheTTL = isAdmin ? 2 * 60 * 1000 : 3 * 60 * 1000 // Admin: 2 min, User: 3 min
      cache.set(cacheKey, employees, cacheTTL)
    }

    const { successResponse } = await import("@/lib/api-errors")
    
    // Return paginated response for admin, simple array for non-admin
    // Maintain backward compatibility: always include 'employees' key
    if (isAdmin) {
      const paginatedResponse = createPaginatedResponse(employees, totalCount, pagination)
      // Include both 'employees' (for backward compatibility) and pagination data
      return successResponse({
        employees: paginatedResponse.data,
        pagination: paginatedResponse.pagination,
      })
    } else {
      return successResponse({ employees })
    }
  } catch (error: any) {
    const { handleError } = await import("@/lib/api-errors")
    return handleError(error, "従業員一覧の取得に失敗しました", "List employees")
  }
}

// POST /api/employees - Create new employee
async function handlePost(request: NextRequest, user: { userId: number; email: string }) {
  try {
    const body = await request.json()
    const { createEmployeeSchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(createEmployeeSchema, body)

    if (!validation.success) {
      const { badRequestResponse } = await import("@/lib/api-errors")
      return badRequestResponse(validation.error)
    }

    const {
      email,
      name,
      password,
      dateOfBirth,
      departmentId,
      jobId,
      role,
      yearsOfService,
      address,
    } = validation.data

    // Check if email already exists
    const existingEmployee = await query("SELECT id FROM users WHERE email = $1", [email])
    if (existingEmployee.rows.length > 0) {
      const { conflictResponse } = await import("@/lib/api-errors")
      return conflictResponse("このメールアドレスは既に登録されています")
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    const departmentIdValue = departmentId ? parseInt(departmentId) : null
    const jobIdValue = jobId ? parseInt(jobId) : null

    const departmentName = await getDepartmentNameById(departmentIdValue)
    if (departmentIdValue && !departmentName) {
      const { badRequestResponse } = await import("@/lib/api-errors")
      return badRequestResponse("指定された部門が見つかりません")
    }

    const jobName = await getJobNameById(jobIdValue)
    if (jobIdValue && !jobName) {
      const { badRequestResponse } = await import("@/lib/api-errors")
      return badRequestResponse("指定された職位が見つかりません")
    }

    // Insert new employee
    const result = await query(
      `INSERT INTO users (
        email, password_hash, name, date_of_birth, department_id, job_id, department, position,
        role, years_of_service, address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, email, name, role, department_id, job_id, date_of_birth, 
                years_of_service, address, created_at`,
      [
        email.toLowerCase(),
        passwordHash,
        name,
        dateOfBirth || null,
        departmentIdValue,
        jobIdValue,
        departmentName,
        jobName,
        role || "none",
        yearsOfService ? (typeof yearsOfService === 'string' ? parseInt(yearsOfService, 10) : Number(yearsOfService)) : null,
        address || null,
      ]
    )

    const newEmployee = result.rows[0]

    // Get department and job names
    const deptJobResult = await query(
      `SELECT d.name as department_name, j.name as job_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN jobs j ON u.job_id = j.id
       WHERE u.id = $1`,
      [newEmployee.id]
    )

    const deptJob = deptJobResult.rows[0]

    // Invalidate cache
    cache.delete(cacheKeys.employees()) // All employees cache
    if (departmentIdValue) {
      cache.delete(cacheKeys.department(departmentIdValue))
      cache.delete(cacheKeys.departments())
    }
    if (jobIdValue) {
      cache.delete(cacheKeys.job(jobIdValue))
      cache.delete(cacheKeys.jobs())
    }

    const { successResponse } = await import("@/lib/api-errors")
    return successResponse({
      employee: {
        id: newEmployee.id.toString(),
        email: newEmployee.email,
        name: newEmployee.name,
        role: newEmployee.role,
        departmentId: newEmployee.department_id?.toString(),
        departmentName: deptJob?.department_name,
        jobId: newEmployee.job_id?.toString(),
        jobName: deptJob?.job_name,
        dateOfBirth: newEmployee.date_of_birth,
        yearsOfService: newEmployee.years_of_service,
        address: newEmployee.address,
      },
      message: "従業員を登録しました",
    })
  } catch (error: any) {
    if (error.code === "23505") {
      const { conflictResponse } = await import("@/lib/api-errors")
      return conflictResponse("このメールアドレスは既に登録されています")
    }
    return handleError(error, "従業員の登録に失敗しました", "Create employee")
  }
}

export const GET = handleGet
export const POST = withAdmin(handlePost)

