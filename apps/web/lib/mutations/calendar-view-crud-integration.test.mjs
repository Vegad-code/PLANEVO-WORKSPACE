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

test("saved view selection synchronizes its query range and filters every drawn event surface", () => {
  assert.match(
    productView,
    /handleViewChange\(activeSavedToolbarView\)/,
  );
  assert.equal(
    productView.match(/events=\{visibleContent\.events\}/g)?.length,
    3,
  );
  assert.match(
    productView,
    /const events = calendarQuery\.data\?\.events \?\? \[\]/,
  );
});
