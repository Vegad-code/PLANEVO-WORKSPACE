import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  try {
    return await import("./bubble-position.ts");
  } catch (error) {
    assert.fail(`Bubble placement must load: ${String(error)}`);
  }
}

/** A 200px-wide selection sitting comfortably mid-container. */
const base = {
  selectionLeft: 300,
  selectionRight: 500,
  selectionTop: 400,
  selectionBottom: 424,
  toolbarWidth: 300,
  toolbarHeight: 44,
  containerWidth: 1000,
  containerHeight: 800,
};

test("centres the toolbar above the selection", async () => {
  const { placeBubble, BUBBLE_OFFSET } = await loadModule();

  const placement = placeBubble(base);
  assert.equal(placement.side, "above");
  // Midpoint 400, half-width 150 → 250.
  assert.equal(placement.left, 250);
  assert.equal(placement.top, 400 - 44 - BUBBLE_OFFSET);
});

test("flips below when the selection is too close to the top", async () => {
  const { placeBubble, BUBBLE_OFFSET } = await loadModule();

  const placement = placeBubble({
    ...base,
    selectionTop: 10,
    selectionBottom: 34,
  });
  assert.equal(placement.side, "below");
  assert.equal(placement.top, 34 + BUBBLE_OFFSET);
});

test("clamps to the left edge instead of overflowing", async () => {
  const { placeBubble, BUBBLE_MARGIN } = await loadModule();

  const placement = placeBubble({
    ...base,
    selectionLeft: 0,
    selectionRight: 40,
  });
  assert.equal(placement.left, BUBBLE_MARGIN);
});

test("clamps to the right edge instead of overflowing", async () => {
  const { placeBubble, BUBBLE_MARGIN } = await loadModule();

  const placement = placeBubble({
    ...base,
    selectionLeft: 960,
    selectionRight: 1000,
  });
  assert.equal(placement.left, 1000 - 300 - BUBBLE_MARGIN);
});

test("pins to the left margin when the container is narrower than the toolbar", async () => {
  const { placeBubble, BUBBLE_MARGIN } = await loadModule();

  const placement = placeBubble({ ...base, containerWidth: 120 });
  assert.equal(placement.left, BUBBLE_MARGIN);
});

test("stays above when the container is too short to flip into", async () => {
  const { placeBubble } = await loadModule();

  const placement = placeBubble({
    ...base,
    selectionTop: 4,
    selectionBottom: 20,
    containerHeight: 60,
  });
  assert.equal(placement.side, "above");
});

test("returns null before the toolbar has been measured", async () => {
  const { placeBubble } = await loadModule();

  assert.equal(placeBubble({ ...base, toolbarWidth: 0 }), null);
  assert.equal(placeBubble({ ...base, toolbarHeight: 0 }), null);
});

test("returns null for an unmeasurable container or selection", async () => {
  const { placeBubble } = await loadModule();

  assert.equal(placeBubble({ ...base, containerWidth: 0 }), null);
  assert.equal(placeBubble({ ...base, selectionTop: Number.NaN }), null);
});
