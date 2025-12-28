import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getCategoryId } from "@/lib/categories"

// GET /api/problems/public - Get all problems (public, no auth required)
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ 
        success: true,
        problems: []
      })
    }

    const result = await query(
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

    const problems = result.rows.map((row, index) => ({
      id: row.id,
      questionText: row.question_text,
      category: row.category,
      categoryId: row.category_id ?? getCategoryId(row.category) ?? null,
      questionType: (row.question_type || 'single_choice') as 'single_choice' | 'free_text',
      answer1Score: parseFloat(row.answer1_score.toString()),
      answer2Score: parseFloat(row.answer2_score.toString()),
      answer3Score: parseFloat(row.answer3_score.toString()),
      answer4Score: parseFloat(row.answer4_score.toString()),
      answer5Score: parseFloat(row.answer5_score.toString()),
      answer6Score: parseFloat(row.answer6_score.toString()),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({
      success: true,
      problems,
    })
  } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ 
      success: false,
      error: "問題の取得に失敗しました",
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}

