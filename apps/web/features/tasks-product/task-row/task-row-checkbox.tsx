"use client"

type TaskRowCheckboxProps = {
  title: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}

export function TaskRowCheckbox({
  title,
  checked,
  disabled = false,
  onToggle,
}: TaskRowCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Mark incomplete: ${title}` : `Complete task: ${title}`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 motion-reduce:transition-none ${
        checked
          ? "border-meadow bg-meadow text-paper"
          : "border-border-strong bg-paper hover:border-ink"
      }`}
    >
      {checked ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="size-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
        </svg>
      ) : null}
    </button>
  )
}
