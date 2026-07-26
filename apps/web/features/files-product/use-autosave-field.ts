"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  INITIAL_SAVE_STATE,
  beginSave,
  completeSave,
  failSave,
  markDirty,
} from "@planevo/core/state/editor-state";

const DEFAULT_DEBOUNCE_MS = 500;

/** Compatible with the editor's <SaveIndicator state=…/>. */
export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type UseAutosaveFieldOptions = {
  /** Current persisted value; seeds the field and re-syncs external changes when idle. */
  initial: string;
  /** Persist the trimmed value. Resolve true on success, false to keep it dirty (retry). */
  onSave: (value: string) => Promise<boolean>;
  debounceMs?: number;
  normalize?: (value: string) => string;
};

/**
 * Docs-style debounced autosave for a single text field (folder / file rename).
 * Reuses the page editor's save-state machine (`@planevo/core/state/editor-state`):
 * at most one save in flight; edits during a save queue exactly one follow-up.
 * Returns the field value, a setter that schedules a save, and a status you can
 * feed straight into <SaveIndicator>.
 */
export function useAutosaveField({
  initial,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  normalize = (value) => value.trim(),
}: UseAutosaveFieldOptions) {
  const [value, setValueState] = useState(initial);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const saveState = useRef(INITIAL_SAVE_STATE);
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the latest `flush` so the debounce retry can call it without `flush`
  // referencing itself (which the react-hooks rules forbid).
  const flushRef = useRef<() => void>(() => {});

  // Re-sync to an externally changed persisted value (e.g. after router.refresh),
  // but only while idle so we never clobber an in-progress edit.
  useEffect(() => {
    if (saveState.current.status === "idle") {
      setValueState(initial);
      latest.current = initial;
    }
  }, [initial]);

  const flush = useCallback(async () => {
    const saving = beginSave(saveState.current);
    if (!saving) return;
    saveState.current = saving;
    setStatus("saving");
    const ok = await onSave(normalize(latest.current));
    if (ok) {
      saveState.current = completeSave(saveState.current);
      if (saveState.current.status === "dirty") {
        setStatus("dirty");
        timer.current = setTimeout(() => flushRef.current(), debounceMs);
      } else {
        setStatus("saved");
      }
    } else {
      saveState.current = failSave();
      setStatus("error");
      timer.current = setTimeout(() => flushRef.current(), debounceMs);
    }
  }, [onSave, debounceMs, normalize]);

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  const setValue = useCallback(
    (next: string) => {
      setValueState(next);
      latest.current = next;
      saveState.current = markDirty(saveState.current);
      setStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), debounceMs);
    },
    [flush, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { value, setValue, status };
}
