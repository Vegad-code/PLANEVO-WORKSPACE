import assert from "node:assert/strict";
import test from "node:test";

async function loadNavigationModule() {
  try {
    return await import("./navigation-state.ts");
  } catch (error) {
    assert.fail(
      `Navigation state must exist before these behaviors can pass: ${String(error)}`,
    );
  }
}

test("matches the home route exactly and nested section routes by segment", async () => {
  const { isNavItemActive } = await loadNavigationModule();

  assert.equal(isNavItemActive("/", "/"), true);
  assert.equal(isNavItemActive("/tasks/record-1", "/tasks"), true);
  assert.equal(isNavItemActive("/tasks", "/tasks"), true);
  assert.equal(isNavItemActive("/tasks-archive", "/tasks"), false);
  assert.equal(isNavItemActive("/calendar", "/tasks"), false);
});

test("opens the mobile navigation", async () => {
  const { reduceMobileNavigation } = await loadNavigationModule();

  assert.deepEqual(
    reduceMobileNavigation({ open: false }, { type: "open" }),
    { open: true },
  );
});

test("every dismissal path closes the mobile navigation", async () => {
  const { reduceMobileNavigation } = await loadNavigationModule();

  for (const type of ["close", "escape", "overlay", "navigate"]) {
    assert.deepEqual(
      reduceMobileNavigation({ open: true }, { type }),
      { open: false },
    );
  }
});

