import { type NextRequest } from "next/server"
import { withAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"
import { successResponse, handleError, badRequestResponse } from "@/lib/api-errors"

async function handlePost(request: NextRequest, user: { userId: number; email: string }) {
  try {
    const body = await request.json()
    const { questionIds } = body

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return badRequestResponse("questionIds must be a non-empty array")
    }

    // Update display_order for each question based on its position in the array
    // Use a transaction to ensure all updates succeed or fail together
    await query("BEGIN")

    try {
      for (let i = 0; i < questionIds.length; i++) {
        const questionId = questionIds[i]
        const displayOrder = i + 1

        await query(
          `UPDATE problems 
           SET display_order = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [displayOrder, questionId]
        )
      }

      await query("COMMIT")
      return successResponse({ message: "質問の順序を更新しました" })
    } catch (error) {
      await query("ROLLBACK")
      throw error
    }
  } catch (error) {
    return handleError(error, "質問の順序の更新に失敗しました", "Update question order")
  }
}

export const POST = withAdmin(handlePost)

