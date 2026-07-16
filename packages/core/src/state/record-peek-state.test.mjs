import assert from "node:assert/strict";
import test from "node:test";

async function load() {
  return import("./record-peek-state.ts");
}

test("parses and clears record peek search params", async () => {
  const {
    parseRecordPeekSearchParams,
    buildRecordPeekSearchParams,
    normalizeRecordPeekMode,
  } = await load();

  assert.equal(normalizeRecordPeekMode("side"), "side");
  assert.equal(normalizeRecordPeekMode("center"), "center");
  assert.equal(normalizeRecordPeekMode("nope"), "center");

  assert.deepEqual(parseRecordPeekSearchParams({ p: "rec-1", peek: "side" }), {
    recordId: "rec-1",
    mode: "side",
  });
  assert.equal(parseRecordPeekSearchParams({ peek: "center" }), null);

  const opened = buildRecordPeekSearchParams(new URLSearchParams("rows=200"), {
    recordId: "rec-2",
    mode: "center",
  });
  assert.equal(opened.get("rows"), "200");
  assert.equal(opened.get("p"), "rec-2");
  assert.equal(opened.get("peek"), "center");

  const closed = buildRecordPeekSearchParams(opened, null);
  assert.equal(closed.get("p"), null);
  assert.equal(closed.get("peek"), null);
  assert.equal(closed.get("rows"), "200");
});
