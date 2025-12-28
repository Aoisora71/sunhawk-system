import { NextRequest, NextResponse } from "next/server"
import { successResponse } from "@/lib/api-errors"
import { getAuthCookieOptions } from "@/lib/cookie-utils"

export async function POST(request: NextRequest) {
  const response = successResponse({ message: "ログアウトしました" })

  // Get cookie options to ensure proper deletion
  const cookieOptions = getAuthCookieOptions(request)

  // Clear auth cookies by setting them to expire immediately
  // Use same options to ensure proper deletion across domains
  response.cookies.set("authToken", "", {
    ...cookieOptions,
    maxAge: 0,
    expires: new Date(0),
  })
  response.cookies.set("userEmail", "", {
    ...cookieOptions,
    maxAge: 0,
    expires: new Date(0),
  })

  return response
}

