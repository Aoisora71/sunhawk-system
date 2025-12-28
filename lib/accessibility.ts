/**
 * Accessibility Utilities
 * Provides helper functions for ARIA labels and keyboard navigation
 */

/**
 * Generate ARIA label for interactive elements
 */
export function getAriaLabel(
  action: string,
  context?: string,
  item?: string
): string {
  if (item && context) {
    return `${action} ${item} in ${context}`
  }
  if (item) {
    return `${action} ${item}`
  }
  if (context) {
    return `${action} ${context}`
  }
  return action
}

/**
 * Keyboard navigation helpers
 */
export const keyboard = {
  /**
   * Check if Enter or Space key was pressed
   */
  isActivationKey(event: React.KeyboardEvent): boolean {
    return event.key === 'Enter' || event.key === ' '
  },

  /**
   * Check if Escape key was pressed
   */
  isEscapeKey(event: React.KeyboardEvent): boolean {
    return event.key === 'Escape'
  },

  /**
   * Check if arrow key was pressed
   */
  isArrowKey(event: React.KeyboardEvent): boolean {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
  },

  /**
   * Handle keyboard navigation for lists
   */
  handleListNavigation(
    event: React.KeyboardEvent,
    currentIndex: number,
    totalItems: number,
    onNavigate: (index: number) => void
  ): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (currentIndex < totalItems - 1) {
          onNavigate(currentIndex + 1)
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (currentIndex > 0) {
          onNavigate(currentIndex - 1)
        }
        break
      case 'Home':
        event.preventDefault()
        onNavigate(0)
        break
      case 'End':
        event.preventDefault()
        onNavigate(totalItems - 1)
        break
    }
  },
}

/**
 * Focus management helpers
 */
export const focus = {
  /**
   * Trap focus within an element
   */
  trapFocus(element: HTMLElement): () => void {
    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    element.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => {
      element.removeEventListener('keydown', handleTab)
    }
  },

  /**
   * Restore focus to previous element
   */
  restoreFocus(previousElement: HTMLElement | null): void {
    if (previousElement && typeof previousElement.focus === 'function') {
      previousElement.focus()
    }
  },
}

/**
 * Screen reader announcements
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message

  document.body.appendChild(announcement)

  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

