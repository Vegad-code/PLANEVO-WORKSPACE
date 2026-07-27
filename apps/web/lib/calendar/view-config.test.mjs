import assert from "node:assert/strict"
import test from "node:test"
import { PRESET_CONFIGS, resolveViewConfig } from "./view-config.ts"
import {
  configForLegacyView,
  isLayoutImplemented,
  resolveRenderer,
} from "./view-registry.ts"

test("resolves Classic to its full config", () => {
  assert.deepEqual(resolveViewConfig("classic", null), PRESET_CONFIGS.classic)
})

test("retired Planner and Flow presets degrade to Classic", () => {
  assert.deepEqual(resolveViewConfig("planner", null), PRESET_CONFIGS.classic)
  assert.deepEqual(resolveViewConfig("flow", {}), PRESET_CONFIGS.classic)
})

test("stored overrides win over the preset base", () => {
  const config = resolveViewConfig("classic", { dayCount: 3 })

  assert.equal(config.dayCount, 3)
  assert.equal(config.sidebarMode, PRESET_CONFIGS.classic.sidebarMode)
})

test("a malformed row degrades to the base instead of throwing", () => {
  assert.deepEqual(
    resolveViewConfig("classic", { layout: "not-a-layout" }),
    PRESET_CONFIGS.classic,
  )
  assert.deepEqual(resolveViewConfig("nonsense", null), PRESET_CONFIGS.classic)
  assert.deepEqual(resolveViewConfig("classic", "garbage"), PRESET_CONFIGS.classic)
})

test("registry picks the renderer, and day-count 1 pages by day", () => {
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

test("Classic Day/Week/Month are the implemented product layouts", () => {
  assert.equal(isLayoutImplemented("grid-columns"), true)
  assert.equal(isLayoutImplemented("month-cells"), true)
  assert.equal(isLayoutImplemented("single-timeline"), true)
  assert.equal(resolveRenderer(PRESET_CONFIGS.classic).id, "rbc-time-grid")
})
