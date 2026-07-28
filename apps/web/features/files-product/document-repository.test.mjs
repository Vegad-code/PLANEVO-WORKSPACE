import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE_URL = new URL("./document-repository.ts", import.meta.url);

test("routes every storage kind through the shared repository boundary", () => {
  const source = readFileSync(SOURCE_URL, "utf8");

  assert.match(source, /export type FileDocumentRepository/);
  assert.match(source, /if \(file\.storage_kind === "local"\)/);
  assert.match(source, /storageKind: file\.storage_kind/);
  assert.match(source, /load: \(signal\) => loadFileDocument/);
  assert.match(source, /save: \(input\) =>/);
  assert.match(source, /saveNote:/);
  assert.match(source, /restoreRevision:/);
});
