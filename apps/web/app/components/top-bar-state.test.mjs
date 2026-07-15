import assert from "node:assert/strict";
import test from "node:test";

async function loadStateModule() {
  try {
    return await import("./top-bar-state.ts");
  } catch (error) {
    assert.fail(
      `TopBar account presentation state must exist before these behaviors can pass: ${String(error)}`,
    );
  }
}

test("presents live shell identity when both name and initials exist", async () => {
  const { getTopBarAccountPresentation } = await loadStateModule();

  assert.deepEqual(
    getTopBarAccountPresentation({
      userDisplayName: "Morgan Lee",
      userInitials: "ML",
    }),
    { kind: "identity", name: "Morgan Lee", initials: "ML" },
  );
});

test("presents neutral settings when shell identity is unavailable", async () => {
  const { getTopBarAccountPresentation } = await loadStateModule();

  assert.deepEqual(
    getTopBarAccountPresentation({
      userDisplayName: null,
      userInitials: null,
    }),
    { kind: "settings", name: "Settings", initials: null },
  );
});
