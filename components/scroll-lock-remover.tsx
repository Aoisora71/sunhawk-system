'use client'

import { useEffect } from 'react'

/**
 * Component that removes data-scroll-locked attribute from body element
 * This prevents Radix UI from locking body scroll when dialogs are open
 */
export function ScrollLockRemover() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || !document.body) {
      return
    }

    // Remove the attribute immediately if it exists
    const removeAttribute = () => {
      if (typeof document !== 'undefined' && document.body?.hasAttribute('data-scroll-locked')) {
        document.body.removeAttribute('data-scroll-locked')
      }
    }

    // Remove on mount
    removeAttribute()

    // Watch for attribute changes and remove it immediately
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-scroll-locked' &&
          mutation.target === document.body
        ) {
          removeAttribute()
        }
      })
    })

    // Start observing the body element for attribute changes
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-scroll-locked'],
      })
    }

    // Also check periodically as a fallback
    const interval = setInterval(removeAttribute, 100)

    // Cleanup
    return () => {
      observer.disconnect()
      clearInterval(interval)
      removeAttribute()
    }
  }, [])

  return null
}

