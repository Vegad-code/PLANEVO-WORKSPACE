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

test("normalizes persisted preferences and migrates rail to hidden", async () => {
  const { normalizeSidebarPreference } = await loadStateModule();

  assert.equal(normalizeSidebarPreference("expanded"), "expanded");
  assert.equal(normalizeSidebarPreference("hidden"), "hidden");
  assert.equal(normalizeSidebarPreference("rail"), "hidden");
  assert.equal(normalizeSidebarPreference("peek"), "expanded");
  assert.equal(normalizeSidebarPreference(null), "expanded");
});

test("clamps and normalizes sidebar width", async () => {
  const {
    clampSidebarWidth,
    normalizeSidebarWidth,
    SIDEBAR_DEFAULT_WIDTH,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH,
  } = await loadStateModule();

  assert.equal(clampSidebarWidth(100), SIDEBAR_MIN_WIDTH);
  assert.equal(clampSidebarWidth(500), SIDEBAR_MAX_WIDTH);
  assert.equal(clampSidebarWidth(280.6), 281);
  assert.equal(normalizeSidebarWidth(null), SIDEBAR_DEFAULT_WIDTH);
  assert.equal(normalizeSidebarWidth("abc"), SIDEBAR_DEFAULT_WIDTH);
  assert.equal(normalizeSidebarWidth("320"), 320);
});

test("toggles between expanded and hidden without persisting peek", async () => {
  const { reduceSidebarState } = await loadStateModule();

  assert.deepEqual(
    reduceSidebarState(
      { preference: "expanded", peeked: false, width: 210 },
      { type: "toggle" },
    ),
    { preference: "hidden", peeked: false, width: 210 },
  );
  assert.deepEqual(
    reduceSidebarState(
      { preference: "hidden", peeked: true, width: 240 },
      { type: "toggle" },
    ),
    { preference: "expanded", peeked: false, width: 240 },
  );
});

test("opens peek only from hidden and dismisses without changing preference", async () => {
  const { reduceSidebarState } = await loadStateModule();

  assert.deepEqual(
    reduceSidebarState(
      { preference: "hidden", peeked: false, width: 210 },
      { type: "peek" },
    ),
    { preference: "hidden", peeked: true, width: 210 },
  );
  assert.deepEqual(
    reduceSidebarState(
      { preference: "hidden", peeked: true, width: 210 },
      { type: "dismiss-peek" },
    ),
    { preference: "hidden", peeked: false, width: 210 },
  );
  assert.deepEqual(
    reduceSidebarState(
      { preference: "expanded", peeked: false, width: 210 },
      { type: "peek" },
    ),
    { preference: "expanded", peeked: false, width: 210 },
  );
});

test("pinning a peek expands the sidebar in the layout", async () => {
  const { reduceSidebarState } = await loadStateModule();

  assert.deepEqual(
    reduceSidebarState(
      { preference: "hidden", peeked: true, width: 260 },
      { type: "pin" },
    ),
    { preference: "expanded", peeked: false, width: 260 },
  );
});

test("set-width clamps the persisted sidebar width", async () => {
  const { reduceSidebarState, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } =
    await loadStateModule();

  assert.deepEqual(
    reduceSidebarState(
      { preference: "expanded", peeked: false, width: 210 },
      { type: "set-width", width: 150 },
    ),
    { preference: "expanded", peeked: false, width: SIDEBAR_MIN_WIDTH },
  );
  assert.deepEqual(
    reduceSidebarState(
      { preference: "expanded", peeked: false, width: 210 },
      { type: "set-width", width: 480 },
    ),
    { preference: "expanded", peeked: false, width: SIDEBAR_MAX_WIDTH },
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

test("keeps the hidden spacer while hover-peek floats above the canvas", async () => {
  const stateModule = await loadStateModule();
  assert.equal(
    typeof stateModule.getSidebarPresentation,
    "function",
    "getSidebarPresentation must define the layout contract",
  );

  assert.deepEqual(
    stateModule.getSidebarPresentation({
      preference: "hidden",
      peeked: true,
      width: 240,
    }),
    { view: "peek", spacer: "hidden", width: 240 },
  );
  assert.deepEqual(
    stateModule.getSidebarPresentation({
      preference: "expanded",
      peeked: false,
      width: 280,
    }),
    { view: "expanded", spacer: "expanded", width: 280 },
  );
});

test("uses a 200ms pointer hover-intent delay", async () => {
  const { PEEK_DELAY_MS } = await loadStateModule();

  assert.equal(PEEK_DELAY_MS, 200);
});
