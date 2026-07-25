import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { openMonthDayFromAgenda, openMonthDayFromCell } from "./month-day-open.ts"
import { getMonthDayAgendaPosition } from "./month-day-agenda-position.ts"

test("agenda Open day dispatches the selected day", () => {
  const date = new Date(2026, 6, 24)
  let opened = null

  openMonthDayFromAgenda(date, (nextDate) => {
    opened = nextDate
  })

  assert.equal(opened, date)
})

test("Month cell double-click dispatches the selected day", () => {
  const date = new Date(2026, 6, 24)
  let opened = null

  openMonthDayFromCell(date, (nextDate) => {
    opened = nextDate
  })

  assert.equal(opened, date)
})

test("Month components wire both explicit Day entry points to their dispatch contracts", async () => {
  const [agendaSource, gridSource] = await Promise.all([
    readFile(
      new URL(
        "../../features/calendar-product/month-day-agenda-popover.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../features/calendar-product/calendar-grid-engine.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ])

  assert.match(agendaSource, /openMonthDayFromAgenda\(date, onOpenDay\)/)
  assert.match(gridSource, /openMonthDayFromCell\(value, onOpenDay\)/)
})

test("Month overflow restores focus to its containing day cell", async () => {
  const gridSource = await readFile(
    new URL(
      "../../features/calendar-product/calendar-grid-engine.tsx",
      import.meta.url,
    ),
    "utf8",
  )
  const showMoreSource = gridSource.slice(
    gridSource.indexOf("const handleShowMore"),
    gridSource.indexOf("const monthComponents"),
  )

  assert.match(showMoreSource, /cell instanceof HTMLElement \? cell : document\.body/)
  assert.doesNotMatch(showMoreSource, /document\.activeElement/)
})

test("desktop agenda clamps against its rendered dimensions", () => {
  const position = getMonthDayAgendaPosition({
    anchor: { left: 1400, bottom: 880 },
    panel: { left: 0, bottom: 0, width: 288, height: 360 },
    viewport: { width: 1440, height: 900 },
  })

  assert.deepEqual(position, { top: 524, left: 1136 })
})

test("desktop agenda remains on-screen in a short viewport", () => {
  const position = getMonthDayAgendaPosition({
    anchor: { left: 24, bottom: 80 },
    panel: { left: 0, bottom: 0, width: 288, height: 360 },
    viewport: { width: 320, height: 180 },
  })

  assert.deepEqual(position, { top: 16, left: 16 })
})
