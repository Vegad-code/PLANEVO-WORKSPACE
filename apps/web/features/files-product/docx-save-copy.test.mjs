import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCX_CONTENT_TYPE,
  assertDocxCopyUsesDistinctFileSource,
  decodeDocxBytesBase64,
  encodeDocxBytesBase64,
  saveDocxCopy,
  saveDocxCopyToFiles,
} from "./docx-save-copy.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("opens the native Save picker before awaiting DOCX serialization", async () => {
  const pickerResult = deferred();
  const events = [];
  const writes = [];
  let pickerOptions = null;

  const operation = saveDocxCopy({
    suggestedName: "Plan.docx",
    serialize: async () => {
      events.push("serialize");
      return new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    },
    showSaveFilePicker: (options) => {
      pickerOptions = options;
      events.push("picker");
      return pickerResult.promise;
    },
    download: () => {
      throw new Error("native picker must not download");
    },
  });

  assert.deepEqual(events, ["picker"]);
  pickerResult.resolve({
    createWritable: async () => ({
      write: async (content) => {
        events.push("write");
        writes.push(new Uint8Array(content));
      },
      close: async () => {
        events.push("close");
      },
    }),
  });

  assert.equal(await operation, "saved");
  assert.deepEqual(events, ["picker", "serialize", "write", "close"]);
  assert.deepEqual([...writes[0]], [0x50, 0x4b, 0x03, 0x04]);
  assert.deepEqual(pickerOptions, {
    suggestedName: "Plan copy.docx",
    types: [
      {
        description: "Word document",
        accept: {
          [DOCX_CONTENT_TYPE]: [".docx"],
        },
      },
    ],
  });
});

test("uses a DOCX download only when the native picker is unavailable", async () => {
  const downloads = [];

  const result = await saveDocxCopy({
    suggestedName: "Plan",
    serialize: async () => new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    download: (copy) => downloads.push(copy),
  });

  assert.equal(result, "downloaded");
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].fileName, "Plan copy.docx");
  assert.equal(downloads[0].contentType, DOCX_CONTENT_TYPE);
  assert.deepEqual([...downloads[0].bytes], [0x50, 0x4b, 0x05, 0x06]);
});

test("treats closing the native picker as cancellation and leaves the source untouched", async () => {
  let serialized = false;
  const cancellation = new Error("The user aborted a request");
  cancellation.name = "AbortError";

  const result = await saveDocxCopy({
    suggestedName: "Plan.docx",
    serialize: async () => {
      serialized = true;
      return new Uint8Array([0x50, 0x4b]);
    },
    showSaveFilePicker: async () => {
      throw cancellation;
    },
    download: () => {
      throw new Error("cancelled picker must not download");
    },
  });

  assert.equal(result, "cancelled");
  assert.equal(serialized, false);
});

test("aborts an incomplete native copy when its write fails", async () => {
  const events = [];

  await assert.rejects(
    saveDocxCopy({
      suggestedName: "Plan.docx",
      serialize: async () => new Uint8Array([0x50, 0x4b]),
      showSaveFilePicker: async () => ({
        createWritable: async () => ({
          write: async () => {
            events.push("write");
            throw new Error("disk full");
          },
          close: async () => {
            events.push("close");
          },
          abort: async () => {
            events.push("abort");
          },
        }),
      }),
      download: () => {
        throw new Error("native write failure must not download");
      },
    }),
    /disk full/,
  );

  assert.deepEqual(events, ["write", "abort"]);
});

test("serializes once before creating a DOCX copy in Files", async () => {
  const events = [];
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

  const result = await saveDocxCopyToFiles({
    suggestedName: "Plan.docx",
    serialize: async () => {
      events.push("serialize");
      return bytes;
    },
    createInFiles: async (copy) => {
      events.push("create");
      assert.equal(copy.fileName, "Plan copy.docx");
      assert.equal(copy.contentType, DOCX_CONTENT_TYPE);
      assert.deepEqual([...copy.bytes], [...bytes]);
      return { fileSourceId: "copy-id", fileName: copy.fileName };
    },
  });

  assert.deepEqual(events, ["serialize", "create"]);
  assert.deepEqual(result, {
    fileSourceId: "copy-id",
    fileName: "Plan copy.docx",
  });
});

test("propagates Files copy creation failures after serialization", async () => {
  await assert.rejects(
    saveDocxCopyToFiles({
      suggestedName: "Plan.docx",
      serialize: async () => new Uint8Array([0x50, 0x4b]),
      createInFiles: async () => {
        throw new Error("storage full");
      },
    }),
    /storage full/,
  );
});

test("round-trips DOCX bytes through base64 helpers", () => {
  const bytes = new Uint8Array([0, 80, 75, 255, 3, 4]);
  const encoded = encodeDocxBytesBase64(bytes);
  assert.deepEqual([...decodeDocxBytesBase64(encoded)], [...bytes]);
});

test("Files copy rejects a created id that matches the source file", () => {
  const fileSourceId = "11111111-1111-4111-8111-111111111111";
  assert.throws(
    () =>
      assertDocxCopyUsesDistinctFileSource({
        sourceFileSourceId: fileSourceId,
        createdFileSourceId: fileSourceId,
      }),
    /new Files entry/,
  );
});

test("Files copy keeps the created file source distinct from the source id", async () => {
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const copyId = "22222222-2222-4222-8222-222222222222";

  const result = await saveDocxCopyToFiles({
    suggestedName: "Plan.docx",
    serialize: async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    createInFiles: async (copy) => {
      assertDocxCopyUsesDistinctFileSource({
        sourceFileSourceId: sourceId,
        createdFileSourceId: copyId,
      });
      return { fileSourceId: copyId, fileName: copy.fileName };
    },
  });

  assert.notEqual(result.fileSourceId, sourceId);
  assert.equal(result.fileSourceId, copyId);
});
