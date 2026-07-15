import assert from "node:assert/strict";
import test from "node:test";

async function loadStateModule() {
  try {
    return await import("./sidebar-state.ts");
  } catch (error) {
    assert.fail(
      `Sidebar state module must exist before these behaviors can pass: ${String(error)}`,
    );
  }
}

test("normalizes only persisted sidebar preferences", async () => {
  const { normalizeSidebarPreference } = await loadStateModule();

  assert.equal(normalizeSidebarPreference("expanded"), "expanded");
  assert.equal(normalizeSidebarPreference("rail"), "rail");
  assert.equal(normalizeSidebarPreference("peek"), "expanded");
  assert.equal(normalizeSidebarPreference(null), "expanded");
});

test("toggles between expanded and rail without persisting peek", async () => {
  const { reduceSidebarState } = await loadStateModule();

  assert.deepEqual(
    reduceSidebarState(
      { preference: "expanded", peeked: false },
      { type: "toggle" },
    ),
    { preference: "rail", peeked: false },
  );
  assert.deepEqual(
    reduceSidebarState(
      { preference: "rail", peeked: true },
      { type: "toggle" },
    ),
    { preference: "expanded", peeked: false },
  );
});

test("opens peek only from rail and dismisses without changing preference", async () => {
  const { reduceSidebarState } = await loadStateModule();

  assert.deepEqual(
    reduceSidebarState(
      { preference: "rail", peeked: false },
      { type: "peek" },
    ),
    { preference: "rail", peeked: true },
  );
  assert.deepEqual(
    reduceSidebarState(
      { preference: "rail", peeked: true },
      { type: "dismiss-peek" },
    ),
    { preference: "rail", peeked: false },
  );
  assert.deepEqual(
    reduceSidebarState(
      { preference: "expanded", peeked: false },
      { type: "peek" },
    ),
    { preference: "expanded", peeked: false },
  );
});

test("pinning a peek expands the sidebar in the layout", async () => {
  const { reduceSidebarState } = await loadStateModule();

  assert.deepEqual(
    reduceSidebarState(
      { preference: "rail", peeked: true },
      { type: "pin" },
    ),
    { preference: "expanded", peeked: false },
  );
});

test("matches the command-backslash shortcut exactly", async () => {
  const { matchesSidebarShortcut } = await loadStateModule();

  assert.equal(
    matchesSidebarShortcut({
      key: "\\",
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    }),
    true,
  );
  assert.equal(
    matchesSidebarShortcut({
      key: "\\",
      metaKey: false,
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
    }),
    false,
  );
  assert.equal(
    matchesSidebarShortcut({
      key: "|",
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
    }),
    false,
  );
});

test("keeps the rail spacer while hover-peek floats above the canvas", async () => {
  const stateModule = await loadStateModule();
  assert.equal(
    typeof stateModule.getSidebarPresentation,
    "function",
    "getSidebarPresentation must define the layout contract",
  );

  assert.deepEqual(
    stateModule.getSidebarPresentation({ preference: "rail", peeked: true }),
    { view: "peek", spacer: "rail" },
  );
  assert.deepEqual(
    stateModule.getSidebarPresentation({ preference: "expanded", peeked: false }),
    { view: "expanded", spacer: "expanded" },
  );
});

test("uses a 200ms pointer hover-intent delay", async () => {
  const { PEEK_DELAY_MS } = await loadStateModule();

  assert.equal(PEEK_DELAY_MS, 200);
});
