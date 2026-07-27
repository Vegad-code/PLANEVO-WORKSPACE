import { z } from "zod"

/**
 * Calendar view config for the Classic Day/Week/Month surface.
 *
 * Layout axes remain so saved-view rows and embeds can still parse stored
 * JSON without blanking the calendar. Product Calendar itself uses Classic
 * only — Planner/Flow presets were removed.
 */

export const VIEW_LAYOUTS = [
  "grid-columns",
  "single-timeline",
  "month-cells",
  "kanban-columns",
  "list-agenda",
] as const

export const viewConfigSchema = z.object({
  layout: z.enum(VIEW_LAYOUTS),
  timeAxis: z.object({
    mode: z.enum([
      "fixed-24h",
      "cropped-working-hours",
      "auto-scale-to-content",
      "none",
    ]),
    rowHeight: z.enum(["fixed", "proportional-to-duration"]),
  }),
  /** Day columns to render. "month"/"year" are period views, not day counts. */
  dayCount: z.union([
    z.number().int().min(1).max(14),
    z.enum(["month", "year"]),
  ]),
  sidebarMode: z.enum([
    "none",
    "calendar-list",
    "task-backlog",
    "inbox-capture",
    "command-palette",
  ]),
  groupingKey: z.enum([
    "time",
    "day",
    "priority",
    "project",
    "calendar-source",
  ]),
  colorSource: z.enum(["calendar", "project", "priority", "category", "none"]),
  cardDensity: z.enum(["minimal", "standard", "rich"]),
  interactionSet: z.array(
    z.enum([
      "drag-from-backlog",
      "auto-schedule",
      "natural-language-create",
      "command-bar",
      "click-empty-to-create",
      "swipe-nav",
      "plan-wizard",
    ]),
  ),
})

export type ViewConfig = z.infer<typeof viewConfigSchema>
export type ViewLayout = ViewConfig["layout"]

/** Product Calendar is Classic only. `custom` remains for embed overrides. */
export const VIEW_PRESETS = ["classic", "custom"] as const
export type ViewPreset = (typeof VIEW_PRESETS)[number]

/** Google/Apple-style time grid — the only product calendar paradigm. */
const CLASSIC: ViewConfig = {
  layout: "grid-columns",
  timeAxis: { mode: "fixed-24h", rowHeight: "fixed" },
  dayCount: 7,
  sidebarMode: "calendar-list",
  groupingKey: "time",
  colorSource: "calendar",
  cardDensity: "standard",
  interactionSet: ["click-empty-to-create", "natural-language-create"],
}

export const PRESET_CONFIGS: Record<"classic", ViewConfig> = {
  classic: CLASSIC,
}

/** Month keeps its own preset shape so the existing month grid stays addressable. */
export const MONTH_CONFIG: ViewConfig = {
  ...CLASSIC,
  layout: "month-cells",
  timeAxis: { mode: "none", rowHeight: "fixed" },
  dayCount: "month",
}

/**
 * Fallback for a user with no saved views. Keeps the product working before the
 * view-management UI exists, so nothing has to be seeded per user at migration
 * time.
 */
export const DEFAULT_VIEW_CONFIG = CLASSIC

/**
 * Stored config is partial by design — a view records only what it overrides.
 * Unknown presets (including retired planner/flow) and malformed fields fall
 * back to Classic rather than blanking the calendar.
 */
export function resolveViewConfig(
  preset: string,
  stored: unknown,
): ViewConfig {
  const base =
    preset === "classic" ? PRESET_CONFIGS.classic : DEFAULT_VIEW_CONFIG

  if (!stored || typeof stored !== "object") return base

  const merged = { ...base, ...(stored as Record<string, unknown>) }
  const parsed = viewConfigSchema.safeParse(merged)
  return parsed.success ? parsed.data : base
}
