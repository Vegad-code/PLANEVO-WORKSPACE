"use client"

import { useRef, useState } from "react"
import { CloudUpload, Trash2, X } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { MAX_PRODUCT_FILE_BYTES } from "@/lib/files/product-files"
import { formatBytes } from "./storage-meter"
import { uploadSingleProductFile } from "./product-file-uploads"
import { formatUploadBytes } from "./upload-file-preview"
import { UploadFileThumb } from "./upload-file-thumb"

type QueueItem = {
  id: string
  file: File
  status: "pending" | "uploading" | "uploaded" | "failed"
  progress: number
  error?: string
}

type FilesUploadModalProps = {
  open: boolean
  onClose: () => void
  onUploadComplete: () => void
  onUploadingChange?: (uploading: boolean) => void
}

const fileKey = (file: File): string =>
  `${file.name}-${file.size}-${file.lastModified}`

const ease = "duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"

export function FilesUploadModal({
  open,
  onClose,
  onUploadComplete,
  onUploadingChange,
}: FilesUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const pendingCount = queue.filter((item) => item.status === "pending").length
  const hasFailures = queue.some((item) => item.status === "failed")
  const settledItems = queue.filter(
    (item) =>
      item.status === "pending" ||
      item.status === "uploaded" ||
      item.status === "failed",
  )
  const activeItems = queue.filter((item) => item.status === "uploading")

  const handleClose = () => {
    if (isUploading) return
    setQueue([])
    onClose()
  }

  const addFiles = (files: File[]) => {
    if (files.length === 0) return
    setQueue((previous) => {
      const existing = new Set(previous.map((item) => item.id))
      const next = [...previous]
      for (const file of files) {
        const id = fileKey(file)
        if (existing.has(id)) continue
        next.push({ id, file, status: "pending", progress: 0 })
      }
      return next
    })
  }

  const handleFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return
    event.preventDefault()
    setIsDragActive(true)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  const handleRemoveItem = (itemId: string) => {
    if (isUploading) return
    setQueue((previous) => previous.filter((item) => item.id !== itemId))
  }

  const updateItem = (
    itemId: string,
    patch: Partial<Pick<QueueItem, "status" | "progress" | "error">>,
  ) => {
    setQueue((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    )
  }

  const handleUpload = async () => {
    const pending = queue.filter(
      (item) => item.status === "pending" || item.status === "failed",
    )
    if (pending.length === 0) {
      if (queue.some((item) => item.status === "uploaded")) {
        handleClose()
        onUploadComplete()
      }
      return
    }

    setIsUploading(true)
    onUploadingChange?.(true)
    let uploadedCount = 0
    let failedCount = 0

    for (const item of pending) {
      updateItem(item.id, { status: "uploading", progress: 0, error: undefined })
      try {
        await uploadSingleProductFile(item.file, (progress) => {
          updateItem(item.id, { progress })
        })
        updateItem(item.id, { status: "uploaded", progress: 100 })
        uploadedCount += 1
      } catch (cause) {
        failedCount += 1
        updateItem(item.id, {
          status: "failed",
          error: cause instanceof Error ? cause.message : "Upload failed.",
        })
      }
    }

    setIsUploading(false)
    onUploadingChange?.(false)
    if (uploadedCount > 0) onUploadComplete()
    // Dismiss so the library/preview isn't blocked behind the dialog.
    // Keep open when anything failed so the user can retry.
    // Call onClose directly — handleClose would no-op here because
    // isUploading is still true in this render's closure.
    if (uploadedCount > 0 && failedCount === 0) {
      setQueue([])
      onClose()
    }
  }

  const handleBrowseClick = () => {
    if (isUploading) return
    fileInputRef.current?.click()
  }

  const maxSizeLabel = formatBytes(MAX_PRODUCT_FILE_BYTES)
  const showDone =
    !isUploading &&
    pendingCount === 0 &&
    !hasFailures &&
    queue.some((item) => item.status === "uploaded")

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      labelledBy="files-upload-title"
      className="m-4 w-[min(100%,26rem)] rounded-files-modal border-0 bg-transparent p-0 text-files-text shadow-none backdrop:bg-files-text/35 sm:m-auto"
    >
      <div className="rounded-files-modal bg-files-surface-muted/80 p-1.5 ring-1 ring-files-border/60">
        <div className="overflow-hidden rounded-[calc(var(--radius-files-modal)-0.375rem)] bg-files-surface shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-files-surface)_80%,white)]">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id="files-upload-title" className="sr-only">
                Upload files
              </h2>
              <button
                type="button"
                aria-label="Close upload dialog"
                disabled={isUploading}
                onClick={handleClose}
                className={cn(
                  "ml-auto flex size-8 items-center justify-center rounded-full text-files-text-muted outline-none",
                  "hover:bg-files-surface-muted hover:text-files-text",
                  "focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
                  "active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50",
                  ease,
                )}
              >
                <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            <div
              role="button"
              tabIndex={isUploading ? -1 : 0}
              aria-label="Drop files here or browse to choose files"
              onDragOver={handleDragOver}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={handleDrop}
              onClick={handleBrowseClick}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  handleBrowseClick()
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-files-card bg-files-surface-muted px-6 py-10 text-center outline-none",
                "transition-[transform,background-color,box-shadow] active:scale-[0.995]",
                ease,
                isDragActive
                  ? "bg-files-folder-tint ring-2 ring-files-text/20"
                  : "ring-1 ring-transparent",
                isUploading && "pointer-events-none cursor-not-allowed opacity-60",
                "focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-xl bg-files-surface shadow-[0_1px_2px_color-mix(in_srgb,var(--color-files-text)_8%,transparent)]"
              >
                <CloudUpload
                  className="size-5 text-files-text-muted"
                  strokeWidth={1.5}
                />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-product-body font-medium text-files-text">
                  Drop your files here or{" "}
                  <span className="font-semibold underline decoration-files-border underline-offset-2">
                    browse
                  </span>
                </p>
                <p className="text-product-meta text-files-text-muted">
                  Max file size up to {maxSizeLabel}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handleFilesChosen}
              />
            </div>

            {queue.length > 0 ? (
              <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
                {settledItems.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {settledItems.map((item, index) => (
                      <QueueRow
                        key={item.id}
                        item={item}
                        index={index}
                        canRemove={!isUploading}
                        onRemove={() => handleRemoveItem(item.id)}
                      />
                    ))}
                  </ul>
                ) : null}

                {settledItems.length > 0 && activeItems.length > 0 ? (
                  <div
                    aria-hidden="true"
                    className="flex items-center justify-center gap-1.5 py-0.5"
                  >
                    <span className="size-1 rounded-full bg-files-text-muted/50" />
                    <span className="size-1 rounded-full bg-files-text-muted/50" />
                    <span className="size-1 rounded-full bg-files-text-muted/50" />
                  </div>
                ) : null}

                {activeItems.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {activeItems.map((item, index) => (
                      <QueueRow
                        key={item.id}
                        item={item}
                        index={index}
                        canRemove={false}
                        onRemove={() => {}}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isUploading}
                onClick={handleClose}
                className={cn(
                  "rounded-full border border-files-border bg-files-surface px-4 py-2.5 text-product-body font-semibold text-files-text outline-none",
                  "hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
                  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                  ease,
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isUploading ||
                  (pendingCount === 0 && !hasFailures && queue.length === 0)
                }
                onClick={handleUpload}
                className={cn(
                  "group flex items-center justify-center gap-2 rounded-full bg-files-cta px-4 py-2.5 text-product-body font-semibold text-files-cta-text outline-none",
                  "hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
                  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                  ease,
                )}
              >
                <span>
                  {isUploading
                    ? "Uploading…"
                    : showDone
                      ? "Done"
                      : hasFailures
                        ? "Retry"
                        : "Upload"}
                </span>
                {!isUploading && !showDone ? (
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full bg-files-cta-text/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px"
                  >
                    <CloudUpload className="size-3.5" strokeWidth={1.75} />
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

type QueueRowProps = {
  item: QueueItem
  index: number
  canRemove: boolean
  onRemove: () => void
}

const QueueRow = ({ item, index, canRemove, onRemove }: QueueRowProps) => {
  const isUploading = item.status === "uploading"
  const uploadedBytes = Math.round((item.progress / 100) * item.file.size)
  const sizeLabel = isUploading
    ? `${formatUploadBytes(uploadedBytes)} of ${formatUploadBytes(item.file.size)}`
    : formatBytes(item.file.size)

  const statusHint =
    item.status === "failed" ? (item.error ?? "Failed") : null

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-files-card border border-dashed border-files-border bg-files-surface",
        "opacity-100 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        item.status === "failed" && "border-brick/40",
      )}
      style={{ transitionDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-center gap-3 p-3 pb-3.5">
        <UploadFileThumb file={item.file} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-product-body font-semibold text-files-text">
            {item.file.name}
          </p>
          <p className="mt-0.5 truncate text-product-meta text-files-text-muted">
            {sizeLabel}
            {statusHint ? ` - ${statusHint}` : ""}
          </p>
        </div>
        {isUploading ? (
          <span
            className="flex size-8 items-center justify-center text-files-text-muted"
            aria-hidden="true"
          >
            <X className="size-4 opacity-40" strokeWidth={1.5} />
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Remove ${item.file.name}`}
            disabled={!canRemove}
            onClick={onRemove}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-files-text-muted outline-none",
              "hover:bg-files-surface-muted hover:text-files-text",
              "focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
              "active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40",
              ease,
            )}
          >
            <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {isUploading ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={item.progress}
          aria-label={`Uploading ${item.file.name}`}
          className="absolute inset-x-0 bottom-0 h-1.5 bg-files-surface-muted"
        >
          <div
            className="h-full origin-left bg-files-text transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `scaleX(${Math.max(item.progress, 2) / 100})` }}
          />
        </div>
      ) : null}
    </li>
  )
}
