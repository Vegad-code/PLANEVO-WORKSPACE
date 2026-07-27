import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(
  new URL("../../app/(workspace)/calendar/actions.ts", import.meta.url),
  "utf8",
);
const loader = readFileSync(
  new URL("../calendar/fetch-calendar-page-data.ts", import.meta.url),
  "utf8",
);
const productView = readFileSync(
  new URL(
    "../../features/calendar-product/calendar-product-view.tsx",
    import.meta.url,
  ),
  "utf8",
);
const toolbar = readFileSync(
  new URL(
    "../../features/calendar-product/calendar-toolbar.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("calendar view actions expose the complete owner-scoped CRUD surface", () => {
  for (const actionName of [
    "createCalendarViewAction",
    "updateCalendarViewAction",
    "deleteCalendarViewAction",
    "setDefaultCalendarViewAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${actionName}\\(`));
  }
});

test("view actions validate partial overrides and never resolve presets before storage", () => {
  assert.match(
    actions,
    /const calendarViewOverridesSchema = viewConfigSchema\.partial\(\)/,
  );
  const actionSlice = actions.slice(
    actions.indexOf("const calendarViewOverridesSchema"),
    actions.indexOf("const scheduleFromDragSchema"),
  );
  assert.doesNotMatch(actionSlice, /resolveViewConfig\(/);
});

test("calendar page data carries saved views beside the full event pool", () => {
  assert.match(loader, /listCalendarViews\(access\.client, access\.ownerId\)/);
  assert.match(loader, /views: CalendarViewRow\[\]/);
  assert.match(loader, /events: CalendarDisplayEvent\[\]/);
});

test("product Calendar is Classic Day/Week/Month only — no saved-view paradigm UI", () => {
  assert.doesNotMatch(productView, /CalendarSavedViewMenu/);
  assert.doesNotMatch(productView, /activeSavedViewConfig/);
  assert.doesNotMatch(productView, /visibleContent/);
  assert.doesNotMatch(toolbar, /CalendarSavedViewMenu/);
  assert.match(toolbar, /CalendarViewMenu/);
  assert.match(
    productView,
    /const events = calendarQuery\.data\?\.events \?\? \[\]/,
  );
});
