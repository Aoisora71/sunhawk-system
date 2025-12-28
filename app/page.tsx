import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, Users, FileText, Shield } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2">
                <Image 
                  src="/logo.png" 
                  alt="サンホーク ロゴ" 
                  width={32} 
                  height={32} 
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded" 
                  priority 
                />
                <span className="text-base sm:text-lg font-medium text-foreground">サンホーク</span>
              </Link>
            </div>
            <nav className="flex items-center gap-3 sm:gap-6">
              <Link 
                href="/login" 
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ログイン
              </Link>
              <Button size="sm" className="text-xs sm:text-sm" asChild>
                <Link href="/login">始める</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 lg:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium text-foreground leading-tight sm:leading-tight md:leading-tight text-balance mb-6 sm:mb-8">
            組織の状態を可視化し、
            <br className="hidden sm:block" />
            継続的なグロースを実現
          </h1>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <Button size="lg" className="w-full sm:w-auto text-sm sm:text-base" asChild>
              <Link href="/login">
                システムを始める
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-muted/30 py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium text-foreground mb-8 sm:mb-12 text-center">
            主な機能
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border hover:shadow-md transition-shadow">
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">
                ソシキサーベイ
              </h3>
          
            </div>

            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border hover:shadow-md transition-shadow">
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">
                データ可視化
              </h3>
              
            </div>

            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border hover:shadow-md transition-shadow">
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">
                組織図管理
              </h3>
           
            </div>

            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border hover:shadow-md transition-shadow">
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">
                セキュリティ
              </h3>
           
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
            <div className="flex items-center gap-2">
              <Image 
                src="/logo.png" 
                alt="サンホーク ロゴ" 
                width={24} 
                height={24} 
                className="h-5 w-5 sm:h-6 sm:w-6 rounded" 
              />
              <span className="text-xs sm:text-sm text-muted-foreground">株式会社サンホーク</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-right">
              © 2025 組織状態可視化システム
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
