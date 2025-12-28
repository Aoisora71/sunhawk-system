'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to error tracking service (e.g., Sentry)
    
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error tracking service
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } })
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle>エラーが発生しました</CardTitle>
              </div>
              <CardDescription>
                予期しないエラーが発生しました。ページをリロードするか、管理者にお問い合わせください。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono text-destructive">
                    {this.state.error.toString()}
                  </p>
                  {this.state.error.stack && (
                    <pre className="text-xs mt-2 overflow-auto">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline">
                  再試行
                </Button>
                <Button onClick={() => window.location.reload()}>
                  ページをリロード
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

