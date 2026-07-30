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

test("Month cell date button dispatches the selected day", () => {
  const date = new Date(2026, 6, 24)
  let opened = null

  openMonthDayFromCell(date, (nextDate) => {
    opened = nextDate
  })

  assert.equal(opened, date)
})

test("Month components wire both explicit Day entry points to their dispatch contracts", async () => {
  const [agendaSource, cellSource] = await Promise.all([
    readFile(
      new URL(
        "../../features/calendar-product/month-day-agenda-popover.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../features/calendar-product/month-day-cell.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ])

  assert.match(agendaSource, /openMonthDayFromAgenda\(date, onOpenDay\)/)
  assert.match(cellSource, /openMonthDayFromCell\(date, onOpenDay\)/)
  assert.match(cellSource, /calendar-month-date-button/)
  assert.doesNotMatch(cellSource, /onDoubleClick/)
})

test("Week header wires number-only day button, not whole header stack", async () => {
  const headerSource = await readFile(
    new URL(
      "../../features/calendar-product/rbc-day-header.tsx",
      import.meta.url,
    ),
    "utf8",
  )

  assert.match(headerSource, /calendar-day-header-stack/)
  assert.match(headerSource, /aria-current=\{isToday \? "date" : undefined\}/)
  assert.match(headerSource, /\{weekdayLabel\}\s*<button/)
  assert.match(headerSource, /calendar-day-header-button[\s\S]*\{dayNumberLabel\}/)
  assert.doesNotMatch(headerSource, /<button[\s\S]*calendar-day-weekday/)
})

test("Month overflow anchors the agenda to a real element, never a fallback", async () => {
  const cellSource = await readFile(
    new URL(
      "../../features/calendar-product/month-day-cell.tsx",
      import.meta.url,
    ),
    "utf8",
  )

  // The overflow trigger and the cell both hand their own element to the
  // agenda, so focus returns exactly where it left rather than to the body.
  assert.match(cellSource, /onOpenAgenda\(date, event\.currentTarget\)/)
  assert.match(cellSource, /aria-label=\{`\$\{overflowCount\} more events`\}/)
  assert.doesNotMatch(cellSource, /document\.body/)
  assert.doesNotMatch(cellSource, /document\.activeElement/)
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
