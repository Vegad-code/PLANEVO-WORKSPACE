type TaskSubtaskProgressProps = {
  done: number
  total: number
}

export function TaskSubtaskProgress({ done, total }: TaskSubtaskProgressProps) {
  if (total <= 0) return null

  const ratio = Math.min(1, Math.max(0, done / total))

  return (
    <span className="inline-flex items-center gap-2 text-product-stat tabular-nums text-text-secondary">
      <span
        aria-hidden="true"
        className="relative h-1.5 w-10 overflow-hidden rounded-full bg-sidebar"
      >
        <span
          className="absolute inset-y-0 left-0 origin-left rounded-full bg-meadow"
          style={{ transform: `scaleX(${ratio})`, width: "100%" }}
        />
      </span>
      <span>
        {done}/{total}
        <span className="sr-only"> subtasks complete</span>
      </span>
    </span>
  )
}
