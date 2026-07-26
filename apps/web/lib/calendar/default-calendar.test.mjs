import assert from "node:assert/strict";
import test from "node:test";
import { defaultCalendarId } from "./default-calendar.ts";

const calendar = (id, isDefault = false) => ({
  id,
  is_default: isDefault,
});

test("new events target the explicit default calendar", () => {
  assert.equal(
    defaultCalendarId([
      calendar("oldest"),
      calendar("chosen", true),
      calendar("newest"),
    ]),
    "chosen",
  );
});

test("legacy users fall back to the first calendar and empty lists stay safe", () => {
  assert.equal(
    defaultCalendarId([calendar("oldest"), calendar("newest")]),
    "oldest",
  );
  assert.equal(defaultCalendarId([]), "");
});
