import type {
  CalendarColorValue,
  CalendarPaletteKey,
} from "@planevo/core/types/calendar"

export const CALENDAR_PALETTE = [
  { key: "lavender", label: "Lavender" },
  { key: "sage", label: "Sage" },
  { key: "grape", label: "Grape" },
  { key: "flamingo", label: "Flamingo" },
  { key: "banana", label: "Banana" },
  { key: "tangerine", label: "Tangerine" },
  { key: "peacock", label: "Peacock" },
  { key: "graphite", label: "Graphite" },
  { key: "blueberry", label: "Blueberry" },
  { key: "basil", label: "Basil" },
  { key: "tomato", label: "Tomato" },
  { key: "rose", label: "Rose" },
  { key: "sky", label: "Sky" },
  { key: "teal", label: "Teal" },
  { key: "amber", label: "Amber" },
  { key: "plum", label: "Plum" },
] as const satisfies ReadonlyArray<{
  key: CalendarPaletteKey
  label: string
}>

const PALETTE_KEYS = new Set<string>(
  CALENDAR_PALETTE.map(({ key }) => key),
)
const LIGHT_PALETTE_KEYS = new Set<CalendarPaletteKey>([
  "flamingo",
  "banana",
  "amber",
])
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/

export function normalizeCalendarColor(
  value: string,
): CalendarColorValue | null {
  const normalized = value.trim()
  if (PALETTE_KEYS.has(normalized)) {
    return normalized as CalendarPaletteKey
  }
  const hex = normalized.toUpperCase()
  return HEX_COLOR_PATTERN.test(hex)
    ? (hex as `#${string}`)
    : null
}

export function isCustomCalendarColor(
  value: CalendarColorValue,
): value is `#${string}` {
  return value.startsWith("#")
}

export function contrastTextForCalendarColor(
  color: CalendarColorValue,
): "ink" | "paper" {
  if (!isCustomCalendarColor(color)) {
    return LIGHT_PALETTE_KEYS.has(color) ? "ink" : "paper"
  }

  const normalized = normalizeCalendarColor(color)
  if (!normalized || !isCustomCalendarColor(normalized)) return "ink"

  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000
  return luminance >= 150 ? "ink" : "paper"
}
