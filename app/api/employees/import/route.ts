import { type NextRequest, NextResponse } from "next/server"
import { withAdmin } from "@/lib/middleware"
import bcrypt from "bcrypt"
import { query } from "@/lib/db"

// POST /api/employees/import - Bulk import employees from CSV
async function handlePost(request: NextRequest, user: { userId: number; email: string }) {
  try {
    const { employees } = await request.json()

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: "従業員データが提供されていません" }, { status: 400 })
    }

    let created = 0
    let updated = 0
    const errors: string[] = []

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i]

      try {
        let departmentName = emp.departmentName || null
        let jobName = emp.jobName || null

        if ((!departmentName || departmentName === "") && emp.departmentId) {
          const deptResult = await query<{ name: string }>("SELECT name FROM departments WHERE id = $1", [parseInt(emp.departmentId)])
          departmentName = deptResult.rows[0]?.name || null
        }

        if ((!jobName || jobName === "") && emp.jobId) {
          const jobResult = await query<{ name: string }>("SELECT name FROM jobs WHERE id = $1", [parseInt(emp.jobId)])
          jobName = jobResult.rows[0]?.name || null
        }

        // 必須項目チェック
        if (!emp.email || !emp.name) {
          errors.push(`行 ${i + 1}: メールアドレスと氏名は必須です`)
          continue
        }

        // メールアドレスの正規化
        const email = emp.email.toLowerCase().trim()

        // 既存の従業員をチェック（IDまたはメールアドレスで）
        let existingEmployee = null
        if (emp.id) {
          const existingById = await query("SELECT id, email FROM users WHERE id = $1", [parseInt(emp.id)])
          if (existingById.rows.length > 0) {
            existingEmployee = existingById.rows[0]
          }
        }

        if (!existingEmployee) {
          const existingByEmail = await query("SELECT id, email FROM users WHERE email = $1", [email])
          if (existingByEmail.rows.length > 0) {
            existingEmployee = existingByEmail.rows[0]
          }
        }

        if (existingEmployee) {
          // 更新処理
          const updates: string[] = []
          const values: any[] = []
          let paramIndex = 1

          updates.push(`name = $${paramIndex++}`)
          values.push(emp.name.trim())

          if (emp.dateOfBirth) {
            updates.push(`date_of_birth = $${paramIndex++}`)
            values.push(emp.dateOfBirth || null)
          }
          if (emp.departmentId !== undefined) {
            updates.push(`department_id = $${paramIndex++}`)
            values.push(emp.departmentId ? parseInt(emp.departmentId) : null)
            updates.push(`department = $${paramIndex++}`)
            values.push(departmentName || null)
          }
          if (emp.jobId !== undefined) {
            updates.push(`job_id = $${paramIndex++}`)
            values.push(emp.jobId ? parseInt(emp.jobId) : null)
            updates.push(`position = $${paramIndex++}`)
            values.push(jobName || null)
          }
          if (emp.role) {
            updates.push(`role = $${paramIndex++}`)
            values.push(emp.role || "none")
          }
          if (emp.yearsOfService !== undefined && emp.yearsOfService !== null) {
            updates.push(`years_of_service = $${paramIndex++}`)
            values.push(emp.yearsOfService ? parseInt(emp.yearsOfService) : null)
          }
          if (emp.address !== undefined) {
            updates.push(`address = $${paramIndex++}`)
            values.push(emp.address || null)
          }

          updates.push(`updated_at = CURRENT_TIMESTAMP`)
          values.push(existingEmployee.id)

          const updateQuery = `
            UPDATE users 
            SET ${updates.join(", ")}
            WHERE id = $${paramIndex}
          `

          await query(updateQuery, values)
          updated++
        } else {
          // 新規作成処理
          // デフォルトパスワードを固定値に設定
          const defaultPassword = "sunhawk123456"
          const passwordHash = await bcrypt.hash(defaultPassword, 10)

          await query(
            `INSERT INTO users (
              email, password_hash, name, date_of_birth, department_id, job_id, department, position,
              role, years_of_service, address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              email,
              passwordHash,
              emp.name.trim(),
              emp.dateOfBirth || null,
              emp.departmentId ? parseInt(emp.departmentId) : null,
              emp.jobId ? parseInt(emp.jobId) : null,
              departmentName || null,
              jobName || null,
              emp.role || "none",
              emp.yearsOfService ? parseInt(emp.yearsOfService) : null,
              emp.address || null,
            ]
          )
          created++
        }
      } catch (error: any) {
                errors.push(`行 ${i + 1}: ${error.message || "処理に失敗しました"}`)
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      message: `${created}件の従業員を登録、${updated}件を更新しました${errors.length > 0 ? ` (${errors.length}件のエラー)` : ""}`,
    })
  } catch (error: any) {
        return NextResponse.json({ error: "一括インポートに失敗しました" }, { status: 500 })
  }
}

export const POST = withAdmin(handlePost)

