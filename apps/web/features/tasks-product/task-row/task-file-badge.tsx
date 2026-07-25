import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/planevo-icon"

type TaskFileBadgeProps = {
  count: number
}

export function TaskFileBadge({ count }: TaskFileBadgeProps) {
  if (count <= 0) return null

  return (
    <Badge variant="outline" className="tabular-nums text-text-secondary">
      <Icon name="document" className="text-text-muted" />
      {count}
      <span className="sr-only"> attached files</span>
    </Badge>
  )
}
