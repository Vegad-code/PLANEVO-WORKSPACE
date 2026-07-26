import assert from "node:assert/strict";
import test from "node:test";
import {
  CALENDAR_PLANNING_COLLAPSED_KEY,
  clampPlanningWidth,
  DEFAULT_PLANNING_COLLAPSED,
  DEFAULT_PLANNING_WIDTH,
  getPlanningCollapsed,
  MAX_PLANNING_WIDTH,
  MIN_PLANNING_WIDTH,
  setPlanningCollapsed,
} from "./planning-prefs.ts";

function withLocalStorage(store, run) {
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(store, key)
          ? store[key]
          : null;
      },
      setItem(key, value) {
        store[key] = String(value);
      },
    },
  };

  try {
    run(store);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

test("clampPlanningWidth clamps below min", () => {
  assert.equal(clampPlanningWidth(100), MIN_PLANNING_WIDTH);
});

test("clampPlanningWidth clamps above max", () => {
  assert.equal(clampPlanningWidth(999), MAX_PLANNING_WIDTH);
});

test("clampPlanningWidth rounds and keeps in-range values", () => {
  assert.equal(clampPlanningWidth(320.4), 320);
  assert.equal(clampPlanningWidth(DEFAULT_PLANNING_WIDTH), DEFAULT_PLANNING_WIDTH);
});

test("getPlanningCollapsed defaults open when unset", () => {
  withLocalStorage({}, () => {
    assert.equal(getPlanningCollapsed(), DEFAULT_PLANNING_COLLAPSED);
    assert.equal(getPlanningCollapsed(), false);
  });
});

test("getPlanningCollapsed reads true and false", () => {
  withLocalStorage({ [CALENDAR_PLANNING_COLLAPSED_KEY]: "true" }, () => {
    assert.equal(getPlanningCollapsed(), true);
  });
  withLocalStorage({ [CALENDAR_PLANNING_COLLAPSED_KEY]: "false" }, () => {
    assert.equal(getPlanningCollapsed(), false);
  });
});

test("getPlanningCollapsed ignores garbage values", () => {
  withLocalStorage({ [CALENDAR_PLANNING_COLLAPSED_KEY]: "yes" }, () => {
    assert.equal(getPlanningCollapsed(), DEFAULT_PLANNING_COLLAPSED);
  });
});

test("setPlanningCollapsed persists the user's choice", () => {
  withLocalStorage({}, (store) => {
    setPlanningCollapsed(true);
    assert.equal(store[CALENDAR_PLANNING_COLLAPSED_KEY], "true");
    assert.equal(getPlanningCollapsed(), true);

    setPlanningCollapsed(false);
    assert.equal(store[CALENDAR_PLANNING_COLLAPSED_KEY], "false");
    assert.equal(getPlanningCollapsed(), false);
  });
});
