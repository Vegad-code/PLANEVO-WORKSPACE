"use client"

import { useEffect } from "react"
import {
  deliverBrowserReminder,
  type DueBrowserReminder,
} from "@/lib/calendar/browser-reminder"

const DELIVERED_REMINDERS_KEY = "planevo:delivered-browser-reminders:v1"
const REMINDER_POLL_MS = 30_000
const MAX_DELIVERED_KEYS = 200

function deliveredReminderKeys(): string[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(DELIVERED_REMINDERS_KEY) ?? "[]",
    )
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : []
  } catch {
    return []
  }
}

async function deliverDueReminders(): Promise<void> {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return
  }
  const response = await fetch("/api/calendar-reminders/due", {
    cache: "no-store",
  })
  if (!response.ok) return
  const payload = (await response.json()) as {
    reminders?: DueBrowserReminder[]
  }
  const delivered = deliveredReminderKeys()
  const deliveredSet = new Set(delivered)
  for (const reminder of payload.reminders ?? []) {
    if (deliveredSet.has(reminder.notificationKey)) continue
    const deliveredNow = deliverBrowserReminder(reminder, {
      notify: (title, options) => {
        new Notification(title, options)
      },
      remember: (notificationKey) => {
        delivered.push(notificationKey)
        deliveredSet.add(notificationKey)
        window.localStorage.setItem(
          DELIVERED_REMINDERS_KEY,
          JSON.stringify(delivered.slice(-MAX_DELIVERED_KEYS)),
        )
      },
    })
    if (!deliveredNow) {
      console.error(
        `[calendar-reminders:${reminder.notificationKey}] delivery failed`,
      )
    }
  }
}

async function pollWithCrossTabLock(): Promise<void> {
  if ("locks" in navigator) {
    await navigator.locks.request(
      "planevo-browser-reminder-delivery",
      { ifAvailable: true },
      async (lock) => {
        if (lock) await deliverDueReminders()
      },
    )
    return
  }
  await deliverDueReminders()
}

/** Delivers deduplicated browser reminders while any Planevo tab is open. */
export function CalendarReminderProvider() {
  useEffect(() => {
    const poll = () => {
      void pollWithCrossTabLock().catch((cause) => {
        console.error("[calendar-reminders]", cause)
      })
    }
    poll()
    const interval = window.setInterval(poll, REMINDER_POLL_MS)
    return () => window.clearInterval(interval)
  }, [])

  return null
}
