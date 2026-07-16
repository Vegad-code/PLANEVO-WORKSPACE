export type RecordPeekMode = "center" | "side";

export type RecordPeekState = {
  recordId: string;
  mode: RecordPeekMode;
};

export const DEFAULT_RECORD_PEEK_MODE: RecordPeekMode = "center";
export const RECORD_PEEK_MODE_STORAGE_KEY = "planevo.record-peek.mode";

export function normalizeRecordPeekMode(
  value: string | null | undefined,
): RecordPeekMode {
  return value === "side" ? "side" : "center";
}

export function parseRecordPeekSearchParams(params: {
  p?: string | string[] | undefined;
  peek?: string | string[] | undefined;
}): RecordPeekState | null {
  const recordId = firstParam(params.p)?.trim();
  if (!recordId) return null;
  return {
    recordId,
    mode: normalizeRecordPeekMode(firstParam(params.peek)),
  };
}

export function buildRecordPeekSearchParams(
  current: URLSearchParams,
  next: RecordPeekState | null,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  if (!next) {
    params.delete("p");
    params.delete("peek");
    return params;
  }
  params.set("p", next.recordId);
  params.set("peek", next.mode);
  return params;
}

export function reduceRecordPeekMode(
  state: RecordPeekState,
  mode: RecordPeekMode,
): RecordPeekState {
  return { ...state, mode };
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
