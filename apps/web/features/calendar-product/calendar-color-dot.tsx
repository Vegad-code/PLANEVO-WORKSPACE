import type {
  CalendarColorValue,
  CalendarPaletteKey,
} from "@planevo/core/types/calendar"
import { Check } from "lucide-react"
import {
  calendarEventSurface,
  contrastTextForCalendarColor,
  isCustomCalendarColor,
} from "@/lib/calendar/calendar-color"

const DOT_CLASSES: Record<CalendarPaletteKey, string> = {
  lavender: "bg-calendar-lavender",
  sage: "bg-calendar-sage",
  grape: "bg-calendar-grape",
  flamingo: "bg-calendar-flamingo",
  banana: "bg-calendar-banana",
  tangerine: "bg-calendar-tangerine",
  peacock: "bg-calendar-peacock",
  graphite: "bg-calendar-graphite",
  blueberry: "bg-calendar-blueberry",
  basil: "bg-calendar-basil",
  tomato: "bg-calendar-tomato",
  rose: "bg-calendar-rose",
  sky: "bg-calendar-sky",
  teal: "bg-calendar-teal",
  amber: "bg-calendar-amber",
  plum: "bg-calendar-plum",
}

export const CALENDAR_COLOR_DOT_CLASS: Record<string, string> = DOT_CLASSES
export const CALENDAR_COLOR_BLOCK_CLASS: Record<string, string> =
  Object.fromEntries(
    Object.keys(DOT_CLASSES).map((key) => [
      key,
      `calendar-event-block--${key}`,
    ]),
  )
export const CALENDAR_EVENT_BLOCK_CLASS = CALENDAR_COLOR_BLOCK_CLASS
export const CALENDAR_COLOR_BORDER_CLASS: Record<string, string> =
  Object.fromEntries(
    Object.keys(DOT_CLASSES).map((key) => [
      key,
      `border-calendar-${key}`,
    ]),
  )

export function calendarColorStyle(
  color: CalendarColorValue,
): React.CSSProperties {
  const surface = calendarEventSurface(color)
  return {
    "--calendar-event-color": surface.accent,
    "--calendar-event-text": `var(--color-${surface.text})`,
  } as React.CSSProperties
}

export function CalendarColorDot({
  color,
  size = "compact",
  selected = false,
}: {
  color: CalendarColorValue
  size?: "compact" | "picker"
  selected?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      style={
        isCustomCalendarColor(color)
          ? { backgroundColor: color }
          : undefined
      }
      className={`${size === "picker" ? "size-5" : "size-2.5"} flex shrink-0 items-center justify-center rounded-full ${
        isCustomCalendarColor(color)
          ? ""
          : CALENDAR_COLOR_DOT_CLASS[color]
      }`}
    >
      {selected ? (
        <Check
          className={`size-3 ${
            contrastTextForCalendarColor(color) === "paper"
              ? "text-paper"
              : "text-ink"
          }`}
          strokeWidth={3}
        />
      ) : null}
    </span>
  )
}
