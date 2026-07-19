import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanupTaskAttachment,
  cleanupTaskAttachmentReservation,
} from "./task-attachment-cleanup.ts";

const TARGET = {
  sourceId: "00000000-0000-4000-8000-000000000009",
  storagePath: "workspace-1/task-file.txt",
};

function cleanupHarness({
  markerFails = false,
  storageFails = false,
  deleteFails = false,
  deleteLeavesSource = false,
} = {}) {
  const failures = {
    markerFails,
    storageFails,
    deleteFails,
    deleteLeavesSource,
  };
  const order = [];
  const sources = new Map([
    [
      TARGET.sourceId,
      {
        cleanupRequired: true,
        lifecycle: "unclaimed",
        failureStage: null,
      },
    ],
  ]);
  const storage = new Set([TARGET.storagePath]);
  const operations = {
    async markPending(_target, failureStage) {
      order.push("mark");
      if (failures.markerFails) throw new Error("marker database failure");
      const source = sources.get(TARGET.sourceId);
      if (!source) throw new Error("source missing");
      source.lifecycle = "cleanup_pending";
      source.failureStage = failureStage;
    },
    async removeStorage(target) {
      order.push("storage");
      if (failures.storageFails) throw new Error("storage unavailable");
      storage.delete(target.storagePath);
    },
    async deleteSource(target) {
      order.push("delete");
      if (failures.deleteFails) throw new Error("database delete failed");
      if (failures.deleteLeavesSource) return false;
      sources.delete(target.sourceId);
      return !sources.has(target.sourceId);
    },
  };
  return { sources, storage, operations, failures, order };
}

test("cleanup removes storage and its source only after both operations succeed", async () => {
  const harness = cleanupHarness();
  const result = await cleanupTaskAttachment(TARGET, harness.operations);

  assert.deepEqual(result, { ok: true, target: TARGET });
  assert.deepEqual(harness.order, ["mark", "storage", "delete"]);
  assert.equal(harness.storage.has(TARGET.storagePath), false);
  assert.equal(harness.sources.has(TARGET.sourceId), false);
});

test("cleanup marker database failure preserves both recoverable resources", async () => {
  const harness = cleanupHarness({ markerFails: true });
  const result = await cleanupTaskAttachment(TARGET, harness.operations);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "database");
  assert.equal(result.operation, "mark_pending");
  assert.equal(harness.storage.has(TARGET.storagePath), true);
  assert.equal(harness.sources.get(TARGET.sourceId).cleanupRequired, true);
});

test("storage failure remains observable on the source and leaves the object recoverable", async () => {
  const harness = cleanupHarness({ storageFails: true });
  const result = await cleanupTaskAttachment(TARGET, harness.operations);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "storage");
  assert.equal(harness.storage.has(TARGET.storagePath), true);
  assert.deepEqual(harness.sources.get(TARGET.sourceId), {
    cleanupRequired: true,
    lifecycle: "cleanup_pending",
    failureStage: "storage",
  });
});

test("source deletion failure never reports success after storage removal", async () => {
  const harness = cleanupHarness({ deleteFails: true });
  const result = await cleanupTaskAttachment(TARGET, harness.operations);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "database");
  assert.equal(result.operation, "delete_source");
  assert.equal(harness.storage.has(TARGET.storagePath), false);
  assert.equal(harness.sources.has(TARGET.sourceId), true);
  assert.equal(harness.sources.get(TARGET.sourceId).lifecycle, "cleanup_pending");
});

test("zero-row source deletion remains pending instead of claiming cleanup", async () => {
  const harness = cleanupHarness({ deleteLeavesSource: true });
  const result = await cleanupTaskAttachment(TARGET, harness.operations);

  assert.equal(result.ok, false);
  assert.equal(result.operation, "delete_source");
  assert.equal(harness.storage.has(TARGET.storagePath), false);
  assert.equal(harness.sources.has(TARGET.sourceId), true);
});

test("cleanup can recover on retry after a source deletion failure", async () => {
  const harness = cleanupHarness({ deleteFails: true });
  const first = await cleanupTaskAttachment(TARGET, harness.operations);
  assert.equal(first.ok, false);
  assert.equal(harness.sources.has(TARGET.sourceId), true);

  harness.failures.deleteFails = false;
  const retry = await cleanupTaskAttachment(TARGET, harness.operations);

  assert.equal(retry.ok, true);
  assert.equal(harness.storage.has(TARGET.storagePath), false);
  assert.equal(harness.sources.has(TARGET.sourceId), false);
});

test("claimed reservation protection leaves Storage and database untouched", async () => {
  const harness = cleanupHarness();

  await assert.rejects(
    cleanupTaskAttachmentReservation(
      TARGET,
      {
        source_kind: "task-attachment",
        task_attachment_state: "claimed",
      },
      harness.operations,
    ),
    /claimed/i,
  );

  assert.deepEqual(harness.order, []);
  assert.equal(harness.storage.has(TARGET.storagePath), true);
  assert.equal(harness.sources.has(TARGET.sourceId), true);
});
