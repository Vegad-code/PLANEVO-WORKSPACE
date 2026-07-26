import { z } from "zod"

/**
 * The eight axes every calendar view paradigm reduces to.
 *
 * Tearing down Google Calendar, Notion Calendar, Sunsama, Structured, Amie,
 * Motion, Vimcal, Akiflow, Fantastical, Morgen, TickTick, Reclaim, Apple
 * Calendar and Outlook Board produced no ninth axis — each of those products is
 * one point in this space. So a preset is a named bundle of these values, not a
 * bespoke UI, and adding a paradigm means adding a renderer plus a row here.
 *
 * Grouped: layout/timeAxis/dayCount are the skeleton, sidebarMode/groupingKey/
 * colorSource the workflow, cardDensity/interactionSet the feel.
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
  dayCount: z.union([z.number().int().min(1).max(14), z.enum(["month", "year"])]),
  sidebarMode: z.enum([
    "none",
    "calendar-list",
    "task-backlog",
    "inbox-capture",
    "command-palette",
  ]),
  groupingKey: z.enum(["time", "day", "priority", "project", "calendar-source"]),
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

export const VIEW_PRESETS = ["classic", "planner", "flow", "custom"] as const
export type ViewPreset = (typeof VIEW_PRESETS)[number]

/** Google/Apple-style time grid — what Planevo renders today. */
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

/** Sunsama-style daily plan: one day, backlog beside it, drag to timebox. */
const PLANNER: ViewConfig = {
  layout: "single-timeline",
  timeAxis: { mode: "cropped-working-hours", rowHeight: "fixed" },
  dayCount: 1,
  sidebarMode: "task-backlog",
  groupingKey: "time",
  colorSource: "project",
  cardDensity: "rich",
  interactionSet: ["drag-from-backlog", "click-empty-to-create"],
}

/** Structured-style vertical timeline: taller block = longer event. */
const FLOW: ViewConfig = {
  layout: "single-timeline",
  timeAxis: { mode: "auto-scale-to-content", rowHeight: "proportional-to-duration" },
  dayCount: 1,
  sidebarMode: "inbox-capture",
  groupingKey: "time",
  colorSource: "category",
  cardDensity: "minimal",
  interactionSet: ["drag-from-backlog", "plan-wizard"],
}

export const PRESET_CONFIGS: Record<Exclude<ViewPreset, "custom">, ViewConfig> = {
  classic: CLASSIC,
  planner: PLANNER,
  flow: FLOW,
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
 * Stored config is partial by design — a view records only what it overrides, so
 * improving a preset improves every view built on it. Unknown or malformed
 * fields fall back rather than throwing: a bad row should degrade to Classic,
 * never blank the calendar.
 */
export function resolveViewConfig(
  preset: string,
  stored: unknown,
): ViewConfig {
  const base =
    preset in PRESET_CONFIGS
      ? PRESET_CONFIGS[preset as Exclude<ViewPreset, "custom">]
      : DEFAULT_VIEW_CONFIG

  if (!stored || typeof stored !== "object") return base

  const merged = { ...base, ...(stored as Record<string, unknown>) }
  const parsed = viewConfigSchema.safeParse(merged)
  return parsed.success ? parsed.data : base
}
