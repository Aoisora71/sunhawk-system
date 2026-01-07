'use client'

// Toast helper functions for easy usage throughout the app
// Import the toast function directly from the hook file
import { toast as showToast } from '@/hooks/use-toast'

export const toast = {
  success: (message: string, title?: string) => {
    showToast({
      variant: 'default',
      title: title || '成功',
      description: message,
    })
  },
  
  error: (message: string, title?: string) => {
    showToast({
      variant: 'destructive',
      title: title || 'エラー',
      description: message,
    })
  },
  
  info: (message: string, title?: string) => {
    showToast({
      variant: 'default',
      title: title || '情報',
      description: message,
    })
  },
  
  warning: (message: string, title?: string) => {
    showToast({
      variant: 'default',
      title: title || '警告',
      description: message,
    })
  },
}
