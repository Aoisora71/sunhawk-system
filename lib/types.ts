// Type definitions for the application

// User types
export interface User {
  id: number
  email: string
  name: string
  role: 'admin' | 'employee' | 'none'
  departmentId?: number | null
  departmentName?: string | null
  jobId?: number | null
  jobName?: string | null
  dateOfBirth?: string | null
  yearsOfService?: number | null
  address?: string | null
  createdAt: string
  updatedAt: string
  hasPendingPasswordReset?: boolean
  passwordResetRequestedAt?: string | null
}

// Department types
export interface Department {
  id: number
  name: string
  code?: string | null
  description?: string | null
  parentId?: number | null
  parentName?: string | null
  employeeCount: number
  createdAt: string
  updatedAt: string
}

// Job/Position types
export interface Job {
  id: number
  name: string
  code?: string | null
  description?: string | null
  employeeCount: number
  createdAt: string
  updatedAt: string
}

// Problem types
export type QuestionType = 'single_choice' | 'free_text'

export interface Problem {
  id: number
  questionText: string
  category: string
  categoryId?: number | null
  questionType: QuestionType
  answer1Score: number
  answer2Score: number
  answer3Score: number
  answer4Score: number
  answer5Score: number
  answer6Score: number
  displayOrder?: number | null
  createdAt: string
  updatedAt: string
}

// Survey types
export interface Survey {
  id: number
  name: string
  startDate: string
  endDate: string
  status: 'active' | 'completed' | 'draft'
  surveyType: 'organizational' | 'growth'
  createdAt: string
  updatedAt: string
}

// Growth survey types
export interface GrowthSurveyAnswerOption {
  text: string
  score: number | null
}

export interface GrowthSurveyQuestion {
  id: number
  questionText: string
  category: string
  weight?: number | null
  targetJobs: string[]
  answers: GrowthSurveyAnswerOption[]
  focusArea?: string
  answerType: string
  questionType: QuestionType
  isActive: boolean
  displayOrder?: number | null
  createdAt: string
  updatedAt: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  error?: string
  details?: string
  [key: string]: any
}

export interface ApiListResponse<T> extends ApiResponse {
  [key: string]: T[] | boolean | string | undefined
}

// Database query result types
export interface QueryResult<T = any> {
  rows: T[]
  rowCount: number
  command: string
  fields: any[]
}

// Organizational Survey Results types
export interface SurveyResultItem {
  // Support both old format (questionId, categoryId, score) and new format (qid, cid, s)
  questionId?: number
  categoryId?: number
  score?: number
  qid?: number
  cid?: number
  s?: number
}

export interface OrganizationalSurveyResult {
  id: number
  userId: number
  surveyId: number
  response: SurveyResultItem[]
  responseRate: number
  createdAt: string
  updatedAt: string
}

export interface GrowthSurveyAnswer {
  questionId: number
  questionText: string
  category?: string | null
  answer: string
  score?: number | null
  answerType?: string
  savedAt: string
}

export interface GrowthSurveyResponse {
  userId: number
  responses: GrowthSurveyAnswer[]
  progressCount: number
  totalQuestions: number
  completed: boolean
  completedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

// Organizational Survey Summary types
export interface OrganizationalSurveySummary {
  id: number
  userId: number
  surveyId: number
  category1Score: number
  category2Score: number
  category3Score: number
  category4Score: number
  category5Score: number
  category6Score: number
  category7Score: number
  category8Score: number
  totalScore: number
  createdAt: string
  updatedAt: string
}

// Notification types
export interface Notification {
  id: number
  userId: number
  surveyId: number | null
  title: string
  message: string
  isRead: boolean
  createdAt: string
  readAt: string | null
  createdBy: number | null
}

