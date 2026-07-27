import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LIBRARY_COLLAPSED,
  FILES_LIBRARY_COLLAPSED_KEY,
  getLibraryCollapsed,
  setLibraryCollapsed,
} from "./library-prefs.ts";

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

test("getLibraryCollapsed defaults open when unset", () => {
  withLocalStorage({}, () => {
    assert.equal(getLibraryCollapsed(), DEFAULT_LIBRARY_COLLAPSED);
    assert.equal(getLibraryCollapsed(), false);
  });
});

test("getLibraryCollapsed reads true and false", () => {
  withLocalStorage({ [FILES_LIBRARY_COLLAPSED_KEY]: "true" }, () => {
    assert.equal(getLibraryCollapsed(), true);
  });
  withLocalStorage({ [FILES_LIBRARY_COLLAPSED_KEY]: "false" }, () => {
    assert.equal(getLibraryCollapsed(), false);
  });
});

test("getLibraryCollapsed ignores garbage values", () => {
  withLocalStorage({ [FILES_LIBRARY_COLLAPSED_KEY]: "yes" }, () => {
    assert.equal(getLibraryCollapsed(), DEFAULT_LIBRARY_COLLAPSED);
  });
});

test("setLibraryCollapsed persists the user's choice", () => {
  withLocalStorage({}, (store) => {
    setLibraryCollapsed(true);
    assert.equal(store[FILES_LIBRARY_COLLAPSED_KEY], "true");
    assert.equal(getLibraryCollapsed(), true);

    setLibraryCollapsed(false);
    assert.equal(store[FILES_LIBRARY_COLLAPSED_KEY], "false");
    assert.equal(getLibraryCollapsed(), false);
  });
});

test("LIBRARY_RAIL_BOOT_SCRIPT forces width 0 when collapsed", async () => {
  const { LIBRARY_RAIL_BOOT_SCRIPT } = await import("./library-prefs.ts");
  assert.match(LIBRARY_RAIL_BOOT_SCRIPT, /collapsed\?0:n/);
  assert.match(LIBRARY_RAIL_BOOT_SCRIPT, /planevo:files:library-collapsed/);
});
