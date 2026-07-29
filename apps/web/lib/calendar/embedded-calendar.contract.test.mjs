import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readWeb = (path) =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8")

test("calendar_embed persists a canonical target and block-local presentation", async () => {
  const schema = await readWeb("features/editor/schema.tsx")
  const calendarBlock = schema.match(
    /const createCalendarEmbed[\s\S]*?\n\);\n\n\/\*\*/,
  )?.[0]

  assert.ok(calendarBlock)
  assert.match(calendarBlock, /type: "calendar_embed"/)
  assert.match(calendarBlock, /targetKind: \{ default: "main" \}/)
  assert.match(calendarBlock, /calendarId: \{ default: "" \}/)
  assert.match(calendarBlock, /viewId: \{ default: "" \}/)
  assert.match(calendarBlock, /view: \{ default: "month" \}/)
  assert.match(calendarBlock, /height: \{ default: "standard" \}/)
  assert.match(calendarBlock, /data-calendar-embed/)
  assert.match(calendarBlock, /legacyViewId=\{block\.props\.viewId\}/)
})

test("slash menu inserts Main and owned calendars without copying event data", async () => {
  const [slashMenu, editor, page] = await Promise.all([
    readWeb("features/editor/slash-menu-items.tsx"),
    readWeb("features/editor/planevo-editor.tsx"),
    readWeb("app/(workspace)/pages/[pageId]/page.tsx"),
  ])

  assert.match(slashMenu, /targetKind: calendar\.kind/)
  assert.match(slashMenu, /calendarId:/)
  assert.match(slashMenu, /Embed this live calendar/)
  assert.match(editor, /calendarOptions/)
  assert.match(page, /loadCalendars/)
  assert.match(page, /kind: "main"/)
  assert.doesNotMatch(page, /listCalendarViews/)
})

test("embed delegates navigation and editing to shared calendar surfaces", async () => {
  const component = await readWeb(
    "features/editor/embedded-calendar-view.tsx",
  )

  assert.match(component, /cache: "no-store"/)
  assert.match(component, /response\.status === 404/)
  assert.match(component, /Calendar unavailable/)
  assert.match(component, /<CalendarGridEngine/)
  assert.match(component, /<EventDetailPanel/)
  assert.match(component, /createCalendarEventAction/)
  assert.match(component, /updateEventTimesAction/)
  assert.doesNotMatch(component, /YearView|viewConfig|resolveRenderer/)
})

test("embedded API validates owner-scoped canonical targets", async () => {
  const route = await readWeb("app/api/embedded-calendar/route.ts")

  assert.match(route, /parseCalendarEmbedTarget/)
  assert.match(route, /loadCalendars\(access\.client, access\.ownerId\)/)
  assert.match(route, /fetchCalendarPageData/)
  assert.match(route, /serializeCalendarQueryData/)
  assert.match(route, /private, no-store/)
  assert.match(route, /status: 404/)
  assert.doesNotMatch(route, /loadCalendarView/)
})
