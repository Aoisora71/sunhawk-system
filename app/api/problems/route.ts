import { type NextRequest } from "next/server"
import { withAdmin, withAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { getCategoryId } from "@/lib/categories"
import { successResponse, handleError, badRequestResponse, notFoundResponse } from "@/lib/api-errors"
import type { Problem } from "@/lib/types"

// GET /api/problems - List all problems
async function handleGet(request: NextRequest, user: { userId: number; email: string; role: string }) {
  try {
    // Check if problems table exists
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'problems'
      )`
    )
    
    if (!tableCheck.rows[0]?.exists) {
      return successResponse({ problems: [] })
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
      display_order: number | null
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
        COALESCE(display_order, id) as display_order,
        created_at,
        updated_at
      FROM problems
      ORDER BY COALESCE(display_order, id) ASC`
    )

    const problems: Problem[] = result.rows.map((row) => ({
      id: Number(row.id),
      questionText: row.question_text,
      category: row.category,
      categoryId: row.category_id ?? getCategoryId(row.category) ?? null,
      questionType: (row.question_type || 'single_choice') as 'single_choice' | 'free_text',
      answer1Score: Number(row.answer1_score),
      answer2Score: Number(row.answer2_score),
      answer3Score: Number(row.answer3_score),
      answer4Score: Number(row.answer4_score),
      answer5Score: Number(row.answer5_score),
      answer6Score: Number(row.answer6_score),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return successResponse({ problems })
  } catch (error) {
    return handleError(error, "問題の取得に失敗しました", "List problems")
  }
}

// POST /api/problems - Create new problem
async function handlePost(request: NextRequest, user: { userId: number; email: string }) {
  try {
    const body = await request.json()
    const { createProblemSchema, validateRequest } = await import("@/lib/validation")
    const validation = await validateRequest(createProblemSchema, body)

    if (!validation.success) {
      return badRequestResponse(validation.error)
    }

    const { questionText, category, categoryId, questionType, answer1Score, answer2Score, answer3Score, answer4Score, answer5Score, answer6Score } = validation.data

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

    // 自由入力問題の場合、カテゴリをnullにする
    const finalCategory = questionType === 'free_text' ? null : category
    const computedCategoryId = questionType === 'free_text' ? null : (categoryId ?? getCategoryId(category))

    // Get the maximum display_order to set the new question at the end
    const maxOrderResult = await query<{ max_order: number | null }>(
      `SELECT COALESCE(MAX(display_order), 0) as max_order FROM problems`
    )
    const nextOrder = (maxOrderResult.rows[0]?.max_order ?? 0) + 1

    const result = await query(
      `INSERT INTO problems (
        question_text,
        category,
        category_id,
        question_type,
        answer1_score,
        answer2_score,
        answer3_score,
        answer4_score,
        answer5_score,
        answer6_score,
        display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        questionText,
        finalCategory,
        computedCategoryId,
        questionType || 'single_choice',
        (() => { const v = parseFloat(String(answer1Score)); return Number.isFinite(v) ? v : 0 })(),
        (() => { const v = parseFloat(String(answer2Score)); return Number.isFinite(v) ? v : 0 })(),
        (() => { const v = parseFloat(String(answer3Score)); return Number.isFinite(v) ? v : 0 })(),
        (() => { const v = parseFloat(String(answer4Score)); return Number.isFinite(v) ? v : 0 })(),
        (() => { const v = parseFloat(String(answer5Score)); return Number.isFinite(v) ? v : 0 })(),
        (() => { const v = parseFloat(String(answer6Score)); return Number.isFinite(v) ? v : 0 })(),
        nextOrder,
      ]
    )

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
    return handleError(error, "問題の作成に失敗しました", "Create problem")
  }
}

export const GET = withAuth(handleGet)
export const POST = withAdmin(handlePost)

