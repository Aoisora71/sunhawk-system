"use client"

import type React from "react"
import { memo } from "react"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmployeeCard } from "@/components/employee-card"
import type { Employee } from "@/lib/organization-data"
import { cn } from "@/lib/utils"

interface OrgTreeNodeProps {
  employee: Employee
  children?: React.ReactNode
  level: number
  isLast?: boolean
  hasChildren?: boolean
}

function OrgTreeNodeComponent({ employee, children, level, isLast = true, hasChildren = false }: OrgTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2)

  const getPaddingLeft = () => {
    if (level === 0) return "0"
    if (level === 1) return "0.75rem"
    if (level === 2) return "1.5rem"
    return "2.25rem"
  }

  const getLineHeight = () => {
    if (level === 0) return "h-10 sm:h-12 md:h-14"
    if (level === 1) return "h-10 sm:h-12 md:h-14"
    return "h-8 sm:h-10 md:h-12"
  }

  return (
    <div className="relative">
      {/* Vertical line from parent - mobile optimized */}
      {level > 0 && (
        <div
          className={cn("absolute top-0 w-px bg-border/50 transition-colors", isLast ? getLineHeight() : "h-full")}
          style={{ left: `calc(${getPaddingLeft()} - 0.375rem)` }}
        />
      )}

      {/* Horizontal line to node - mobile optimized */}
      {level > 0 && (
        <div
          className="absolute h-px bg-border/50 transition-colors"
          style={{
            top: "1.25rem",
            left: `calc(${getPaddingLeft()} - 0.375rem)`,
            width: "0.375rem",
          }}
        />
      )}

      {/* Node container */}
      <div style={{ paddingLeft: getPaddingLeft() }} className="relative">
        <div className="flex items-start gap-1 sm:gap-1.5">
          {/* Expand/collapse button - touch-friendly on mobile */}
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0 shrink-0 mt-0.5 hover:bg-accent/50 active:bg-accent transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
              ) : (
                <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
              )}
            </Button>
          )}
          {!hasChildren && level > 0 && <div className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 shrink-0" />}

          {/* Employee card - improved sizing for better readability */}
          <div className="flex-1 min-w-0 max-w-full">
            <EmployeeCard
              employee={employee}
              size={level === 0 ? "lg" : level === 1 ? "md" : "sm"}
            />
          </div>
        </div>

        {/* Children with smooth animation */}
        {isExpanded && children && (
          <div className="mt-2 sm:mt-3 md:mt-4 relative animate-in fade-in duration-200">{children}</div>
        )}
      </div>
    </div>
  )
}

// Memoize to prevent unnecessary re-renders
export const OrgTreeNode = memo(OrgTreeNodeComponent, (prevProps, nextProps) => {
  // Only re-render if employee data, level, or expansion state changes
  return (
    prevProps.employee.id === nextProps.employee.id &&
    prevProps.level === nextProps.level &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.hasChildren === nextProps.hasChildren &&
    prevProps.children === nextProps.children
  )
})
