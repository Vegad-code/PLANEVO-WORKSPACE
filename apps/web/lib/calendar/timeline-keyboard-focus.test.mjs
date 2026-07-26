import assert from "node:assert/strict";
import test from "node:test";
import { nextTimelineFocusIndex } from "./timeline-keyboard-focus.ts";

test("arrow keys reach each timeline item without leaving the list", () => {
  assert.equal(
    nextTimelineFocusIndex({
      key: "ArrowDown",
      currentIndex: 0,
      itemCount: 3,
    }),
    1,
  );
  assert.equal(
    nextTimelineFocusIndex({
      key: "ArrowDown",
      currentIndex: 2,
      itemCount: 3,
    }),
    2,
  );
  assert.equal(
    nextTimelineFocusIndex({
      key: "ArrowUp",
      currentIndex: 1,
      itemCount: 3,
    }),
    0,
  );
  assert.equal(
    nextTimelineFocusIndex({
      key: "ArrowUp",
      currentIndex: 0,
      itemCount: 3,
    }),
    0,
  );
});

test("home and end jump to the timeline boundaries", () => {
  assert.equal(
    nextTimelineFocusIndex({
      key: "Home",
      currentIndex: 2,
      itemCount: 4,
    }),
    0,
  );
  assert.equal(
    nextTimelineFocusIndex({
      key: "End",
      currentIndex: 0,
      itemCount: 4,
    }),
    3,
  );
});

test("an empty timeline has no focus target", () => {
  assert.equal(
    nextTimelineFocusIndex({
      key: "ArrowDown",
      currentIndex: 0,
      itemCount: 0,
    }),
    null,
  );
});
