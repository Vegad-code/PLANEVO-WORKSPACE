/**
 * Pure P0 calendar shortcut routing (Phase A).
 * Month-grid arrows / Enter stay in month-grid.tsx — not listed here.
 */

export const CALENDAR_HOTKEY_SCOPE = "calendar-global" as const

export type CalendarShortcutView = "day" | "week" | "month"

export type CalendarShortcutAction =
  | { type: "open-cheat-sheet" }
  | { type: "create-event" }
  | { type: "go-today" }
  | { type: "switch-view"; view: CalendarShortcutView }
  | { type: "focus-search" }
  | { type: "dismiss" }

export type CalendarShortcutEntry = {
  key: string
  mac: string
  win: string
  label: string
  action: CalendarShortcutAction
}

export const CALENDAR_P0_SHORTCUTS: readonly CalendarShortcutEntry[] = [
  {
    key: "?",
    mac: "?",
    win: "?",
    label: "Show keyboard shortcuts",
    action: { type: "open-cheat-sheet" },
  },
  {
    key: "c",
    mac: "C",
    win: "C",
    label: "Create event",
    action: { type: "create-event" },
  },
  {
    key: "t",
    mac: "T",
    win: "T",
    label: "Go to today",
    action: { type: "go-today" },
  },
  {
    key: "d",
    mac: "D",
    win: "D",
    label: "Day view",
    action: { type: "switch-view", view: "day" },
  },
  {
    key: "w",
    mac: "W",
    win: "W",
    label: "Week view",
    action: { type: "switch-view", view: "week" },
  },
  {
    key: "m",
    mac: "M",
    win: "M",
    label: "Month view",
    action: { type: "switch-view", view: "month" },
  },
  {
    key: "/",
    mac: "/",
    win: "/",
    label: "Search calendar",
    action: { type: "focus-search" },
  },
  {
    key: "escape",
    mac: "Esc",
    win: "Esc",
    label: "Close event editor, agenda, or help",
    action: { type: "dismiss" },
  },
] as const

const ACTION_BY_KEY = new Map<string, CalendarShortcutAction>(
  CALENDAR_P0_SHORTCUTS.map((entry) => [entry.key.toLowerCase(), entry.action]),
)

function normalizeShortcutKey(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return ""
  if (trimmed === "Esc" || trimmed === "Escape") return "escape"
  if (trimmed === "?") return "?"
  if (trimmed === "/") return "/"
  return trimmed.toLowerCase()
}

export function resolveCalendarShortcut(
  key: string,
): CalendarShortcutAction | null {
  const normalized = normalizeShortcutKey(key)
  if (!normalized) return null
  return ACTION_BY_KEY.get(normalized) ?? null
}

export function createEventSlotFromNow(now: Date = new Date()): Date {
  const slot = new Date(now)
  slot.setSeconds(0, 0)
  const minutes = slot.getMinutes()
  const rounded = Math.ceil(minutes / 30) * 30
  if (rounded >= 60) {
    slot.setHours(slot.getHours() + 1, 0, 0, 0)
    return slot
  }
  slot.setMinutes(rounded, 0, 0)
  return slot
}
