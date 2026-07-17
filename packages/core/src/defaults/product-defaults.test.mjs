import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProductSeedPayload } from "./product-defaults.ts";

test("buildProductSeedPayload returns default calendar and onboarding tasks", () => {
  const seed = buildProductSeedPayload({ organizing: "school" });
  assert.equal(seed.calendarName, "My Calendar");
  assert.ok(seed.starterTasks.length >= 4);
  assert.ok(seed.starterTasks.some((t) => /rename/i.test(t.title)));
});
