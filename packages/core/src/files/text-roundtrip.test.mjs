import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeEditableText,
  encodeEditableText,
} from "./text-roundtrip.ts";

test("round-trips UTF-8 text without changing line endings or trailing newline", () => {
  for (const source of [
    "alpha\nbeta\n",
    "alpha\r\nbeta\r\n",
    "alpha\nbeta",
    "emoji: 🧭\naccents: café\n",
    "",
  ]) {
    const bytes = new TextEncoder().encode(source);
    const decoded = decodeEditableText(bytes);
    assert.equal(new TextDecoder().decode(encodeEditableText(decoded)), source);
  }
});

test("preserves a UTF-8 byte-order mark", () => {
  const body = new TextEncoder().encode("heading\r\nbody\r\n");
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...body]);

  const decoded = decodeEditableText(bytes);

  assert.equal(decoded.hasUtf8Bom, true);
  assert.equal(decoded.newline, "crlf");
  assert.deepEqual(encodeEditableText(decoded), bytes);
});

test("normalizes editor newlines back to the source newline convention", () => {
  const decoded = decodeEditableText(
    new TextEncoder().encode("first\r\nsecond\r\n"),
  );

  const saved = encodeEditableText({
    ...decoded,
    text: "first\nchanged\nthird\n",
  });

  assert.equal(
    new TextDecoder().decode(saved),
    "first\r\nchanged\r\nthird\r\n",
  );
});
