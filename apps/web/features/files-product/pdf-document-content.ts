export function pdfBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  return null;
}

export function suggestedPdfCopyName(fileName: string): string {
  const trimmedName = fileName.trim();
  const withoutExtension = trimmedName.replace(/\.pdf$/i, "").trim();
  const baseName = withoutExtension || "Document";
  return `${baseName} copy.pdf`;
}

export function describePdfOpenError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/password|encrypt/.test(message)) {
    return "This PDF is password-protected. Remove its password, then open it again.";
  }
  if (/corrupt|invalid pdf|malformed|unexpected end|%%eof/.test(message)) {
    return "This PDF appears to be damaged or incomplete. Try opening a fresh copy.";
  }
  return "Planevo could not open this PDF. The original file has not been changed.";
}
