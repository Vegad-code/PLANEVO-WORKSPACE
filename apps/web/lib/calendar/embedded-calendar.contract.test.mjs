import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readWeb = (path) =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8")

test("calendar_embed persists one saved lens identity and exports a fallback", async () => {
  const schema = await readWeb("features/editor/schema.tsx")
  const calendarBlock = schema.match(
    /const createCalendarEmbed[\s\S]*?\n\);\n\n\/\*\*/,
  )?.[0]

  assert.ok(calendarBlock)
  assert.match(calendarBlock, /type: "calendar_embed"/)
  assert.match(calendarBlock, /viewId: \{ default: "" \}/)
  assert.match(calendarBlock, /height: \{ default: "standard" \}/)
  assert.match(calendarBlock, /toExternalHTML/)
  assert.match(calendarBlock, /data-calendar-embed/)
  assert.doesNotMatch(calendarBlock, /databaseId|calendarId|recordIds/)
  assert.match(schema, /calendar_embed: createCalendarEmbed\(\)/)
})

test("slash menu inserts a selected saved view rather than copying its config", async () => {
  const [slashMenu, editor, page] = await Promise.all([
    readWeb("features/editor/slash-menu-items.tsx"),
    readWeb("features/editor/planevo-editor.tsx"),
    readWeb("app/(workspace)/pages/[pageId]/page.tsx"),
  ])

  assert.match(slashMenu, /type: "calendar_embed"/)
  assert.match(slashMenu, /viewId,/)
  assert.match(slashMenu, /Embed this saved calendar view/)
  assert.match(editor, /calendarViewOptions/)
  assert.match(page, /listCalendarViews/)
  assert.match(page, /calendarViewOptions=/)
})

test("embed reloads the current view and delegates rendering to product surfaces", async () => {
  const component = await readWeb(
    "features/editor/embedded-calendar-view.tsx",
  )

  assert.match(component, /cache: "no-store"/)
  assert.match(component, /response\.status === 404/)
  assert.match(component, /Calendar view unavailable/)
  assert.match(component, /window\.addEventListener\("focus", handleRefresh\)/)
  assert.match(component, /<CalendarGridEngine/)
  assert.match(component, /<YearView/)
  assert.match(component, /viewConfig=\{config\}/)
  assert.doesNotMatch(component, /layoutIntervals|resolveRenderer/)
})

test("embedded API is owner-scoped, uncached, and uses calendar page loading", async () => {
  const route = await readWeb("app/api/embedded-calendar/route.ts")

  assert.match(route, /loadCalendarView\([\s\S]*access\.ownerId/)
  assert.match(route, /fetchCalendarPageData/)
  assert.match(route, /serializeCalendarQueryData/)
  assert.match(route, /private, no-store/)
  assert.match(route, /status: 404/)
})
