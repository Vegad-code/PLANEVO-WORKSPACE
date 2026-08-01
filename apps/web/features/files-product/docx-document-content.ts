export function docxBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  return null;
}

export function suggestedDocxCopyName(fileName: string): string {
  const trimmedName = fileName.trim();
  const withoutExtension = trimmedName.replace(/\.docx$/i, "").trim();
  const baseName = withoutExtension || "Document";
  return `${baseName} copy.docx`;
}

export function describeDocxOpenError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/password|encrypt/.test(message)) {
    return "This DOCX is password-protected. Remove its password in Word, then open it again.";
  }
  if (/corrupt|central directory|invalid zip|malformed|unexpected end/.test(message)) {
    return "This DOCX appears to be damaged or incomplete. Try opening a fresh copy.";
  }
  return "Planevo could not open this DOCX. The original file has not been changed.";
}
