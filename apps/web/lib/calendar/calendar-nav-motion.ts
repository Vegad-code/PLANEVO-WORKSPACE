import type { Transition, Variants } from "framer-motion"
import { dateParam } from "./calendar-range.ts"
import type { CalendarToolbarView } from "./calendar-navigation.ts"

export type CalendarNavIntent = "step" | "view" | "jump"

export type CalendarNavMotion = {
  intent: CalendarNavIntent
  direction: -1 | 0 | 1
}

export const calendarNavIdleMotion: CalendarNavMotion = {
  intent: "jump",
  direction: 0,
}

/** Horizontal slide distance for prev/next navigation (px). */
const CALENDAR_SLIDE_OFFSET = 28

const CALENDAR_NAV_EASE = [0.22, 1, 0.36, 1] as const

export function calendarTransitionKey(
  view: CalendarToolbarView,
  anchor: Date,
): string {
  if (view === "year") {
    return `year-${anchor.getFullYear()}`
  }
  if (view === "month") {
    const year = anchor.getFullYear()
    const month = String(anchor.getMonth() + 1).padStart(2, "0")
    return `month-${year}-${month}`
  }
  return `${view}-${dateParam(anchor)}`
}

export function calendarNavTransition(
  prefersReducedMotion: boolean,
): Transition {
  if (prefersReducedMotion) {
    return { duration: 0 }
  }
  return {
    duration: 0.42,
    ease: CALENDAR_NAV_EASE,
  }
}

export function calendarTitleTransition(
  prefersReducedMotion: boolean,
): Transition {
  if (prefersReducedMotion) {
    return { duration: 0 }
  }
  return {
    duration: 0.34,
    ease: CALENDAR_NAV_EASE,
  }
}

export function calendarViewMotionVariants(
  intent: CalendarNavIntent,
): Variants {
  if (intent === "view" || intent === "jump") {
    return {
      enter: { opacity: 0, scale: 0.992, y: 6 },
      center: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.992, y: -6 },
    }
  }

  return {
    enter: (direction: number) => ({
      x:
        direction > 0
          ? CALENDAR_SLIDE_OFFSET
          : direction < 0
            ? -CALENDAR_SLIDE_OFFSET
            : 0,
      opacity: 0.35,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
      x:
        direction > 0
          ? -CALENDAR_SLIDE_OFFSET
          : direction < 0
            ? CALENDAR_SLIDE_OFFSET
            : 0,
      opacity: 0.35,
    }),
  }
}
