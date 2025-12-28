import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/toaster"
import { ErrorBoundary } from "@/components/error-boundary"
import { initializeApp } from "@/lib/init"
import "./globals.css"

// Initialize app on server startup
if (typeof window === 'undefined') {
  initializeApp()
}

export const metadata: Metadata = {
  title: "組織状態可視化システム | サンホーク",
  description: "ソシキサーベイを通じて組織の状態を可視化・分析するシステム",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: ["/favicon.png"],
    apple: [{ url: "/logo.png" }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function removeAttribute() {
                  if (document.body && document.body.hasAttribute('data-scroll-locked')) {
                    document.body.removeAttribute('data-scroll-locked');
                  }
                }
                
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', function() {
                    removeAttribute();
                    startObserver();
                  });
                } else {
                  removeAttribute();
                  startObserver();
                }
                
                function startObserver() {
                  const observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                      if (
                        mutation.type === 'attributes' &&
                        mutation.attributeName === 'data-scroll-locked' &&
                        mutation.target === document.body
                      ) {
                        removeAttribute();
                      }
                    });
                  });
                  
                  if (document.body) {
                    observer.observe(document.body, {
                      attributes: true,
                      attributeFilter: ['data-scroll-locked']
                    });
                  }
                  
                  setInterval(removeAttribute, 100);
                }
              })();
            `,
          }}
        />
        <ErrorBoundary>
          <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
          <Toaster />
          <Analytics />
        </ErrorBoundary>
      </body>
    </html>
  )
}
