import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  return import("./sidebar-section-state.ts");
}

test("toggles a single section without affecting others", async () => {
  const { reduceSectionCollapse, DEFAULT_SIDEBAR_SECTION_STATE } =
    await loadModule();

  const collapsedPinned = reduceSectionCollapse(
    DEFAULT_SIDEBAR_SECTION_STATE,
    "pinned",
  );
  assert.deepEqual(collapsedPinned, {
    pinned: true,
    pages: false,
    private: false,
  });

  assert.deepEqual(reduceSectionCollapse(collapsedPinned, "pages"), {
    pinned: true,
    pages: true,
    private: false,
  });
});

test("normalizes and serializes section collapse state", async () => {
  const {
    normalizeSectionState,
    serializeSectionState,
    DEFAULT_SIDEBAR_SECTION_STATE,
  } = await loadModule();

  assert.deepEqual(normalizeSectionState(null), DEFAULT_SIDEBAR_SECTION_STATE);
  assert.deepEqual(normalizeSectionState("not-json"), DEFAULT_SIDEBAR_SECTION_STATE);
  assert.deepEqual(
    normalizeSectionState(JSON.stringify({ pinned: true, pages: "nope" })),
    { pinned: true, pages: false, private: false },
  );

  const serialized = serializeSectionState({
    pinned: true,
    pages: false,
    private: true,
  });
  assert.deepEqual(normalizeSectionState(serialized), {
    pinned: true,
    pages: false,
    private: true,
  });
});
