import {
  DEFAULT_VIEW_CONFIG,
  MONTH_CONFIG,
  type ViewConfig,
  type ViewLayout,
} from "./view-config.ts"

/**
 * Maps a view's `layout` axis onto the renderer that draws it.
 *
 * Renderers are peers behind one descriptor, so adding a paradigm is adding an
 * entry plus a component — no branching in callers. Today only the two existing
 * renderers are registered; the timeline/kanban/agenda layouts resolve to
 * `null`, which callers treat as "fall back to Classic" rather than rendering
 * nothing. That keeps a config referencing an unbuilt layout from blanking the
 * calendar.
 */

export type RendererId = "rbc-time-grid" | "month-grid"

export type RendererDescriptor = {
  id: RendererId
  /** What one page of navigation moves by. */
  navigationUnit: "day" | "week" | "month"
  supportsNowIndicator: boolean
}

const RBC_TIME_GRID: RendererDescriptor = {
  id: "rbc-time-grid",
  navigationUnit: "week",
  supportsNowIndicator: true,
}

const RBC_DAY_GRID: RendererDescriptor = {
  ...RBC_TIME_GRID,
  navigationUnit: "day",
}

const MONTH_GRID: RendererDescriptor = {
  id: "month-grid",
  navigationUnit: "month",
  supportsNowIndicator: false,
}

const REGISTRY: Record<ViewLayout, RendererDescriptor | null> = {
  "grid-columns": RBC_TIME_GRID,
  "month-cells": MONTH_GRID,
  // Phase B onward.
  "single-timeline": null,
  "kanban-columns": null,
  "list-agenda": null,
}

export function resolveRenderer(config: ViewConfig): RendererDescriptor {
  const descriptor = REGISTRY[config.layout]
  if (!descriptor) return RBC_TIME_GRID

  // A single-day grid navigates by day, not week — same renderer, different page
  // size. Keeps "Day" from becoming its own layout.
  if (descriptor.id === "rbc-time-grid" && config.dayCount === 1) {
    return RBC_DAY_GRID
  }

  return descriptor
}

export function isLayoutImplemented(layout: ViewLayout): boolean {
  return REGISTRY[layout] !== null
}

/** The legacy view strings, expressed as configs so both paths share a renderer. */
export type LegacyView = "day" | "week" | "month"

export function configForLegacyView(view: LegacyView): ViewConfig {
  if (view === "month") return MONTH_CONFIG
  return {
    ...DEFAULT_VIEW_CONFIG,
    dayCount: view === "day" ? 1 : 7,
  }
}
