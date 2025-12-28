import { z } from 'zod'

/**
 * Validation schemas for API endpoints
 */

// Password validation helper
export const passwordSchema = z.string()
  .min(8, 'パスワードは8文字以上である必要があります')
  .regex(/[a-z]/, 'パスワードには小文字が含まれている必要があります')
  .regex(/[A-Z]/, 'パスワードには大文字が含まれている必要があります')
  .regex(/[0-9]/, 'パスワードには数字が含まれている必要があります')

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください').toLowerCase().trim(),
  password: z.string().min(1, 'パスワードを入力してください'),
})

export const registerSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください').toLowerCase().trim(),
  password: passwordSchema,
  name: z.string().min(1, '名前を入力してください').trim(),
})

export const passwordResetRequestSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください').toLowerCase().trim(),
  newPassword: passwordSchema,
})

export const passwordResetApproveSchema = z.object({
  newPassword: passwordSchema.optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'パスワード（確認）を入力してください'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '新しいパスワードと確認用パスワードが一致しません',
  path: ['confirmPassword'],
})

// Employee schemas
export const createEmployeeSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください').toLowerCase().trim(),
  name: z.string().min(1, '名前を入力してください').trim(),
  password: passwordSchema,
  dateOfBirth: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
  role: z.enum(['admin', 'employee', 'none']).optional(),
  yearsOfService: z.number().int().min(0).optional().nullable(),
  address: z.string().optional().nullable(),
})

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, '名前を入力してください').trim().optional(),
  email: z.string().email('有効なメールアドレスを入力してください').toLowerCase().trim().optional(),
  dateOfBirth: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
  role: z.enum(['admin', 'employee', 'none']).optional(),
  yearsOfService: z.number().int().min(0).optional().nullable(),
  address: z.string().optional().nullable(),
})

// Department schemas
export const createDepartmentSchema = z.object({
  name: z.string().min(1, '部門名を入力してください').trim(),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
})

export const updateDepartmentSchema = z.object({
  name: z.string().min(1, '部門名を入力してください').trim().optional(),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
})

// Job schemas
export const createJobSchema = z.object({
  name: z.string().min(1, '職位名を入力してください').trim(),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export const updateJobSchema = z.object({
  name: z.string().min(1, '職位名を入力してください').trim().optional(),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

// Survey schemas
export const createSurveySchema = z.object({
  name: z.string().min(1, 'サーベイ名を入力してください').trim(),
  startDate: z.string().min(1, '開始日は必須です'),
  endDate: z.string().min(1, '終了日は必須です'),
  surveyType: z.enum(['organizational', 'growth']).optional(),
})

export const updateSurveySchema = z.object({
  name: z.string().min(1, 'サーベイ名を入力してください').trim().optional(),
  startDate: z.string().min(1, '開始日は必須です').optional(),
  endDate: z.string().min(1, '終了日は必須です').optional(),
  status: z.enum(['active', 'completed', 'draft']).optional(),
  surveyType: z.enum(['organizational', 'growth']).optional(),
})

// Problem schemas
export const createProblemSchema = z.object({
  questionText: z.string().min(1, '問題文は必須です').trim(),
  category: z.string().min(1, 'カテゴリは必須です'),
  categoryId: z.number().int().optional().nullable(),
  questionType: z.enum(['single_choice', 'free_text']).optional(),
  answer1Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()),
  answer2Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()),
  answer3Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()),
  answer4Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()),
  answer5Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()),
  answer6Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()),
})

export const updateProblemSchema = z.object({
  questionText: z.string().min(1, '問題文は必須です').trim().optional(),
  category: z.string().min(1, 'カテゴリは必須です').optional(),
  categoryId: z.number().int().optional().nullable(),
  questionType: z.enum(['single_choice', 'free_text']).optional(),
  answer1Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()).optional(),
  answer2Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()).optional(),
  answer3Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()).optional(),
  answer4Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()).optional(),
  answer5Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()).optional(),
  answer6Score: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).pipe(z.number()).optional(),
  displayOrder: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseInt(val, 10) : val).pipe(z.number().int()).optional(),
})

// Growth Survey Question schemas
export const createGrowthSurveyQuestionSchema = z.object({
  questionText: z.string().min(1, '質問文は必須です').trim(),
  category: z.string().optional().nullable(),
  // weightは数値またはnullを許可（0も有効な値として扱う）
  weight: z
    .union([z.string(), z.number(), z.null()])
    .transform((val) => {
      if (val === null || val === '') return null
      if (typeof val === 'string') return parseFloat(val)
      return val
    })
    .pipe(z.number().nullable())
    .optional(),
  targetJobs: z.array(z.string()).optional(),
  answers: z.array(z.object({
    text: z.string(),
    score: z.union([z.string(), z.number(), z.null()]).transform((val) => val === null || val === '' ? null : typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().nullable()).optional(),
  })).optional(),
  focusArea: z.string().optional().nullable(),
  answerType: z.string().optional(),
  questionType: z.enum(['single_choice', 'free_text']).optional(),
})

export const updateGrowthSurveyQuestionSchema = z.object({
  questionText: z.string().min(1, '質問文は必須です').trim().optional(),
  category: z.string().optional().nullable(),
  // weightは数値またはnullを許可（0も有効な値として扱う）
  weight: z
    .union([z.string(), z.number(), z.null()])
    .transform((val) => {
      if (val === null || val === '') return null
      if (typeof val === 'string') return parseFloat(val)
      return val
    })
    .pipe(z.number().nullable())
    .optional(),
  targetJobs: z.array(z.string()).optional(),
  answers: z.array(z.object({
    text: z.string(),
    score: z.union([z.string(), z.number(), z.null()]).transform((val) => val === null || val === '' ? null : typeof val === 'string' ? parseFloat(val) : val).pipe(z.number().nullable()).optional(),
  })).optional(),
  focusArea: z.string().optional().nullable(),
  answerType: z.string().optional(),
  questionType: z.enum(['single_choice', 'free_text']).optional(),
  isActive: z.boolean().optional(),
})

// Helper function to validate request body
export async function validateRequest<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await schema.parseAsync(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      return {
        success: false,
        error: firstError?.message || 'バリデーションエラーが発生しました',
      }
    }
    return {
      success: false,
      error: 'バリデーションエラーが発生しました',
    }
  }
}

