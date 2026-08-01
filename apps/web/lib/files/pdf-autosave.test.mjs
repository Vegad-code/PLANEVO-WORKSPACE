import assert from "node:assert/strict";
import test from "node:test";

import {
  PdfAutosaveConflictError,
  createPdfAutosaveCoordinator,
} from "./pdf-autosave.ts";

function bytes(...values) {
  return new Uint8Array(values);
}

test("flush writes the latest PDF bytes to recovery before replacing the source file", async () => {
  const events = [];
  const saved = [];
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-1",
    initialVersion: 4,
    serialize: async () => bytes(80, 75, 3, 4),
    save: async (content, baseVersion, reason) => {
      saved.push({ content: [...content], baseVersion, reason });
      events.push("source");
      return { version: 5 };
    },
    writeRecovery: async ({ content, baseVersion }) => {
      events.push("recovery");
      assert.deepEqual([...content], [80, 75, 3, 4]);
      assert.equal(baseVersion, 4);
    },
    clearRecovery: async () => {
      events.push("clear");
    },
  });

  coordinator.markChanged();
  await coordinator.flush("checkpoint");

  assert.deepEqual(events, ["recovery", "source", "clear"]);
  assert.deepEqual(saved, [
    {
      content: [80, 75, 3, 4],
      baseVersion: 4,
      reason: "checkpoint",
    },
  ]);
  assert.equal(coordinator.getSnapshot().status, "saved");
  assert.equal(coordinator.getSnapshot().version, 5);
});

test("an edit during serialize is stamped as that generation, not the pre-serialize wave", async () => {
  let liveGeneration = 1;
  let releaseSerialize;
  const serializeBlocked = new Promise((resolve) => {
    releaseSerialize = resolve;
  });
  const saved = [];
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-serialize-race",
    initialVersion: 0,
    serialize: async () => {
      await serializeBlocked;
      return bytes(liveGeneration);
    },
    save: async (content, baseVersion) => {
      saved.push({ content: [...content], baseVersion });
      return { version: baseVersion + 1 };
    },
    writeRecovery: async () => {},
    clearRecovery: async () => {},
  });

  coordinator.markChanged();
  const flush = coordinator.flush("checkpoint");
  await Promise.resolve();
  await Promise.resolve();

  // Land generation 2 while serialize for generation 1 is still blocked.
  liveGeneration = 2;
  coordinator.markChanged();
  releaseSerialize();
  await flush;
  await coordinator.whenIdle();

  // Bytes already contain generation 2; stamping after serialize must record
  // generation 2 so the loop does not re-save identical content as a second version.
  assert.deepEqual(saved, [{ content: [2], baseVersion: 0 }]);
  assert.equal(coordinator.getSnapshot().status, "saved");
  assert.equal(coordinator.getSnapshot().version, 1);
});

test("an edit made during a PDF save is serialized and saved as the next version", async () => {
  let generation = 1;
  let releaseFirstSave;
  const firstSaveBlocked = new Promise((resolve) => {
    releaseFirstSave = resolve;
  });
  const saved = [];
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-2",
    initialVersion: 0,
    serialize: async () => bytes(generation),
    save: async (content, baseVersion) => {
      saved.push({ content: [...content], baseVersion });
      if (saved.length === 1) await firstSaveBlocked;
      return { version: baseVersion + 1 };
    },
    writeRecovery: async () => {},
    clearRecovery: async () => {},
  });

  coordinator.markChanged();
  const firstFlush = coordinator.flush("checkpoint");
  await Promise.resolve();
  await Promise.resolve();

  generation = 2;
  coordinator.markChanged();
  releaseFirstSave();
  await firstFlush;
  await coordinator.whenIdle();

  assert.deepEqual(saved, [
    { content: [1], baseVersion: 0 },
    { content: [2], baseVersion: 1 },
  ]);
  assert.equal(coordinator.getSnapshot().status, "saved");
  assert.equal(coordinator.getSnapshot().version, 2);
});

test("keeps a newer recovery generation until that exact generation reaches canonical storage", async () => {
  let generation = 1;
  let releaseFirstSave;
  const firstSaveBlocked = new Promise((resolve) => {
    releaseFirstSave = resolve;
  });
  const recoveries = [];
  const saves = [];
  const clears = [];
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-generation-race",
    initialVersion: 10,
    serialize: async () => bytes(generation),
    writeRecovery: async ({ content }) => {
      recoveries.push([...content]);
    },
    save: async (content, baseVersion) => {
      saves.push({ content: [...content], baseVersion });
      if (saves.length === 1) await firstSaveBlocked;
      return { version: baseVersion + 1 };
    },
    clearRecovery: async () => {
      clears.push(saves.length);
    },
  });

  coordinator.markChanged();
  const flush = coordinator.flush("checkpoint");
  await Promise.resolve();
  await Promise.resolve();

  generation = 2;
  coordinator.markChanged();
  releaseFirstSave();
  await flush;

  assert.deepEqual(recoveries, [[1], [2]]);
  assert.deepEqual(saves, [
    { content: [1], baseVersion: 10 },
    { content: [2], baseVersion: 11 },
  ]);
  assert.deepEqual(clears, [2]);
});

test("a version conflict keeps the recovery snapshot and never retries automatically", async () => {
  let saveAttempts = 0;
  let recoveryClears = 0;
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-3",
    initialVersion: 7,
    serialize: async () => bytes(7, 7, 7),
    save: async () => {
      saveAttempts += 1;
      throw new PdfAutosaveConflictError("The original changed on disk.");
    },
    writeRecovery: async () => {},
    clearRecovery: async () => {
      recoveryClears += 1;
    },
  });

  coordinator.markChanged();
  await assert.rejects(
    () => coordinator.flush("checkpoint"),
    (error) =>
      error instanceof PdfAutosaveConflictError &&
      error.message === "The original changed on disk.",
  );
  await coordinator.whenIdle();

  assert.equal(saveAttempts, 1);
  assert.equal(recoveryClears, 0);
  assert.deepEqual(coordinator.getSnapshot(), {
    status: "conflict",
    error: "The original changed on disk.",
    version: 7,
  });
});

test("flush rejects on conflict so close can soft-block instead of discarding edits", async () => {
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-conflict-close",
    initialVersion: 3,
    serialize: async () => bytes(1, 2, 3),
    save: async () => {
      throw new PdfAutosaveConflictError("Another tab saved this PDF.");
    },
    writeRecovery: async () => {},
    clearRecovery: async () => {},
  });

  coordinator.markChanged();
  await assert.rejects(
    () => coordinator.flush("close"),
    (error) =>
      error instanceof PdfAutosaveConflictError &&
      error.message === "Another tab saved this PDF.",
  );

  // Later edits stay wedged in conflict — every subsequent close flush must
  // keep rejecting so the panel cannot silently destroy them.
  coordinator.markChanged();
  await assert.rejects(
    () => coordinator.flush("close"),
    (error) =>
      error instanceof PdfAutosaveConflictError &&
      error.message === "Another tab saved this PDF.",
  );
  assert.equal(coordinator.getSnapshot().status, "conflict");
  assert.equal(coordinator.getSnapshot().version, 3);
});

test("flush rejects on unrecoverable save failure so close stays open", async () => {
  let saveAttempts = 0;
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-save-error",
    initialVersion: 1,
    serialize: async () => bytes(4, 5, 6),
    save: async () => {
      saveAttempts += 1;
      throw new Error("Storage quota exceeded.");
    },
    writeRecovery: async () => {},
    clearRecovery: async () => {},
  });

  coordinator.markChanged();
  await assert.rejects(
    () => coordinator.flush("close"),
    (error) =>
      error instanceof Error && error.message === "Storage quota exceeded.",
  );
  assert.deepEqual(coordinator.getSnapshot(), {
    status: "error",
    error: "Storage quota exceeded.",
    version: 1,
  });

  // Error (unlike conflict) may retry on a later flush — still rejects if save fails again.
  await assert.rejects(
    () => coordinator.flush("close"),
    (error) =>
      error instanceof Error && error.message === "Storage quota exceeded.",
  );
  assert.equal(saveAttempts, 2);
  assert.equal(coordinator.getSnapshot().status, "error");
});

test("captureRecovery serializes a durable draft without overwriting the PDF", async () => {
  let sourceWrites = 0;
  const recoveries = [];
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-4",
    initialVersion: 2,
    serialize: async () => bytes(9, 8, 7),
    save: async () => {
      sourceWrites += 1;
      return { version: 3 };
    },
    writeRecovery: async (draft) => {
      recoveries.push({
        content: [...draft.content],
        baseVersion: draft.baseVersion,
      });
    },
    clearRecovery: async () => {},
  });

  coordinator.markChanged();
  await coordinator.captureRecovery();

  assert.equal(sourceWrites, 0);
  assert.deepEqual(recoveries, [
    { content: [9, 8, 7], baseVersion: 2 },
  ]);
  assert.equal(coordinator.getSnapshot().status, "dirty");
});

test("a recovery write failure aborts the source replace and keeps the draft path honest", async () => {
  let saveAttempts = 0;
  let recoveryClears = 0;
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-recovery-abort",
    initialVersion: 5,
    serialize: async () => bytes(1, 2, 3),
    save: async () => {
      saveAttempts += 1;
      return { version: 6 };
    },
    writeRecovery: async () => {
      throw new Error("IndexedDB quota exceeded.");
    },
    clearRecovery: async () => {
      recoveryClears += 1;
    },
  });

  coordinator.markChanged();
  await assert.rejects(
    () => coordinator.flush("checkpoint"),
    (error) =>
      error instanceof Error && error.message === "IndexedDB quota exceeded.",
  );
  await coordinator.whenIdle();

  assert.equal(saveAttempts, 0);
  assert.equal(recoveryClears, 0);
  assert.deepEqual(coordinator.getSnapshot(), {
    status: "error",
    error: "IndexedDB quota exceeded.",
    version: 5,
  });
});

test("recovery and source adapters receive independent copies, not the serializer buffer", async () => {
  const serializerBuffer = bytes(10, 20, 30);
  let recoveryBuffer = null;
  let saveBuffer = null;
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-copy-isolation",
    initialVersion: 1,
    serialize: async () => serializerBuffer,
    save: async (content) => {
      saveBuffer = content;
      // Mutating the save adapter's buffer must not corrupt recovery's copy.
      content[0] = 99;
      return { version: 2 };
    },
    writeRecovery: async ({ content }) => {
      recoveryBuffer = content;
      content[1] = 88;
    },
    clearRecovery: async () => {},
  });

  coordinator.markChanged();
  await coordinator.flush("checkpoint");

  assert.ok(recoveryBuffer);
  assert.ok(saveBuffer);
  assert.notEqual(recoveryBuffer, serializerBuffer);
  assert.notEqual(saveBuffer, serializerBuffer);
  assert.notEqual(recoveryBuffer, saveBuffer);
  // Serializer-owned bytes stay pristine; each adapter only saw its own copy.
  assert.deepEqual([...serializerBuffer], [10, 20, 30]);
  assert.deepEqual([...recoveryBuffer], [10, 88, 30]);
  assert.deepEqual([...saveBuffer], [99, 20, 30]);
});

test("concurrent flush calls coalesce onto one in-flight save wave", async () => {
  let saveAttempts = 0;
  let releaseSave;
  const saveBlocked = new Promise((resolve) => {
    releaseSave = resolve;
  });
  const coordinator = createPdfAutosaveCoordinator({
    fileSourceId: "file-flush-coalesce",
    initialVersion: 0,
    serialize: async () => bytes(42),
    save: async () => {
      saveAttempts += 1;
      await saveBlocked;
      return { version: 1 };
    },
    writeRecovery: async () => {},
    clearRecovery: async () => {},
  });

  coordinator.markChanged();
  const first = coordinator.flush("checkpoint");
  const second = coordinator.flush("close");
  assert.equal(first, second);

  releaseSave();
  await first;
  await coordinator.whenIdle();

  assert.equal(saveAttempts, 1);
  assert.equal(coordinator.getSnapshot().status, "saved");
});
