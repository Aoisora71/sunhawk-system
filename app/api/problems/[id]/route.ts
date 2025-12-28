import { type NextRequest } from "next/server"
import { withAdminParams, withAuthParams } from "@/lib/middleware"
import { query } from "@/lib/db"
import { getCategoryId } from "@/lib/categories"
import { successResponse, handleError, badRequestResponse, notFoundResponse } from "@/lib/api-errors"
import type { Problem } from "@/lib/types"

// GET /api/problems/[id] - Get problem details
async function handleGet(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string; role: string }
) {
  try {
    const { id } = await context.params
    const problemId = id

    // Check if problems table exists
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'problems'
      )`
    )
    
    if (!tableCheck.rows[0]?.exists) {
      return notFoundResponse("問題テーブル")
    }

    const result = await query<{
      id: number
      question_text: string
      category: string
      category_id: number | null
      question_type: string | null
      answer1_score: number
      answer2_score: number
      answer3_score: number
      answer4_score: number
      answer5_score: number
      answer6_score: number
      created_at: string
      updated_at: string
    }>(
      `SELECT 
        id,
        question_text,
        category,
        category_id,
        COALESCE(question_type, 'single_choice') as question_type,
        answer1_score,
        answer2_score,
        answer3_score,
        answer4_score,
        answer5_score,
        answer6_score,
        created_at,
        updated_at
      FROM problems
      WHERE id = $1`,
      [problemId]
    )

    if (result.rows.length === 0) {
      return notFoundResponse("問題")
    }

    const problem = result.rows[0]

    return successResponse({
      problem: {
        id: Number(problem.id),
        questionText: problem.question_text,
        category: problem.category,
        categoryId: problem.category_id ?? getCategoryId(problem.category) ?? null,
        questionType: (problem.question_type || 'single_choice') as 'single_choice' | 'free_text',
        answer1Score: Number(problem.answer1_score),
        answer2Score: Number(problem.answer2_score),
        answer3Score: Number(problem.answer3_score),
        answer4Score: Number(problem.answer4_score),
        answer5Score: Number(problem.answer5_score),
        answer6Score: Number(problem.answer6_score),
        createdAt: problem.created_at,
        updatedAt: problem.updated_at,
      },
    })
  } catch (error) {
    return handleError(error, "問題の取得に失敗しました", "Get problem")
  }
}

// PUT /api/problems/[id] - Update problem
async function handlePut(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  try {
    const { id } = await context.params
    const problemId = id
    
    const body = await request.json()
    const { updateProblemSchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(updateProblemSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { questionText, category, categoryId, questionType, answer1Score, answer2Score, answer3Score, answer4Score, answer5Score, answer6Score, displayOrder } = validation.data

    // Check if problems table exists
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'problems'
      )`
    )
    
    if (!tableCheck.rows[0]?.exists) {
      return notFoundResponse("問題テーブル")
    }

    // Check if problem exists
    const checkResult = await query("SELECT id FROM problems WHERE id = $1", [problemId])
    if (checkResult.rows.length === 0) {
      return notFoundResponse("問題")
    }

    // Build update query
    const updates: string[] = []
    const values: (string | number | null)[] = []
    let paramIndex = 1

    if (questionText !== undefined) {
      updates.push(`question_text = $${paramIndex++}`)
      values.push(questionText)
    }
    if (questionType !== undefined) {
      updates.push(`question_type = $${paramIndex++}`)
      values.push(questionType)
    }
    if (category !== undefined) {
      // 自由入力問題の場合、カテゴリをnullにする
      const finalCategory = questionType === 'free_text' ? null : category
      updates.push(`category = $${paramIndex++}`)
      values.push(finalCategory)
      // also update category_id based on new category if categoryId not provided
      const cid = questionType === 'free_text' ? null : (categoryId ?? (category ? getCategoryId(category) : null))
      if (cid != null) {
        updates.push(`category_id = $${paramIndex++}`)
        values.push(cid)
      } else if (questionType === 'free_text') {
        // 自由入力問題の場合、category_idもnullにする
        updates.push(`category_id = $${paramIndex++}`)
        values.push(null)
      }
    } else if (categoryId !== undefined) {
      // questionTypeが指定されている場合、自由入力問題ならnullにする
      const finalCategoryId = questionType === 'free_text' ? null : categoryId
      updates.push(`category_id = $${paramIndex++}`)
      values.push(finalCategoryId)
    } else if (questionType === 'free_text') {
      // questionTypeがfree_textに変更された場合、カテゴリをnullにする
      updates.push(`category = $${paramIndex++}`)
      values.push(null)
      updates.push(`category_id = $${paramIndex++}`)
      values.push(null)
    }
    if (answer1Score !== undefined) {
      updates.push(`answer1_score = $${paramIndex++}`)
      const val = parseFloat(String(answer1Score))
      values.push(Number.isFinite(val) ? val : 0)
    }
    if (answer2Score !== undefined) {
      updates.push(`answer2_score = $${paramIndex++}`)
      const val = parseFloat(String(answer2Score))
      values.push(Number.isFinite(val) ? val : 0)
    }
    if (answer3Score !== undefined) {
      updates.push(`answer3_score = $${paramIndex++}`)
      const val = parseFloat(String(answer3Score))
      values.push(Number.isFinite(val) ? val : 0)
    }
    if (answer4Score !== undefined) {
      updates.push(`answer4_score = $${paramIndex++}`)
      const val = parseFloat(String(answer4Score))
      values.push(Number.isFinite(val) ? val : 0)
    }
    if (answer5Score !== undefined) {
      updates.push(`answer5_score = $${paramIndex++}`)
      const val = parseFloat(String(answer5Score))
      values.push(Number.isFinite(val) ? val : 0)
    }
    if (answer6Score !== undefined) {
      updates.push(`answer6_score = $${paramIndex++}`)
      const val = parseFloat(String(answer6Score))
      values.push(Number.isFinite(val) ? val : 0)
    }
    if (displayOrder !== undefined) {
      updates.push(`display_order = $${paramIndex++}`)
      const val = Number(displayOrder)
      values.push(Number.isFinite(val) && val > 0 ? val : null)
    }

    if (updates.length === 0) {
      return badRequestResponse("更新する項目がありません")
    }

    // Add updated_at timestamp (no parameter needed)
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    
    // Add problemId as the last parameter for WHERE clause
    values.push(problemId)
    const whereParamIndex = paramIndex

    // Log the query for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Update problem query:', {
        updates: updates.join(', '),
        values,
        whereParamIndex,
        problemId
      })
    }

    const result = await query(
      `UPDATE problems 
       SET ${updates.join(', ')} 
       WHERE id = $${whereParamIndex} 
       RETURNING *`,
      values
    )

    if (!result.rows || result.rows.length === 0) {
      return handleError(new Error("No rows updated"), "問題の更新に失敗しました（更新された行が見つかりません）", "Update problem")
    }

    const problem = result.rows[0]

    return successResponse({
      problem: {
        id: Number(problem.id),
        questionText: problem.question_text,
        category: problem.category,
        categoryId: problem.category_id ?? getCategoryId(problem.category) ?? null,
        questionType: (problem.question_type || 'single_choice') as 'single_choice' | 'free_text',
        answer1Score: Number(problem.answer1_score),
        answer2Score: Number(problem.answer2_score),
        answer3Score: Number(problem.answer3_score),
        answer4Score: Number(problem.answer4_score),
        answer5Score: Number(problem.answer5_score),
        answer6Score: Number(problem.answer6_score),
        createdAt: problem.created_at,
        updatedAt: problem.updated_at,
      },
    })
  } catch (error) {
    return handleError(error, "問題の更新に失敗しました", "Update problem")
  }
}

// DELETE /api/problems/[id] - Delete problem
async function handleDelete(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: { userId: number; email: string }
) {
  try {
    const { id } = await context.params
    const problemId = id

    // Check if problems table exists
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'problems'
      )`
    )
    
    if (!tableCheck.rows[0]?.exists) {
      return notFoundResponse("問題テーブル")
    }

    // Check if problem exists
    const checkResult = await query("SELECT id FROM problems WHERE id = $1", [problemId])
    if (checkResult.rows.length === 0) {
      return notFoundResponse("問題")
    }

    await query("DELETE FROM problems WHERE id = $1", [problemId])

    return successResponse({ message: "問題を削除しました" })
  } catch (error) {
    return handleError(error, "問題の削除に失敗しました", "Delete problem")
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuthParams(handleGet)(request, context)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminParams(handlePut)(request, context)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminParams(handleDelete)(request, context)
}

