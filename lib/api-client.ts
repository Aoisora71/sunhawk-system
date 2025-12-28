import type { GrowthSurveyResponse } from "./types"

// API Client for frontend to interact with backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

// Helper function to get auth headers
// Note: Authentication is now handled via httpOnly cookies (JWT token)
// This header is kept for backward compatibility but cookies are preferred
function getAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    // Cookies are automatically sent with requests, no need for manual headers
  }
}

// Generic fetch wrapper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
      // Add credentials to ensure cookies are sent
      credentials: 'include',
    })

    // Handle network errors (e.g., CORS, connection refused, etc.)
    if (!response) {
      throw new Error('Network error: Failed to fetch')
    }

    let data: any
    try {
      data = await response.json()
    } catch (jsonError) {
      // If response is not JSON, create an error object
      const text = await response.text()
      throw new Error(`API returned non-JSON response: ${text || response.statusText}`)
    }

    if (!response.ok) {
      const errorMessage = data?.error || data?.details || `API Error: ${response.statusText}`
      const error = new Error(errorMessage)
      // Attach additional error details for debugging
      Object.assign(error, { status: response.status, data })
      throw error
    }

    return data
  } catch (error) {
    // Handle fetch errors (network errors, CORS, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to the server. Please check your connection.')
    }
    // Re-throw other errors
    throw error
  }
}

// Authentication API
export const authApi = {
  login: async (email: string, password: string) => {
    return apiFetch<{ user: any; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },
  logout: async () => {
    // Call logout API to clear cookies
    await apiFetch<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    })
  },
  getCurrentUser: async () => {
    // Get current user from server (cookies are httpOnly, can't access from client)
    try {
      const response = await apiFetch<{ success: boolean; user: { email: string; role: string } }>('/auth/me')
      return response.user || null
    } catch {
      return null
    }
  },
  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    return apiFetch<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    })
  },
}

// Departments API
export const departmentsApi = {
  list: async () => {
    return apiFetch<{ success: boolean; departments: any[] }>('/departments')
  },
  create: async (deptData: {
    name: string
    code?: string
    description?: string
    parentId?: string
  }) => {
    return apiFetch<{ success: boolean; department: any }>('/departments', {
      method: 'POST',
      body: JSON.stringify(deptData),
    })
  },
  update: async (deptId: string, deptData: {
    name?: string
    code?: string
    description?: string
    parentId?: string
  }) => {
    return apiFetch<{ success: boolean; department: any }>(`/departments/${deptId}`, {
      method: 'PUT',
      body: JSON.stringify(deptData),
    })
  },
  delete: async (deptId: string) => {
    return apiFetch<{ success: boolean; message: string }>(`/departments/${deptId}`, {
      method: 'DELETE',
    })
  },
}

// Jobs API
export const jobsApi = {
  list: async () => {
    return apiFetch<{ success: boolean; jobs: any[] }>('/jobs')
  },
  create: async (jobData: {
    name: string
    code?: string
    description?: string
  }) => {
    return apiFetch<{ success: boolean; job: any }>('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    })
  },
  update: async (jobId: string, jobData: {
    name?: string
    code?: string
    description?: string
  }) => {
    return apiFetch<{ success: boolean; job: any }>(`/jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(jobData),
    })
  },
  delete: async (jobId: string) => {
    return apiFetch<{ success: boolean; message: string }>(`/jobs/${jobId}`, {
      method: 'DELETE',
    })
  },
}

// Employees API (replacing Users API)
export const employeesApi = {
  list: async () => {
    return apiFetch<{ success: boolean; employees: any[] }>('/employees')
  },
  create: async (employeeData: {
    email: string
    name: string
    password: string
    dateOfBirth?: string
    departmentId?: string
    jobId?: string
    role?: string
    yearsOfService?: string
    address?: string
  }) => {
    return apiFetch<{ success: boolean; employee: any; message: string }>('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    })
  },
  update: async (employeeId: string, employeeData: {
    name?: string
    email?: string
    dateOfBirth?: string
    departmentId?: string
    jobId?: string
    role?: string
    yearsOfService?: string
    address?: string
  }) => {
    return apiFetch<{ success: boolean; employee: any; message: string }>(`/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    })
  },
  delete: async (employeeId: string) => {
    return apiFetch<{ success: boolean; message: string }>(`/employees/${employeeId}`, {
      method: 'DELETE',
    })
  },
  updatePassword: async (employeeId: string, newPassword: string) => {
    return apiFetch<{ success: boolean; message: string }>(`/employees/${employeeId}/password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    })
  },
}

// Legacy Users API (kept for backward compatibility, now redirects to employees)
export const usersApi = {
  list: async () => {
    return employeesApi.list()
  },
  create: async (userData: any) => {
    return employeesApi.create(userData)
  },
  update: async (userData: any) => {
    return employeesApi.update(userData.id, userData)
  },
  delete: async (userId: string) => {
    return employeesApi.delete(userId)
  },
  updatePassword: async (userId: string, _newEmail?: string, newPassword?: string) => {
    if (newPassword) {
      return employeesApi.updatePassword(userId, newPassword)
    }
    throw new Error('Password is required')
  },
  getLoginLogs: async (queryParams?: string) => {
    const url = queryParams ? `/users/login-logs?${queryParams}` : '/users/login-logs'
    return apiFetch<{ success: boolean; logs: any[] }>(url)
  },
}

// Surveys API (to be implemented)
export const surveysApi = {
  list: async () => {
    return apiFetch<{ success: boolean; surveys: any[]; error?: string }>('/surveys')
  },
  get: async (surveyId: string) => {
    return apiFetch<{ success: boolean; survey?: any; error?: string }>(`/surveys/${surveyId}`)
  },
  create: async (surveyData: any) => {
    return apiFetch<{ success: boolean; survey?: any; error?: string }>('/surveys', {
      method: 'POST',
      body: JSON.stringify(surveyData),
    })
  },
  update: async (surveyId: string, surveyData: any) => {
    return apiFetch<{ success: boolean; survey?: any; error?: string }>(`/surveys/${surveyId}`, {
      method: 'PUT',
      body: JSON.stringify(surveyData),
    })
  },
  delete: async (surveyId: string) => {
    return apiFetch<{ success: boolean; message?: string; error?: string }>(`/surveys/${surveyId}`, {
      method: 'DELETE',
    })
  },
}


// Survey Period API
export const surveyPeriodApi = {
  // Public API (no authentication required) - Check if survey period is available
  checkAvailability: async (surveyType?: 'organizational' | 'growth') => {
    const params = surveyType ? `?type=${encodeURIComponent(surveyType)}` : ''
    return apiFetch<{ 
      success: boolean
      available: boolean
      message?: string
      surveyType?: string | null
      nextStartDate?: string | null
      survey?: {
        id: string
        name: string
        startDate: string
        endDate: string
        status: string
        surveyType?: string
      }
    }>(`/surveys/period${params}`)
  },
}

// "My" APIs (current user's stats)
export const myApi = {
  surveyParticipation: async () => {
    return apiFetch<{
      success: boolean
      organizational: {
        completed: number
        total: number
        lastCompletedAt: string | null
      }
      growth: {
        completed: number
        total: number
        lastCompletedAt: string | null
      }
    }>('/my/survey-participation')
  },
}

// Problems API
export const problemsApi = {
  list: async () => {
    return apiFetch<{ success: boolean; problems: any[]; error?: string }>('/problems')
  },
  // Public API (no authentication required)
  listPublic: async () => {
    return apiFetch<{ success: boolean; problems: any[]; error?: string }>('/problems/public')
  },
  get: async (problemId: string) => {
    return apiFetch<{ success: boolean; problem?: any; error?: string }>(`/problems/${problemId}`)
  },
  create: async (problemData: {
    questionText: string
    category: string
    categoryId?: number
    answer1Score?: number
    answer2Score?: number
    answer3Score?: number
    answer4Score?: number
    answer5Score?: number
    answer6Score?: number
  }) => {
    return apiFetch<{ success: boolean; problem?: any; error?: string }>('/problems', {
      method: 'POST',
      body: JSON.stringify(problemData),
    })
  },
  update: async (problemId: string, problemData: {
    questionText?: string
    category?: string
    categoryId?: number
    answer1Score?: number
    answer2Score?: number
    answer3Score?: number
    answer4Score?: number
    answer5Score?: number
    answer6Score?: number
    displayOrder?: number
  }) => {
    return apiFetch<{ success: boolean; problem?: any; error?: string }>(`/problems/${problemId}`, {
      method: 'PUT',
      body: JSON.stringify(problemData),
    })
  },
  delete: async (problemId: string) => {
    return apiFetch<{ success: boolean; message?: string; error?: string }>(`/problems/${problemId}`, {
      method: 'DELETE',
    })
  },
  updateOrder: async (questionIds: number[]) => {
    return apiFetch<{ success: boolean; message?: string; error?: string }>('/problems/order', {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    })
  },
}

// Growth survey question API
export const growthSurveyQuestionsApi = {
  list: async () => {
    return apiFetch<{ success: boolean; questions: any[]; error?: string }>('/growth-survey-questions')
  },
  create: async (payload: {
    questionText: string
    category?: string
    weight?: number | null
    targetJobs?: string[] | null
    answers?: Array<{ text: string; score: number }>
    focusArea?: string
    answerType?: string
  }) => {
    return apiFetch<{ success: boolean; question?: any; error?: string }>('/growth-survey-questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  update: async (questionId: string, payload: {
    questionText?: string
    category?: string
    weight?: number | null
    targetJobs?: string[] | null
    answers?: Array<{ text: string; score: number }>
    focusArea?: string
    answerType?: string
    isActive?: boolean
  }) => {
    return apiFetch<{ success: boolean; question?: any; error?: string }>(`/growth-survey-questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  delete: async (questionId: string) => {
    return apiFetch<{ success: boolean; message?: string; error?: string }>(`/growth-survey-questions/${questionId}`, {
      method: 'DELETE',
    })
  },
  updateOrder: async (questionIds: number[]) => {
    return apiFetch<{ success: boolean; message?: string; error?: string }>('/growth-survey-questions/order', {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    })
  },
}

export const growthSurveyApi = {
  list: async (activeOnly = false) => {
    const params = activeOnly ? '?activeOnly=true' : ''
    return apiFetch<{ success: boolean; questions: any[] }>(`/growth-survey-questions${params}`)
  },
}

export const growthSurveyResultsApi = {
  getFreeTextResponses: async (userId?: string) => {
    const params = new URLSearchParams()
    if (userId) params.append("userId", userId)
    const queryString = params.toString()
    return apiFetch<{
      success: boolean
      responses: Array<{
        userId: number
        surveyId: number
        surveyName: string
        questionId: number
        questionText: string
        answerText: string
      }>
      error?: string
    }>(`/growth-survey-results/free-text${queryString ? `?${queryString}` : ''}`)
  },
}

export const growthSurveyResponsesApi = {
  get: async () => {
    return apiFetch<{ success: boolean; response: GrowthSurveyResponse | null }>('/growth-survey-responses')
  },
  getQuestionResponses: async (surveyId: string) => {
    return apiFetch<{
      success: boolean
      surveyId: number
      questions: Array<{
        questionId: number
        questionText: string
        category: string | null
        options: Array<{
          label: string
          score: number | null
          count: number
        }>
        totalRespondents: number
      }>
      error?: string
    }>(`/growth-survey-question-responses?surveyId=${surveyId}`)
  },
  saveQuestion: async (
    questionId: number,
    payload: {
      answerValue?: string
      answerText?: string
    },
  ) => {
    return apiFetch<{
      success: boolean
      message: string
      progressCount: number
      totalQuestions: number
      completed: boolean
      completedAt?: string | null
      error?: string
    }>(`/growth-survey-responses/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  submit: async () => {
    return apiFetch<{ success: boolean; message: string }>('/growth-survey-responses', {
      method: 'POST',
    })
  },
}


// Reports API (to be implemented)
export const reportsApi = {
  getSummary: async (surveyId: string) => {
    return apiFetch<{ success: boolean; summary: any }>(`/reports/summary?surveyId=${surveyId}`)
  },
  getDepartmentStats: async (surveyId: string) => {
    return apiFetch<{ success: boolean; stats: any }>(`/reports/department-stats?surveyId=${surveyId}`)
  },
  exportCSV: async (surveyId: string) => {
    const response = await fetch(`${API_BASE_URL}/reports/export-csv?surveyId=${surveyId}`, {
      headers: getAuthHeaders(),
    })
    return response.blob()
  },
  exportPDF: async (surveyId: string) => {
    const response = await fetch(`${API_BASE_URL}/reports/export-pdf?surveyId=${surveyId}`, {
      headers: getAuthHeaders(),
    })
    return response.blob()
  },
}

// Organizational Survey Results API
export const organizationalSurveyResultsApi = {
  list: async (surveyId?: string) => {
    const params = surveyId ? `?surveyId=${surveyId}` : ''
    return apiFetch<{ success: boolean; results: any[] }>(`/organizational-survey-results${params}`)
  },
  get: async (surveyId: string) => {
    const params = surveyId ? `?surveyId=${surveyId}` : ''
    return apiFetch<{ success: boolean; results: any[] }>(`/organizational-survey-results${params}`)
  },
  getFreeTextResponses: async (surveyId: string, userId?: string) => {
    const params = new URLSearchParams({ surveyId })
    if (userId) params.append("userId", userId)
    return apiFetch<{
      success: boolean
      responses: Array<{
        userId: number
        surveyId: number
        surveyName: string
        questionId: number
        questionText: string
        answerText: string
      }>
      error?: string
    }>(`/organizational-survey-results/free-text?${params.toString()}`)
  },
  saveFreeTextAnswer: async (questionId: number, data: {
    surveyId: string
    answerText: string
  }) => {
    return apiFetch<{
      success: boolean
      message: string
      questionId: number
      error?: string
    }>(`/organizational-survey-results/${questionId}/free-text`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  saveQuestion: async (questionId: number, data: {
    surveyId: string
    categoryId: number
    score: number
  }) => {
    return apiFetch<{ success: boolean; message: string; questionId: number }>(`/organizational-survey-results/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  removeQuestion: async (questionId: number, surveyId: string) => {
    return apiFetch<{ success: boolean; message: string }>(`/organizational-survey-results/${questionId}?surveyId=${surveyId}`, {
      method: 'DELETE',
    })
  },
  submit: async (resultData: {
    surveyId: string
    response: Array<{
      questionId: number
      categoryId: number
      score: number
    }>
  }) => {
    return apiFetch<{ success: boolean; message: string; resultId: string }>('/organizational-survey-results', {
      method: 'POST',
      body: JSON.stringify(resultData),
    })
  },
}

// Organizational Survey Summary API
export const organizationalSurveySummaryApi = {
  getStatistics: async (surveyId: string | number) => {
    return apiFetch<{
      success: boolean
      overallAverageTotal: number
      overallAverageCategory1: number
      overallAverageCategory7: number
      managerAverageTotal: number
      managerAverageCategory1: number
      managerAverageCategory7: number
      overallCount: number
      managerCount: number
    }>(`/organizational-survey-summary/statistics?surveyId=${surveyId}`)
  },
  getDetailed: async (surveyId: string | number) => {
    return apiFetch<{ 
      success: boolean
      details: Array<{
        id: number
        userId: number
        surveyId: number
        userName: string
        email: string
        departmentName: string
        departmentCode: string | null
        jobName: string
        jobCode: string | null
        category1Score: number
        category2Score: number
        category3Score: number
        category4Score: number
        category5Score: number
        category6Score: number
        category7Score: number
        category8Score: number
        totalScore: number
        responseRate: number | null
        updatedAt: string
      }>
      surveyName?: string | null
      error?: string
    }>(`/organizational-survey-summary/detailed?surveyId=${encodeURIComponent(surveyId)}`)
  },
  getDepartmentCategory: async (surveyId: string | number) => {
    return apiFetch<{
      success: boolean
      departmentCategoryScores: Array<{
        departmentId: number
        departmentName: string
        departmentCode: string | null
        category1Avg: number
        category2Avg: number
        category3Avg: number
        category4Avg: number
        category5Avg: number
        category6Avg: number
        category7Avg: number
        category8Avg: number
        totalAvg: number
        participantCount: number
      }>
      surveyName?: string | null
      error?: string
    }>(`/organizational-survey-summary/department-category?surveyId=${encodeURIComponent(surveyId)}`)
  },
  getAllSurveysDetails: async () => {
    return apiFetch<{
      success: boolean
      surveys: Array<{
        surveyId: number
        surveyName: string
        startDate: string
        endDate: string
        status: string
        createdAt: string
        updatedAt: string
        totalParticipants: number
        overallAverageScore: number
        departments: Array<{
          departmentId: number
          departmentName: string
          departmentCode: string | null
          participantCount: number
          averageTotalScore: number
          averageCategory1: number
          averageCategory2: number
          averageCategory3: number
          averageCategory4: number
          averageCategory5: number
          averageCategory6: number
          averageCategory7: number
          averageCategory8: number
        }>
        participants: Array<{
          id: number
          userId: number
          userName: string
          email: string
          departmentId: number | null
          departmentName: string
          departmentCode: string | null
          jobName: string
          jobCode: string | null
          category1Score: number
          category2Score: number
          category3Score: number
          category4Score: number
          category5Score: number
          category6Score: number
          category7Score: number
          category8Score: number
          totalScore: number
          responseRate: number | null
          createdAt: string
          updatedAt: string
        }>
      }>
      error?: string
    }>(`/organizational-survey-summary/all-surveys-details`)
  },
  list: async (surveyId?: string, forOrganization: boolean = false) => {
    const params = new URLSearchParams()
    if (surveyId) params.append('surveyId', surveyId)
    if (forOrganization) params.append('forOrganization', 'true')
    const queryString = params.toString()
    const suffix = queryString ? `?${queryString}` : ''
    return apiFetch<{ success: boolean; summaries: any[] }>(`/organizational-survey-summary${suffix}`)
  },
  getDetailedResponses: async (surveyIds: string[], departmentIds: string[], jobIds: string[], categoryId: string) => {
    const params = new URLSearchParams()
    params.append('surveyIds', surveyIds.join(','))
    if (departmentIds.length > 0) {
      params.append('departmentIds', departmentIds.join(','))
    }
    if (jobIds.length > 0) {
      params.append('jobIds', jobIds.join(','))
    }
    params.append('categoryId', categoryId)
    return apiFetch<{
      success: boolean
      employees: Array<{
        employeeId: number
        employeeName: string
        employeeEmail: string
        departmentId: number | null
        departmentName: string | null
        departmentCode: string | null
        jobId: number | null
        jobName: string | null
        surveys: Array<{
          surveyId: number
          questions: Array<{
            questionId: number
            questionText: string
            score: number | null
            answerText: string | null
            answerIndex: number | null
          }>
        }>
      }>
      problems: Array<{
        id: number
        questionText: string
      }>
      error?: string
    }>(`/organizational-survey-detailed-responses?${params.toString()}`)
  },
}

export const growthSurveySummaryApi = {
  list: async (surveyId?: string, forOrganization: boolean = false) => {
    const params = new URLSearchParams()
    if (surveyId) params.append('surveyId', surveyId)
    if (forOrganization) params.append('forOrganization', 'true')
    const queryString = params.toString()
    const suffix = queryString ? `?${queryString}` : ''
    return apiFetch<{ success: boolean; summaries: any[] }>(`/growth-survey-summary${suffix}`)
  },
}

export const growthSurveyCategoryScoresApi = {
  get: async (surveyId?: number) => {
    const params = surveyId ? `?surveyId=${surveyId}` : ''
    return apiFetch<{ 
      success: boolean
      categories: {
        "ルール": number
        "組織体制": number
        "評価制度": number
        "週報・会議": number
        "識学サーベイ": number
      }
    }>(`/growth-survey-category-scores${params}`)
  },
}

// Notifications API
export const notificationsApi = {
  list: async (unreadOnly?: boolean) => {
    const params = unreadOnly ? '?unreadOnly=true' : ''
    return apiFetch<{ success: boolean; notifications: any[]; unreadCount: number }>(`/notifications${params}`)
  },
  markAsRead: async (notificationId: number) => {
    return apiFetch<{ success: boolean; message: string; notification: any }>(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    })
  },
  markAllAsRead: async () => {
    return apiFetch<{ success: boolean; message: string; markedAsRead: number }>('/notifications/read-all', {
      method: 'PUT',
    })
  },
}

export default {
  auth: authApi,
  departments: departmentsApi,
  jobs: jobsApi,
  employees: employeesApi,
  users: usersApi, // Legacy, redirects to employees
  problems: problemsApi,
  surveys: surveysApi,
  reports: reportsApi,
  surveyPeriodApi: surveyPeriodApi,
  my: myApi,
  organizationalSurveyResults: organizationalSurveyResultsApi,
  organizationalSurveySummary: organizationalSurveySummaryApi,
  growthSurveySummary: growthSurveySummaryApi,
  growthSurveyCategoryScores: growthSurveyCategoryScoresApi,
  growthSurveyQuestions: growthSurveyQuestionsApi,
  growthSurvey: growthSurveyApi,
  growthSurveyResponses: growthSurveyResponsesApi,
  growthSurveyResults: growthSurveyResultsApi,
  notifications: notificationsApi,
}

