"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DocumentVersionConflictError,
  type FileDocumentSaveResult,
} from "./document-client";
import {
  clearDocumentRecoveryDraft,
  writeDocumentRecoveryDraft,
} from "./document-recovery";

export type DocumentSaveStatus =
  "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

const AUTOSAVE_IDLE_MS = 750;
const RETRY_DELAYS_MS = [1000, 2500, 5000] as const;

export function useDocumentAutosave<T>(input: {
  fileSourceId: string;
  initialVersion: number;
  initialContent: T;
  onSave: (
    content: T,
    baseVersion: number,
    reason: "checkpoint" | "close",
  ) => Promise<FileDocumentSaveResult>;
}) {
  const [content, setContentState] = useState(input.initialContent);
  const [status, setStatus] = useState<DocumentSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mirrorSaved, setMirrorSaved] = useState(false);
  const [mirrorError, setMirrorError] = useState<string | null>(null);
  const latestContent = useRef(input.initialContent);
  const version = useRef(input.initialVersion);
  const dirty = useRef(false);
  const queued = useRef(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const retryCount = useRef(0);
  const timer = useRef<number | null>(null);
  const flushRef = useRef<(reason?: "checkpoint" | "close") => Promise<void>>(
    async () => {},
  );

  const clearTimer = useCallback(() => {
    if (!timer.current) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback(
    (delay = AUTOSAVE_IDLE_MS) => {
      clearTimer();
      timer.current = window.setTimeout(
        () => void flushRef.current("checkpoint"),
        delay,
      );
    },
    [clearTimer],
  );

  const flush = useCallback(
    async (reason: "checkpoint" | "close" = "checkpoint") => {
      clearTimer();
      if (saving.current) {
        queued.current = true;
        return;
      }
      if (!dirty.current) return;

      saving.current = true;
      dirty.current = false;
      const savingContent = latestContent.current;
      const baseVersion = version.current;
      setStatus("saving");
      setError(null);

      try {
        const result = await input.onSave(savingContent, baseVersion, reason);
        version.current = result.version;
        retryCount.current = 0;
        const hasPendingContent = queued.current || dirty.current;
        if (!mounted.current) {
          if (hasPendingContent) {
            await writeDocumentRecoveryDraft({
              fileSourceId: input.fileSourceId,
              baseVersion: result.version,
              content: latestContent.current,
              updatedAt: new Date().toISOString(),
            });
          } else {
            await clearDocumentRecoveryDraft(input.fileSourceId);
          }
          return;
        }
        setMirrorSaved(result.mirrorSaved === true);
        setMirrorError(result.mirrorError ?? null);

        if (hasPendingContent) {
          queued.current = false;
          dirty.current = true;
          await writeDocumentRecoveryDraft({
            fileSourceId: input.fileSourceId,
            baseVersion: result.version,
            content: latestContent.current,
            updatedAt: new Date().toISOString(),
          });
          setStatus("dirty");
          schedule(0);
        } else {
          await clearDocumentRecoveryDraft(input.fileSourceId);
          setStatus("saved");
        }
      } catch (cause) {
        dirty.current = true;
        if (!mounted.current) return;
        if (cause instanceof DocumentVersionConflictError) {
          setStatus("conflict");
          setError(cause.message);
        } else {
          const message =
            cause instanceof Error
              ? cause.message
              : "Could not save this document.";
          setStatus("error");
          setError(message);
          const retryDelay = RETRY_DELAYS_MS[retryCount.current];
          if (retryDelay !== undefined) {
            retryCount.current += 1;
            schedule(retryDelay);
          }
        }
      } finally {
        saving.current = false;
      }
    },
    [clearTimer, input, schedule],
  );

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const setContent = useCallback(
    (next: T) => {
      latestContent.current = next;
      setContentState(next);
      dirty.current = true;
      if (saving.current) queued.current = true;
      retryCount.current = 0;
      setStatus("dirty");
      setError(null);
      setMirrorError(null);
      void writeDocumentRecoveryDraft({
        fileSourceId: input.fileSourceId,
        baseVersion: version.current,
        content: next,
        updatedAt: new Date().toISOString(),
      });
      schedule();
    },
    [input.fileSourceId, schedule],
  );

  const retry = useCallback(() => {
    retryCount.current = 0;
    void flush("checkpoint");
  }, [flush]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void flushRef.current("checkpoint");
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void flushRef.current("close");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimer();
      void flushRef.current("close");
      mounted.current = false;
    };
  }, [clearTimer]);

  return {
    content,
    setContent,
    status,
    error,
    mirrorSaved,
    mirrorError,
    retry,
    flush,
    currentVersion: () => version.current,
  };
}
