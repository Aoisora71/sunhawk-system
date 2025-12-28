import { query } from "@/lib/db"
import { parseIntSafe } from "@/lib/db-helpers"
import { cache, cacheKeys } from "@/lib/cache"
import type { Department } from "@/lib/types"

const baseDepartmentSelect = `
  SELECT
    d.id,
    d.name,
    d.code,
    d.description,
    d.parent_id,
    parent.name AS parent_name,
    (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) AS employee_count,
    d.created_at,
    d.updated_at
  FROM departments d
  LEFT JOIN departments parent ON parent.id = d.parent_id
`

type DepartmentRow = {
  id: number
  name: string
  code?: string | null
  description?: string | null
  parent_id?: number | null
  parentId?: number | string | null
  parent_name?: string | null
  employee_count?: number | string | null
  created_at: string
  updated_at: string
}

export function mapDepartmentRow(row: DepartmentRow): Department {
  const parentId =
    row.parent_id !== undefined && row.parent_id !== null
      ? Number(row.parent_id)
      : row.parentId !== undefined && row.parentId !== null
        ? Number(row.parentId)
        : null

  return {
    id: Number(row.id),
    name: row.name,
    code: row.code ?? null,
    description: row.description ?? null,
    parentId,
    parentName: row.parent_name ?? null,
    employeeCount: parseIntSafe(row.employee_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchDepartmentById(id: number): Promise<Department | null> {
  // Check cache first
  const cacheKey = cacheKeys.department(id)
  const cached = cache.get<Department>(cacheKey)
  if (cached !== null) {
    return cached
  }

  const result = await query(`${baseDepartmentSelect} WHERE d.id = $1`, [id])
  if (result.rows.length === 0) {
    return null
  }
  
  const department = mapDepartmentRow(result.rows[0] as DepartmentRow)
  
  // Cache for 15 minutes (increased for 70 users)
  cache.set(cacheKey, department, 15 * 60 * 1000)
  
  return department
}

export const departmentListQuery = `
  SELECT 
    d.id,
    d.name,
    d.code,
    d.description,
    d.parent_id,
    parent.name as parent_name,
    COUNT(u.id) as employee_count,
    d.created_at,
    d.updated_at
  FROM departments d
  LEFT JOIN departments parent ON d.parent_id = parent.id
  LEFT JOIN users u ON u.department_id = d.id
  GROUP BY d.id, d.name, d.code, d.description, d.parent_id, parent.name, d.created_at, d.updated_at
  ORDER BY d.name
`





