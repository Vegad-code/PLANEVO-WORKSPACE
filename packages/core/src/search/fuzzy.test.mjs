import assert from "node:assert/strict";
import test from "node:test";
import { fuzzyMatch } from "./fuzzy.ts";

test("returns null when not a subsequence", () => {
  assert.equal(fuzzyMatch("xyz", "Physics homework"), null);
});

test("matches a subsequence and reports ranges", () => {
  const result = fuzzyMatch("phw", "Physics homework");
  assert.ok(result);
  // ranges are half-open [start, end)
  assert.equal("Physics homework"[result.ranges[0][0]].toLowerCase(), "p");
});

test("empty query matches everything with zero score", () => {
  assert.deepEqual(fuzzyMatch("", "anything"), { score: 0, ranges: [] });
});

test("prefix beats scattered", () => {
  const prefix = fuzzyMatch("phy", "Physics");
  const scattered = fuzzyMatch("phy", "Peach hydra yak");
  assert.ok(prefix.score > scattered.score);
});

test("consecutive beats gapped", () => {
  const consecutive = fuzzyMatch("cal", "Calendar");
  const gapped = fuzzyMatch("cal", "Casual lodge");
  assert.ok(consecutive.score > gapped.score);
});

test("word boundary scores well", () => {
  const boundary = fuzzyMatch("nd", "New database");
  assert.ok(boundary);
  // 'd' sits on a word boundary after the space
  assert.ok(boundary.score > 0);
});

test("merges adjacent matched chars into one range", () => {
  const result = fuzzyMatch("cal", "Calendar");
  assert.deepEqual(result.ranges, [[0, 3]]);
});
