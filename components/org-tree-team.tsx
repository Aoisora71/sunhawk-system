"use client"

import { OrgTreeNode } from "@/components/org-tree-node"
import type { Team } from "@/lib/organization-data"

interface OrgTreeTeamProps {
  team: Team
  level: number
  isLast?: boolean
}

export function OrgTreeTeam({ team, level, isLast = true }: OrgTreeTeamProps) {
  const hasMembers = team.members.length > 0

  return (
    <OrgTreeNode employee={team.manager} level={level} isLast={isLast} hasChildren={hasMembers}>
      {hasMembers && (
        <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
          {team.members.map((member, index) => (
            <OrgTreeNode
              key={member.id}
              employee={member}
              level={level + 1}
              isLast={index === team.members.length - 1}
              hasChildren={false}
            />
          ))}
        </div>
      )}
    </OrgTreeNode>
  )
}
