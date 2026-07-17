import assert from "node:assert/strict";
import test from "node:test";
import { needsRebalance, positionBetween, rebalanced } from "./fractional.ts";

test("positionBetween appends, prepends, and midpoints", () => {
  assert.equal(positionBetween(null, null), 0);
  assert.equal(positionBetween(5, null), 6);
  assert.equal(positionBetween(null, 5), 4);
  assert.equal(positionBetween(2, 4), 3);
  assert.equal(positionBetween(0, 1), 0.5);
});

test("needsRebalance detects exhausted gaps", () => {
  assert.equal(needsRebalance(null, 1), false);
  assert.equal(needsRebalance(1, null), false);
  assert.equal(needsRebalance(1, 2), false);
  assert.equal(needsRebalance(1, 1 + 1e-7), true);
});

test("rebalanced returns 1..n", () => {
  assert.deepEqual(rebalanced(0), []);
  assert.deepEqual(rebalanced(3), [1, 2, 3]);
});
