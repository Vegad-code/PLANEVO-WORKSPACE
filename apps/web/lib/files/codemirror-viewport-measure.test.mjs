/**
 * CodeMirror viewport measure + value sync — guards Document/Markdown empty
 * paint when Split looked fine (0-height flex mount, no sibling remasure,
 * stale external value). Pair with files-editor-glass-paint.test.mjs.
 *
 * @see docs/superpowers/specs/2026-07-31-document-viewport-text-paint-design.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  observeEditorHostSize,
  scheduleEditorMeasure,
  syncEditorValue,
} from "./codemirror-viewport-measure.ts";

describe("syncEditorValue", () => {
  it("no-ops when the editor already holds the external value (does not clobber typing)", () => {
    const calls = [];
    const changed = syncEditorValue({
      currentDoc: "hello",
      nextValue: "hello",
      dispatch: (change) => calls.push(change),
    });
    assert.equal(changed, false);
    assert.deepEqual(calls, []);
  });

  it("replaces the whole doc when external value diverges from CM state", () => {
    const calls = [];
    const changed = syncEditorValue({
      currentDoc: "stale",
      nextValue: "full document body",
      dispatch: (change) => calls.push(change),
    });
    assert.equal(changed, true);
    assert.deepEqual(calls, [
      { from: 0, to: 5, insert: "full document body" },
    ]);
  });

  it("regression: empty mount then loaded content must replace (Document/Markdown sync)", () => {
    const calls = [];
    const changed = syncEditorValue({
      currentDoc: "",
      nextValue: "# Title\n\nBody\n",
      dispatch: (change) => calls.push(change),
    });
    assert.equal(changed, true);
    assert.equal(calls[0]?.insert, "# Title\n\nBody\n");
  });
});

describe("scheduleEditorMeasure", () => {
  it("double-rAF remasures after 0-height flex mount then cancels cleanly", async () => {
    const calls = [];
    const frames = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      const id = frames.length + 1;
      frames.push(cb);
      return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
      frames[id - 1] = null;
    };
    try {
      const cancel = scheduleEditorMeasure(() => calls.push("m"));
      assert.equal(frames.length, 1);
      frames[0]?.();
      assert.deepEqual(calls, ["m"]);
      assert.equal(frames.length, 2);
      frames[1]?.();
      assert.deepEqual(calls, ["m", "m"]);
      cancel();
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });

  it("does not measure after cancel before frames run (unmount during flex settle)", () => {
    const calls = [];
    const frames = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      const id = frames.length + 1;
      frames.push(cb);
      return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
      frames[id - 1] = null;
    };
    try {
      const cancel = scheduleEditorMeasure(() => calls.push("m"));
      cancel();
      frames[0]?.();
      assert.deepEqual(calls, []);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });
});

describe("observeEditorHostSize", () => {
  it("remasures when the flex host gains size (Split sibling resize path for Document/Markdown)", () => {
    const calls = [];
    const frames = [];
    /** @type {((entries: unknown[]) => void) | null} */
    let observedCb = null;
    const originalRO = globalThis.ResizeObserver;
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;

    globalThis.requestAnimationFrame = (cb) => {
      const id = frames.length + 1;
      frames.push(cb);
      return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
      frames[id - 1] = null;
    };
    globalThis.ResizeObserver = class {
      constructor(cb) {
        observedCb = cb;
      }
      observe() {}
      disconnect() {
        observedCb = null;
      }
      unobserve() {}
    };

    try {
      const host = { nodeType: 1 };
      const disconnect = observeEditorHostSize({
        host: /** @type {Element} */ (host),
        measure: () => calls.push("resize"),
      });
      assert.ok(observedCb, "ResizeObserver should be constructed");
      observedCb?.([]);
      assert.equal(frames.length, 1);
      frames[0]?.();
      assert.deepEqual(calls, ["resize"]);
      disconnect();
    } finally {
      globalThis.ResizeObserver = originalRO;
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });

  it("no-ops when ResizeObserver is unavailable", () => {
    const originalRO = globalThis.ResizeObserver;
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: undefined,
      writable: true,
    });
    try {
      const disconnect = observeEditorHostSize({
        host: /** @type {Element} */ ({ nodeType: 1 }),
        measure: () => {
          assert.fail("should not measure without ResizeObserver");
        },
      });
      disconnect();
    } finally {
      Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        value: originalRO,
        writable: true,
      });
    }
  });
});
