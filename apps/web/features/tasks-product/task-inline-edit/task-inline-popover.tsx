"use client"

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react"

type TaskInlinePopoverProps = {
  label: string
  trigger: ReactNode
  children: (close: () => void) => ReactNode
  align?: "start" | "end"
}

export function TaskInlinePopover({
  label,
  trigger,
  children,
  align = "end",
}: TaskInlinePopoverProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  function close(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const first = panelRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    )
    first?.focus()
  }, [open])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((wasOpen) => !wasOpen)
        }}
        className="rounded-lg outline-none transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
      >
        {trigger}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={(event) => {
              event.stopPropagation()
              close(true)
            }}
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return
              event.preventDefault()
              event.stopPropagation()
              close(true)
            }}
            className={`absolute top-full z-20 mt-1.5 min-w-44 rounded-lg border border-border bg-paper p-1 shadow-none ${
              align === "end" ? "right-0" : "left-0"
            }`}
          >
            {children(() => close(true))}
          </div>
        </>
      ) : null}
    </div>
  )
}
