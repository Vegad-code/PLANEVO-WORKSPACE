import { Icon } from "@/components/ui/planevo-icon"

type TaskFileBadgeProps = {
  count: number
}

export function TaskFileBadge({ count }: TaskFileBadgeProps) {
  if (count <= 0) return null

  return (
    <span className="inline-flex items-center gap-1 text-product-stat tabular-nums text-text-secondary">
      <Icon name="document" className="size-3.5 text-text-muted" />
      {count}
      <span className="sr-only"> attached files</span>
    </span>
  )
}
