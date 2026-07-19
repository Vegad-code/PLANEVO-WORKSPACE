import assert from "node:assert/strict";
import { test } from "node:test";
import {
  discardTaskAttachmentUploads,
  TaskAttachmentCleanupError,
} from "./task-attachment-client.ts";

const TARGETS = [
  {
    sourceId: "00000000-0000-4000-8000-000000000009",
    storagePath: "workspace-1/task-file.txt",
  },
];

test("HTTP cleanup success requires the server to confirm every target", async () => {
  const requests = [];
  const fetcher = async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ removed: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await discardTaskAttachmentUploads(TARGETS, fetcher);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/task-attachments");
  assert.deepEqual(JSON.parse(requests[0].init.body), { uploads: TARGETS });
});

test("HTTP cleanup network failure exposes every pending target", async () => {
  const fetcher = async () => {
    throw new Error("network offline");
  };

  await assert.rejects(
    discardTaskAttachmentUploads(TARGETS, fetcher),
    (error) =>
      error instanceof TaskAttachmentCleanupError &&
      error.pendingTargets === TARGETS &&
      /network offline/.test(error.message),
  );
});

test("HTTP cleanup error response remains observable and recoverable", async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ error: "Cleanup remains pending." }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    discardTaskAttachmentUploads(TARGETS, fetcher),
    (error) =>
      error instanceof TaskAttachmentCleanupError &&
      error.pendingTargets === TARGETS &&
      /remains pending/.test(error.message),
  );
});

test("HTTP cleanup never accepts a partial success response", async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ removed: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    discardTaskAttachmentUploads(TARGETS, fetcher),
    (error) =>
      error instanceof TaskAttachmentCleanupError &&
      /did not confirm/.test(error.message),
  );
});

test("HTTP cleanup never accepts a malformed success response", async () => {
  const fetcher = async () =>
    new Response("not json", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });

  await assert.rejects(
    discardTaskAttachmentUploads(TARGETS, fetcher),
    (error) =>
      error instanceof TaskAttachmentCleanupError &&
      /did not confirm/.test(error.message),
  );
});
