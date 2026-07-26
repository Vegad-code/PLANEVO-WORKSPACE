"use client"

import { useEffect, useRef } from "react"
import { useHotkeys, useHotkeysContext } from "react-hotkeys-hook"
import { openSpotlight } from "@/features/command-bar/spotlight-bridge"
import { saveSpotlightScope } from "@/features/command-bar/spotlight-scope"
import {
  CALENDAR_HOTKEY_SCOPE,
  createEventSlotFromNow,
  resolveCalendarShortcut,
  type CalendarShortcutAction,
} from "@/lib/calendar/calendar-shortcut-map"
import type { CalendarView } from "./calendar-toolbar"

type UseCalendarHotkeysOptions = {
  now: Date
  cheatSheetOpen: boolean
  enabled?: boolean
  onCheatSheetOpenChange: (open: boolean) => void
  onViewChange: (view: CalendarView) => void
  onNavigateToday: (now?: Date) => void
  onCreateEvent: (range: { startsAt: Date; endsAt: Date }) => void
  onDismiss: () => boolean
}

type HotkeyHandlers = Omit<UseCalendarHotkeysOptions, "now" | "cheatSheetOpen"> & {
  now: Date
  cheatSheetOpen: boolean
}

function dispatchShortcutAction(
  action: CalendarShortcutAction,
  handlers: HotkeyHandlers,
): boolean {
  if (handlers.cheatSheetOpen) {
    if (action.type === "dismiss" || action.type === "open-cheat-sheet") {
      handlers.onCheatSheetOpenChange(false)
      return true
    }
    return false
  }

  switch (action.type) {
    case "open-cheat-sheet":
      handlers.onCheatSheetOpenChange(true)
      return true
    case "create-event": {
      const startsAt = createEventSlotFromNow(handlers.now)
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)
      handlers.onCreateEvent({ startsAt, endsAt })
      return true
    }
    case "go-today":
      handlers.onNavigateToday(handlers.now)
      return true
    case "switch-view":
      handlers.onViewChange(action.view)
      return true
    case "focus-search":
      saveSpotlightScope("calendar")
      openSpotlight()
      return true
    case "dismiss":
      return handlers.onDismiss()
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

const HOTKEY_OPTIONS = {
  scopes: [CALENDAR_HOTKEY_SCOPE],
  enableOnFormTags: false,
  enableOnContentEditable: false,
  preventDefault: true,
} as const

export function useCalendarHotkeys(options: UseCalendarHotkeysOptions) {
  const { enableScope, disableScope } = useHotkeysContext()
  const handlersRef = useRef(options)
  handlersRef.current = options
  const hotkeysEnabled = options.enabled !== false

  useEffect(() => {
    if (!hotkeysEnabled) {
      disableScope(CALENDAR_HOTKEY_SCOPE)
      return () => {
        enableScope(CALENDAR_HOTKEY_SCOPE)
      }
    }
    enableScope(CALENDAR_HOTKEY_SCOPE)
    return () => {
      disableScope(CALENDAR_HOTKEY_SCOPE)
    }
  }, [disableScope, enableScope, hotkeysEnabled])

  const run = (key: string, event: KeyboardEvent) => {
    if (!hotkeysEnabled) return
    const action = resolveCalendarShortcut(key)
    if (!action) return
    const handled = dispatchShortcutAction(action, handlersRef.current)
    if (handled) event.preventDefault()
  }

  useHotkeys("shift+/,?", (event) => run("?", event), {
    ...HOTKEY_OPTIONS,
    enabled: hotkeysEnabled,
  })
  useHotkeys("c", (event) => run("c", event), {
    ...HOTKEY_OPTIONS,
    enabled: hotkeysEnabled,
  })
  useHotkeys("t", (event) => run("t", event), {
    ...HOTKEY_OPTIONS,
    enabled: hotkeysEnabled,
  })
  useHotkeys("d", (event) => run("d", event), {
    ...HOTKEY_OPTIONS,
    enabled: hotkeysEnabled,
  })
  useHotkeys("w", (event) => run("w", event), {
    ...HOTKEY_OPTIONS,
    enabled: hotkeysEnabled,
  })
  useHotkeys("m", (event) => run("m", event), {
    ...HOTKEY_OPTIONS,
    enabled: hotkeysEnabled,
  })
  useHotkeys("/", (event) => run("/", event), {
    ...HOTKEY_OPTIONS,
    enabled: hotkeysEnabled,
  })

  useHotkeys(
    "escape",
    (event) => run("Escape", event),
    {
      ...HOTKEY_OPTIONS,
      preventDefault: false,
      enabled: hotkeysEnabled,
    },
  )
}
