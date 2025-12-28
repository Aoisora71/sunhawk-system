import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { query } from "@/lib/db"
import { registerSchema, validateRequest } from "@/lib/validation"
import { badRequestResponse, conflictResponse, handleError, successResponse } from "@/lib/api-errors"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = await validateRequest(registerSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { email, name, password } = validation.data

    // 既存ユーザー確認
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      return conflictResponse("このメールアドレスは既に登録されています")
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // 最低限の情報でユーザーを作成（他の項目は NULL、権限は none）
    const result = await query(
      `INSERT INTO users (
        email, password_hash, name, role
      ) VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, role`,
      [email, passwordHash, name, "none"],
    )

    const user = result.rows[0]

    return successResponse(
      {
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        },
        message: "ユーザー登録が完了しました",
      },
      201
    )
  } catch (error: any) {
    if (error.code === "23505") {
      return conflictResponse("このメールアドレスは既に登録されています")
    }
    return handleError(error, "ユーザー登録に失敗しました", "Register")
  }
}


