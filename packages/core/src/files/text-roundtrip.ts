export type EditableTextDocument = {
  /** Editor-facing text. Newlines are normalized to LF while editing. */
  text: string;
  hasUtf8Bom: boolean;
  newline: "lf" | "crlf";
  trailingNewline: boolean;
};

const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

function startsWithUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= UTF8_BOM.byteLength &&
    UTF8_BOM.every((byte, index) => bytes[index] === byte)
  );
}

export function decodeEditableText(bytes: Uint8Array): EditableTextDocument {
  const hasUtf8Bom = startsWithUtf8Bom(bytes);
  const body = hasUtf8Bom ? bytes.subarray(UTF8_BOM.byteLength) : bytes;
  const sourceText = new TextDecoder("utf-8", { fatal: true }).decode(body);
  const newline = sourceText.includes("\r\n") ? "crlf" : "lf";

  return {
    text: sourceText.replaceAll("\r\n", "\n"),
    hasUtf8Bom,
    newline,
    trailingNewline: sourceText.endsWith("\n"),
  };
}

export function encodeEditableText(
  document: EditableTextDocument,
): Uint8Array {
  const normalized = document.text.replaceAll("\r\n", "\n");
  const sourceText =
    document.newline === "crlf"
      ? normalized.replaceAll("\n", "\r\n")
      : normalized;
  const body = new TextEncoder().encode(sourceText);

  if (!document.hasUtf8Bom) return body;

  const bytes = new Uint8Array(UTF8_BOM.byteLength + body.byteLength);
  bytes.set(UTF8_BOM);
  bytes.set(body, UTF8_BOM.byteLength);
  return bytes;
}
