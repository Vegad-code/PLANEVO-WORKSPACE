"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DisplayRecord } from "@planevo/core/queries/record-display";
import {
  buildRecordPeekSearchParams,
  DEFAULT_RECORD_PEEK_MODE,
  normalizeRecordPeekMode,
  parseRecordPeekSearchParams,
  RECORD_PEEK_MODE_STORAGE_KEY,
  type RecordPeekMode,
  type RecordPeekState,
} from "@planevo/core/state/record-peek-state";
import { Icon } from "@/components/ui/planevo-icon";

type RecordPeekProps = {
  records: DisplayRecord[];
  databaseId?: string;
  pageId?: string | null;
};

export function RecordPeek({ records, pageId }: RecordPeekProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const peek = useMemo(
    () =>
      parseRecordPeekSearchParams({
        p: searchParams.get("p") ?? undefined,
        peek: searchParams.get("peek") ?? undefined,
      }),
    [searchParams],
  );

  const record = peek
    ? records.find((item) => item.id === peek.recordId) ?? null
    : null;

  const replacePeek = useCallback(
    (next: RecordPeekState | null) => {
      const params = buildRecordPeekSearchParams(
        new URLSearchParams(searchParams.toString()),
        next,
      );
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const close = useCallback(() => replacePeek(null), [replacePeek]);

  const setMode = useCallback(
    (mode: RecordPeekMode) => {
      if (!peek) return;
      localStorage.setItem(RECORD_PEEK_MODE_STORAGE_KEY, mode);
      replacePeek({ recordId: peek.recordId, mode });
    },
    [peek, replacePeek],
  );

  useEffect(() => {
    if (!peek) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, peek]);

  if (!peek || !record) return null;

  const mode = peek.mode;
  const formattedDate = record.dueDate
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(record.dueDate))
    : null;

  const panel = (
    <div
      role="dialog"
      aria-modal={mode === "center"}
      aria-label={record.title}
      data-testid="record-peek"
      data-peek-mode={mode}
      className={
        mode === "center"
          ? "relative flex max-h-[min(720px,85dvh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface-raised"
          : "relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-surface-raised"
      }
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <div
          role="group"
          aria-label="Peek mode"
          className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
        >
          <ModeButton
            label="Center peek"
            active={mode === "center"}
            onClick={() => setMode("center")}
            icon="panel-open"
          />
          <ModeButton
            label="Side peek"
            active={mode === "side"}
            onClick={() => setMode("side")}
            icon="panel-close"
          />
        </div>
        <div className="min-w-0 flex-1" />
        {pageId && (
          <button
            type="button"
            onClick={() => router.push(`/pages/${pageId}`)}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-small text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            title="Open database page"
          >
            <Icon name="page" className="size-4" />
            <span className="hidden sm:inline">Open page</span>
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Close peek"
          className="flex size-8 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Icon name="close" className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <p className="text-label uppercase text-text-muted">Record</p>
        <h2 className="mt-1 text-h1 text-ink">{record.title}</h2>
        {record.description && (
          <p className="mt-3 max-w-prose text-body text-text-secondary">
            {record.description}
          </p>
        )}
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <MetaField label="Status" value={record.status} />
          <MetaField label="Priority" value={record.priority} />
          <MetaField label="Due" value={formattedDate} />
          <MetaField
            label="Estimate"
            value={
              record.estimateMinutes !== null
                ? `${record.estimateMinutes} min`
                : null
            }
          />
        </dl>
        {record.tags.length > 0 && (
          <div className="mt-6">
            <p className="text-label uppercase text-text-muted">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {record.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-2 py-1 text-label text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (mode === "side") {
    return (
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md">
        <button
          type="button"
          aria-label="Close peek"
          className="absolute inset-0 -left-[100vw] w-screen cursor-default bg-ink/20"
          onClick={close}
        />
        <div className="relative ml-auto h-full w-full max-w-md">{panel}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close peek"
        className="absolute inset-0 cursor-default bg-ink/30"
        onClick={close}
      />
      <div className="relative w-full max-w-3xl">{panel}</div>
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: "panel-open" | "panel-close";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-md outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
        active
          ? "bg-paper text-ink"
          : "text-text-muted hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  );
}

function MetaField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-label uppercase text-text-muted">{label}</dt>
      <dd className="mt-1 text-small text-ink">{value ?? "—"}</dd>
    </div>
  );
}

/** Opens a record peek by updating the current URL search params. */
export function useOpenRecordPeek() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (recordId: string, mode?: RecordPeekMode) => {
      const stored =
        typeof window !== "undefined"
          ? normalizeRecordPeekMode(
              localStorage.getItem(RECORD_PEEK_MODE_STORAGE_KEY),
            )
          : DEFAULT_RECORD_PEEK_MODE;
      const params = buildRecordPeekSearchParams(
        new URLSearchParams(searchParams.toString()),
        { recordId, mode: mode ?? stored },
      );
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );
}
