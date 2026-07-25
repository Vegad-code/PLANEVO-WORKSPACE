"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Trash2, X } from "lucide-react";
import { STORAGE_CAP_BYTES_BY_PLAN } from "@planevo/core/types/plans";
import { Dialog } from "@/components/ui/dialog";
import {
  buildStorageSegments,
  largestStorageFiles,
  segmentPercentOfCap,
  type StorageFileLike,
  type StorageSegment,
} from "./storage-breakdown";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const rounded = value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${BYTE_UNITS[exponent]}`;
}

type StorageMeterProps = {
  usedBytes: number;
  capBytes: number;
  files?: StorageFileLike[];
  onDeleteFile?: (file: StorageFileLike) => void;
};

function SegmentedPill({
  segments,
  capBytes,
  className = "h-2.5",
}: {
  segments: StorageSegment[];
  capBytes: number;
  className?: string;
}) {
  const usedPct = segments.reduce(
    (sum, segment) => sum + segmentPercentOfCap(segment.bytes, capBytes),
    0,
  );
  const availablePct = Math.max(0, 100 - Math.min(usedPct, 100));

  return (
    <div
      className={`flex w-full gap-px overflow-hidden rounded-full bg-files-surface ${className}`}
      aria-hidden="true"
    >
      {segments.map((segment) => {
        const width = segmentPercentOfCap(segment.bytes, capBytes);
        if (width <= 0) return null;
        return (
          <div
            key={segment.id}
            title={segment.label}
            style={{ width: `${width}%`, minWidth: width > 0 ? "2px" : undefined }}
            className={`h-full ${segment.swatchClass}`}
          />
        );
      })}
      {availablePct > 0 ? (
        <div
          style={{ width: `${availablePct}%` }}
          className="h-full bg-files-storage-available"
        />
      ) : null}
    </div>
  );
}

function StorageLegend({
  segments,
  capBytes,
}: {
  segments: StorageSegment[];
  capBytes: number;
}) {
  if (segments.length === 0) {
    return (
      <p className="text-product-meta text-files-text-muted">
        Nothing using storage yet. Uploads will show up here by type.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {segments.map((segment) => {
        const pct = Math.round(segmentPercentOfCap(segment.bytes, capBytes));
        return (
          <li
            key={segment.id}
            className="flex items-center gap-1.5 text-product-meta text-files-text-muted"
          >
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${segment.swatchClass}`}
            />
            <span>
              {segment.label}{" "}
              <span className="tabular-nums">
                {pct}% · {formatBytes(segment.bytes)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ManageStorageDialog({
  open,
  onClose,
  usedBytes,
  capBytes,
  files,
  segments,
  onDeleteFile,
}: {
  open: boolean;
  onClose: () => void;
  usedBytes: number;
  capBytes: number;
  files: StorageFileLike[];
  segments: StorageSegment[];
  onDeleteFile?: (file: StorageFileLike) => void;
}) {
  const [panel, setPanel] = useState<"overview" | "clear" | "upgrade">("overview");
  const largest = useMemo(() => largestStorageFiles(files), [files]);
  const usedLabel = `${formatBytes(usedBytes)} of ${formatBytes(capBytes)} Used`;

  function handleClose() {
    setPanel("overview");
    onClose();
  }

  function handleOpenSettingsBilling() {
    handleClose();
    window.dispatchEvent(
      new CustomEvent("planevo:open-settings", {
        detail: { section: "billing" },
      }),
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      labelledBy="files-storage-manage-title"
      className="m-4 w-[min(100%,26rem)] rounded-files-modal border border-files-border bg-files-surface p-0 text-files-text shadow-xl backdrop:bg-files-text/40 sm:m-auto"
    >
      <div className="flex items-start justify-between gap-3 border-b border-files-border px-5 py-4">
        <div>
          <h2
            id="files-storage-manage-title"
            className="text-h3 font-semibold text-files-text"
          >
            {panel === "clear"
              ? "Clear storage"
              : panel === "upgrade"
                ? "Upgrade storage"
                : "Manage Storage"}
          </h2>
          <p className="mt-1 text-product-meta tabular-nums text-files-text-muted">
            {usedLabel}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close storage dialog"
          onClick={handleClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-files-text-muted outline-none transition-colors hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta active:scale-[0.98]"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div className="px-5 py-4">
        {panel === "overview" ? (
          <div className="flex flex-col gap-4">
            <SegmentedPill segments={segments} capBytes={capBytes} className="h-3" />
            <StorageLegend segments={segments} capBytes={capBytes} />

            <div className="flex flex-col gap-1 pt-1">
              <button
                type="button"
                onClick={() => setPanel("clear")}
                className="flex w-full items-center justify-between gap-3 rounded-files-card px-3 py-2.5 text-left outline-none transition-colors hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta active:scale-[0.99]"
              >
                <span className="text-product-body font-medium text-files-text">
                  Clear storage
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-files-text-muted"
                />
              </button>
              <button
                type="button"
                onClick={() => setPanel("upgrade")}
                className="flex w-full items-center justify-between gap-3 rounded-files-card px-3 py-2.5 text-left outline-none transition-colors hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta active:scale-[0.99]"
              >
                <span className="text-product-body font-medium text-files-text">
                  Upgrade
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-files-text-muted"
                />
              </button>
            </div>
          </div>
        ) : null}

        {panel === "clear" ? (
          <div className="flex flex-col gap-3">
            <p className="text-product-body text-files-text-muted">
              Delete large files you no longer need. This frees space on your plan.
            </p>
            {largest.length === 0 ? (
              <p className="rounded-files-card bg-files-surface-muted px-3 py-4 text-center text-product-meta text-files-text-muted">
                No files to clear yet.
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {largest.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 rounded-files-card px-2 py-2 hover:bg-files-surface-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-product-body font-medium text-files-text">
                        {file.name}
                      </p>
                      <p className="text-product-meta tabular-nums text-files-text-muted">
                        {formatBytes(file.size_bytes ?? 0)}
                      </p>
                    </div>
                    {onDeleteFile ? (
                      <button
                        type="button"
                        aria-label={`Delete ${file.name}`}
                        onClick={() => {
                          onDeleteFile(file);
                          handleClose();
                        }}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-files-text-muted outline-none transition-colors hover:text-brick focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta active:scale-[0.98]"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setPanel("overview")}
              className="mt-1 self-start text-product-meta font-medium text-files-cta outline-none hover:opacity-80 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
            >
              Back
            </button>
          </div>
        ) : null}

        {panel === "upgrade" ? (
          <div className="flex flex-col gap-3">
            <p className="text-product-body text-files-text-muted">
              Paid plans raise your file storage cap. Billing opens in Settings.
            </p>
            <ul className="flex flex-col gap-2">
              {(
                [
                  { id: "free", label: "Free", bytes: STORAGE_CAP_BYTES_BY_PLAN.free },
                  { id: "plus", label: "Plus", bytes: STORAGE_CAP_BYTES_BY_PLAN.plus },
                  { id: "pro", label: "Pro", bytes: STORAGE_CAP_BYTES_BY_PLAN.pro },
                ] as const
              ).map((tier) => (
                <li
                  key={tier.id}
                  className="flex items-center justify-between gap-3 rounded-files-card border border-files-border px-3 py-2.5"
                >
                  <span className="text-product-body font-medium text-files-text">
                    {tier.label}
                  </span>
                  <span className="text-product-meta tabular-nums text-files-text-muted">
                    {formatBytes(tier.bytes)}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleOpenSettingsBilling}
              className="mt-1 w-full rounded-files-card bg-files-cta px-4 py-2.5 text-small font-medium text-files-cta-text outline-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta active:scale-[0.98]"
            >
              Open billing
            </button>
            <button
              type="button"
              onClick={() => setPanel("overview")}
              className="self-start text-product-meta font-medium text-files-cta outline-none hover:opacity-80 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
            >
              Back
            </button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

export function StorageMeter({
  usedBytes,
  capBytes,
  files = [],
  onDeleteFile,
}: StorageMeterProps) {
  const [open, setOpen] = useState(false);
  const segments = useMemo(() => buildStorageSegments(files), [files]);
  const summary = `${formatBytes(usedBytes)} of ${formatBytes(capBytes)} Used`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Storage, ${summary}. Open to manage.`}
        className="flex w-full flex-col gap-2 rounded-files-card p-1 text-left outline-none transition-colors hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta active:scale-[0.99]"
      >
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <span className="shrink-0 text-product-title font-medium text-files-text">
            Storage
          </span>
          <span className="text-right text-product-meta tabular-nums text-files-text-muted">
            {summary}
          </span>
        </div>
        <SegmentedPill segments={segments} capBytes={capBytes} />
      </button>

      {open ? (
        <ManageStorageDialog
          open={open}
          onClose={() => setOpen(false)}
          usedBytes={usedBytes}
          capBytes={capBytes}
          files={files}
          segments={segments}
          onDeleteFile={onDeleteFile}
        />
      ) : null}
    </>
  );
}
