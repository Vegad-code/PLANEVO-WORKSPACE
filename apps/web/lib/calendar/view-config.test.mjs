import assert from "node:assert/strict"
import test from "node:test"
import { PRESET_CONFIGS, resolveViewConfig } from "./view-config.ts"
import {
  configForLegacyView,
  isLayoutImplemented,
  resolveRenderer,
} from "./view-registry.ts"

test("resolves a known preset to its full config", () => {
  // Arrange / Act / Assert
  assert.deepEqual(resolveViewConfig("planner", null), PRESET_CONFIGS.planner)
  assert.equal(resolveViewConfig("flow", {}).layout, "single-timeline")
})

test("stored overrides win over the preset base", () => {
  // Arrange / Act — a view records only what it changes.
  const config = resolveViewConfig("classic", { dayCount: 3 })

  // Assert
  assert.equal(config.dayCount, 3)
  assert.equal(config.sidebarMode, PRESET_CONFIGS.classic.sidebarMode)
})

test("a malformed row degrades to the base instead of throwing", () => {
  // Arrange / Act / Assert — a bad config must never blank the calendar.
  assert.deepEqual(
    resolveViewConfig("classic", { layout: "not-a-layout" }),
    PRESET_CONFIGS.classic,
  )
  assert.deepEqual(resolveViewConfig("nonsense", null), PRESET_CONFIGS.classic)
  assert.deepEqual(resolveViewConfig("classic", "garbage"), PRESET_CONFIGS.classic)
})

test("registry picks the renderer, and day-count 1 pages by day", () => {
  // Arrange / Act / Assert
  assert.equal(resolveRenderer(configForLegacyView("week")).id, "rbc-time-grid")
  assert.equal(resolveRenderer(configForLegacyView("month")).id, "month-grid")
  assert.equal(
    resolveRenderer(configForLegacyView("day")).navigationUnit,
    "day",
  )
  assert.equal(
    resolveRenderer(configForLegacyView("week")).navigationUnit,
    "week",
  )
})

test("Planner and Flow resolve through the registered timeline renderer", () => {
  // Arrange / Act / Assert
  assert.equal(isLayoutImplemented("single-timeline"), true)
  assert.equal(isLayoutImplemented("grid-columns"), true)
  assert.equal(resolveRenderer(PRESET_CONFIGS.flow).id, "timeline")
  assert.equal(resolveRenderer(PRESET_CONFIGS.planner).navigationUnit, "day")
})
