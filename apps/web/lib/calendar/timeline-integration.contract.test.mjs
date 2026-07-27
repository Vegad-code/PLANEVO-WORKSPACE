import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { calendarNavTransition } from "./calendar-nav-motion.ts"
import { PRESET_CONFIGS } from "./view-config.ts"
import { resolveRenderer } from "./view-registry.ts"

test("Classic resolves inside the grid engine boundary", async () => {
  const [gridSource, productSource] = await Promise.all([
    readFile(
      new URL(
        "../../features/calendar-product/calendar-grid-engine.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../features/calendar-product/calendar-product-view.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ])

  assert.equal(resolveRenderer(PRESET_CONFIGS.classic).id, "rbc-time-grid")
  assert.match(gridSource, /resolveRenderer\(effectiveViewConfig\)/)
  assert.match(productSource, /<CalendarViewTransition[\s\S]*<CalendarGridEngine/)
  assert.doesNotMatch(productSource, /viewConfig=\{activeSavedViewConfig\}/)
  assert.doesNotMatch(productSource, /CalendarSavedViewMenu/)
})

test("timeline keeps shared interactions and every item in the roving grid", async () => {
  const timelineSource = await readFile(
    new URL(
      "../../features/calendar-product/timeline-grid.tsx",
      import.meta.url,
    ),
    "utf8",
  )

  assert.match(timelineSource, /role="grid"/)
  assert.match(timelineSource, /role="gridcell"/)
  assert.match(timelineSource, /nextTimelineFocusIndex/)
  assert.match(timelineSource, /onSelectEvent\(item\.event/)
  assert.match(timelineSource, /data-calendar-slot-time/)
  assert.doesNotMatch(timelineSource, /from "framer-motion"/)
})

test("the shared view transition becomes instant for reduced motion", () => {
  assert.deepEqual(calendarNavTransition(true), { duration: 0 })
  assert.ok((calendarNavTransition(false).duration ?? 0) > 0)
})
