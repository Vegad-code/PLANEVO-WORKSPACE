import assert from "node:assert/strict";
import test from "node:test";

const {
  INITIAL_SAVE_STATE,
  beginSave,
  completeSave,
  failSave,
  markDirty,
} = await import("./editor-state.ts");

test("idle → dirty → saving → idle round trip", () => {
  const dirty = markDirty(INITIAL_SAVE_STATE);
  assert.deepEqual(dirty, { status: "dirty", queued: false });

  const saving = beginSave(dirty);
  assert.deepEqual(saving, { status: "saving", queued: false });

  assert.deepEqual(completeSave(saving), { status: "idle", queued: false });
});

test("beginSave is a no-op unless dirty", () => {
  assert.equal(beginSave(INITIAL_SAVE_STATE), null);
  assert.equal(beginSave({ status: "saving", queued: false }), null);
});

test("edits during a save queue exactly one follow-up", () => {
  const saving = beginSave(markDirty(INITIAL_SAVE_STATE));
  const editedWhileSaving = markDirty(markDirty(saving));
  assert.deepEqual(editedWhileSaving, { status: "saving", queued: true });

  // The queued edit becomes the next dirty state, ready for another save.
  assert.deepEqual(completeSave(editedWhileSaving), { status: "dirty", queued: false });
});

test("failed saves stay dirty so content is never lost", () => {
  assert.deepEqual(failSave(), { status: "dirty", queued: false });
});
