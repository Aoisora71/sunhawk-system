import { type NextRequest, NextResponse } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"

async function handleGet(request: NextRequest) {
  try {

    // Get all users (exclude developer account - ID 999999)
    const result = await query(
      `SELECT id, email, name, role, department, position, date_of_birth, 
              years_of_service, address, created_at, updated_at
       FROM users
       WHERE id != 999999
       ORDER BY created_at DESC`
    )

    const users = result.rows.map((row) => ({
      id: row.id.toString(),
      email: row.email,
      name: row.name,
      role: row.role,
      department: row.department,
      position: row.position,
      dateOfBirth: row.date_of_birth,
      yearsOfService: row.years_of_service,
      address: row.address,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({
      success: true,
      users,
    })
  } catch (error) {
    console.error("List users error:", error)
    return NextResponse.json({ error: "ユーザー一覧の取得に失敗しました" }, { status: 500 })
  }
}

export const GET = withAdmin(handleGet)
