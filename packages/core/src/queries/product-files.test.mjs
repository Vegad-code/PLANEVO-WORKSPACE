import assert from "node:assert/strict";
import { test } from "node:test";
import { loadProductFiles, summarizeStorageBytes } from "./product-files.ts";
import { matchesFileFilterTab, mimeFamily } from "../types/files.ts";
import {
  STORAGE_CAP_BYTES_BY_PLAN,
  exceedsStorageCap,
} from "../types/plans.ts";

function fileRow(overrides = {}) {
  return {
    id: "f1", workspace_id: "w1", page_id: null, created_by: "u1", user_id: "u1",
    operation_key: null, reservation_expires_at: null, storage_path: "w1/a.pdf",
    name: "a.pdf", mime_type: "application/pdf", size_bytes: 100,
    ingestion_status: "ready", metadata_json: {}, created_at: "2026-07-01",
    updated_at: "2026-07-01",
    ...overrides,
  };
}

test("loadProductFiles returns user files newest first with folder and tags lifted", async () => {
  const rows = [
    fileRow({ id: "f2", name: "b.png", mime_type: "image/png",
      metadata_json: { folder: "Design", tags: ["logo", 7] }, created_at: "2026-07-02" }),
    fileRow(),
  ];
  const client = {
    from: (table) => {
      assert.equal(table, "file_sources");
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: rows, error: null }),
            }),
          }),
        }),
      };
    },
  };
  const result = await loadProductFiles(client, "u1");
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "f2");
  assert.equal(result[0].folder, "Design");
  assert.deepEqual(result[0].tags, ["logo"]);
  assert.equal(result[1].folder, null);
  assert.deepEqual(result[1].tags, []);
});

test("loadProductFiles hides unclaimed task-attachment reservations", async () => {
  const rows = [
    fileRow({ id: "hidden", metadata_json: { source_kind: "task-attachment" } }),
    fileRow({ id: "claimed", metadata_json: {
      source_kind: "task-attachment", task_attachment_state: "claimed" } }),
  ];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: rows, error: null }) }),
        }),
      }),
    }),
  };
  const result = await loadProductFiles(client, "u1");
  assert.deepEqual(result.map((file) => file.id), ["claimed"]);
});

test("loadProductFiles workspace scope includes files in that workspace", async () => {
  const rows = [fileRow({ workspace_id: "w1" })];
  const queriedTables = [];
  const client = {
    from: (table) => {
      queriedTables.push(table);
      if (table === "workspace_links") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      };
    },
  };
  const result = await loadProductFiles(client, "u1", { workspaceId: "w1" });
  assert.ok(queriedTables.includes("file_sources"));
  assert.equal(result.length, 1);
});

test("summarizeStorageBytes sums sizes treating null as zero", () => {
  const total = summarizeStorageBytes([
    { size_bytes: 100 },
    { size_bytes: null },
    { size_bytes: 50 },
  ]);
  assert.equal(total, 150);
});

test("exceedsStorageCap gates uploads at the plan cap", () => {
  const freeCap = STORAGE_CAP_BYTES_BY_PLAN.free;
  // Exactly filling the cap is allowed; one byte over is not.
  assert.equal(exceedsStorageCap(freeCap - 10, 10, "free"), false);
  assert.equal(exceedsStorageCap(freeCap - 10, 11, "free"), true);
  assert.equal(exceedsStorageCap(freeCap, 1, "free"), true);
  // A payload that fits free also fits the larger plans.
  assert.equal(exceedsStorageCap(freeCap, 1, "plus"), false);
  assert.equal(exceedsStorageCap(freeCap, 1, "pro"), false);
  // Plans are strictly larger free < plus < pro.
  assert.ok(STORAGE_CAP_BYTES_BY_PLAN.free < STORAGE_CAP_BYTES_BY_PLAN.plus);
  assert.ok(STORAGE_CAP_BYTES_BY_PLAN.plus < STORAGE_CAP_BYTES_BY_PLAN.pro);
});

test("mimeFamily buckets MIME types into filter tabs", () => {
  assert.equal(mimeFamily("image/png"), "images");
  assert.equal(mimeFamily("application/pdf"), "pdfs");
  assert.equal(mimeFamily("text/plain"), "documents");
  assert.equal(mimeFamily(null), "documents");
  assert.ok(matchesFileFilterTab("image/png", "all"));
  assert.ok(matchesFileFilterTab("image/png", "images"));
  assert.ok(!matchesFileFilterTab("image/png", "pdfs"));
});
