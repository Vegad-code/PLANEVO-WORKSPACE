import assert from "node:assert/strict";
import { test } from "node:test";
import { attachFileToEvent, linkFileToTask } from "./file-cross-links.ts";
import { deleteFileSource, updateFileTags } from "./product-files.ts";

test("attachFileToEvent inserts a calendar_event link and tolerates re-attach", async () => {
  let inserted = null;
  const clientOk = {
    from: (table) => {
      assert.equal(table, "file_links");
      return {
        insert: async (row) => {
          inserted = row;
          return { error: null };
        },
      };
    },
  };
  await attachFileToEvent(clientOk, { eventId: "e1", fileSourceId: "f1" });
  assert.deepEqual(inserted, {
    file_source_id: "f1",
    target_type: "calendar_event",
    target_id: "e1",
  });

  const clientDup = {
    from: () => ({ insert: async () => ({ error: { code: "23505" } }) }),
  };
  await attachFileToEvent(clientDup, { eventId: "e1", fileSourceId: "f1" });

  const clientBroken = {
    from: () => ({ insert: async () => ({ error: { code: "42501", message: "denied" } }) }),
  };
  await assert.rejects(() =>
    attachFileToEvent(clientBroken, { eventId: "e1", fileSourceId: "f1" }),
  );
});

test("linkFileToTask targets tasks through the shared attach helper", async () => {
  let inserted = null;
  const client = {
    from: () => ({
      insert: async (row) => {
        inserted = row;
        return { error: null };
      },
    }),
  };
  await linkFileToTask(client, { taskId: "t1", fileSourceId: "f1" });
  assert.equal(inserted.target_type, "task");
  assert.equal(inserted.target_id, "t1");
});

test("updateFileTags merges tags into existing metadata", async () => {
  let patch = null;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({
              data: { metadata_json: { folder: "Design", tags: ["old"] } },
              error: null,
            }),
          }),
        }),
      }),
      update: (value) => {
        patch = value;
        return {
          eq: () => ({ eq: async () => ({ error: null }) }),
        };
      },
    }),
  };
  await updateFileTags(client, "u1", "f1", ["logo", "brand"]);
  assert.equal(patch.metadata_json.folder, "Design");
  assert.deepEqual(patch.metadata_json.tags, ["logo", "brand"]);
});

test("deleteFileSource returns the storage path for object cleanup", async () => {
  const filters = {};
  const client = {
    from: () => ({
      delete: () => ({
        eq: (col, val) => {
          filters[col] = val;
          return {
            eq: (col2, val2) => {
              filters[col2] = val2;
              return {
                select: () => ({
                  single: async () => ({
                    data: { storage_path: "w1/report.pdf" },
                    error: null,
                  }),
                }),
              };
            },
          };
        },
      }),
    }),
  };
  const result = await deleteFileSource(client, "u1", "f1");
  assert.equal(result.storagePath, "w1/report.pdf");
  assert.equal(filters.id, "f1");
  assert.equal(filters.user_id, "u1");
});
