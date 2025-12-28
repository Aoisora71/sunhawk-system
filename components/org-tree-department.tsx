"use client"

import { OrgTreeNode } from "@/components/org-tree-node"
import { OrgTreeTeam } from "@/components/org-tree-team"
import type { Department } from "@/lib/organization-data"

interface OrgTreeDepartmentProps {
  department: Department
  isLast?: boolean
}

export function OrgTreeDepartment({ department, isLast = true }: OrgTreeDepartmentProps) {
  const hasTeams = department.teams.length > 0

  return (
    <OrgTreeNode employee={department.manager} level={1} isLast={isLast} hasChildren={hasTeams}>
      {hasTeams && (
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          {department.teams.map((team, index) => (
            <OrgTreeTeam key={team.id} team={team} level={2} isLast={index === department.teams.length - 1} />
          ))}
        </div>
      )}
    </OrgTreeNode>
  )
}
