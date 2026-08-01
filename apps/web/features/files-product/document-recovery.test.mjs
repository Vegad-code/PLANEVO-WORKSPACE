import assert from "node:assert/strict";
import test from "node:test";

import { createDocumentRecoveryWriter } from "./document-recovery-writer.ts";

function draft() {
  return {
    fileSourceId: "docx-file",
    baseVersion: 4,
    content: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
}

function storage({ available = true, openError = null, putError = null, abortError = null } = {}) {
  const state = { puts: [], closes: 0 };
  return {
    state,
    adapter: {
      isAvailable: () => available,
      recoveryStoreName: "document-recovery",
      deletionStoreName: "file-deletion-tombstones",
      open: async () => {
        if (openError) throw openError;
        const transaction = {
          error: abortError,
          oncomplete: null,
          onerror: null,
          onabort: null,
          objectStore: (name) => {
            if (name === "file-deletion-tombstones") {
              const request = { result: undefined, onsuccess: null };
              queueMicrotask(() => request.onsuccess?.());
              return { get: () => request };
            }
            return {
              put: (value) => {
                if (putError) {
                  // Real IDB reports put failures on the transaction, not as a sync throw.
                  queueMicrotask(() => {
                    transaction.error = putError;
                    transaction.onerror?.();
                  });
                  return { onerror: null, onsuccess: null };
                }
                state.puts.push(value);
                queueMicrotask(() => {
                  if (abortError) {
                    transaction.error = abortError;
                    transaction.onabort?.();
                    return;
                  }
                  transaction.oncomplete?.();
                });
                return { onerror: null, onsuccess: null };
              },
            };
          },
        };
        return {
          transaction: () => transaction,
          close: () => {
            state.closes += 1;
          },
        };
      },
    },
  };
}

test("strict DOCX recovery rejects when browser storage is unavailable while legacy recovery stays best effort", async () => {
  const fake = storage({ available: false });
  const writer = createDocumentRecoveryWriter(fake.adapter);

  await assert.rejects(writer.writeStrict(draft()), /unavailable/i);
  await writer.writeBestEffort(draft());
  assert.deepEqual(fake.state.puts, []);
});

test("strict DOCX recovery surfaces IndexedDB open, put, and abort failures", async () => {
  for (const error of [
    new Error("open failed"),
    new Error("quota exceeded"),
    new Error("transaction aborted"),
  ]) {
    const fake =
      error.message === "open failed"
        ? storage({ openError: error })
        : error.message === "quota exceeded"
          ? storage({ putError: error })
          : storage({ abortError: error });
    const writer = createDocumentRecoveryWriter(fake.adapter);

    await assert.rejects(writer.writeStrict(draft()), error);
    assert.equal(fake.state.closes, error.message === "open failed" ? 0 : 1);
  }
});

test("strict DOCX recovery resolves only after the recovery record commits", async () => {
  const fake = storage();
  const writer = createDocumentRecoveryWriter(fake.adapter);

  await writer.writeStrict(draft());

  assert.equal(fake.state.puts.length, 1);
  assert.equal(fake.state.puts[0].fileSourceId, "docx-file");
  assert.equal(fake.state.closes, 1);
});
