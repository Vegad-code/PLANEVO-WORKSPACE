"use client"

import { useEffect, useState } from "react"
import { FileText } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  canCreateObjectPreview,
  uploadPreviewKind,
  uploadTypeBadge,
  type UploadPreviewKind,
} from "./upload-file-preview"

type UploadFileThumbProps = {
  file: File
  className?: string
}

const badgeTone = (kind: UploadPreviewKind): string => {
  switch (kind) {
    case "image":
      return "bg-files-storage-images/20 text-files-text"
    case "video":
      return "bg-ocean-tint text-files-text"
    case "audio":
      return "bg-slate-tint text-files-text"
    case "pdf":
      return "bg-brick-tint text-files-text"
    case "spreadsheet":
      return "bg-meadow-tint text-files-text"
    case "document":
      return "bg-files-surface-muted text-files-text"
    case "archive":
      return "bg-files-surface-muted text-files-text-muted"
    case "generic":
      return "bg-files-surface-muted text-files-text-muted"
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

/**
 * Client-side thumb: object-URL preview for image/video, type badge otherwise.
 * Object URLs are revoked on unmount / file change.
 */
export const UploadFileThumb = ({ file, className }: UploadFileThumbProps) => {
  const kind = uploadPreviewKind(file)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!canCreateObjectPreview(kind)) {
      setObjectUrl(null)
      return
    }

    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file, kind])

  if (kind === "image" && objectUrl) {
    return (
      <div
        className={cn(
          "relative size-14 shrink-0 overflow-hidden rounded-xl bg-files-surface-muted",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
        <img
          src={objectUrl}
          alt=""
          className="size-full object-cover"
        />
      </div>
    )
  }

  if (kind === "video" && objectUrl) {
    return (
      <div
        className={cn(
          "relative size-14 shrink-0 overflow-hidden rounded-xl bg-files-surface-muted",
          className,
        )}
      >
        <video
          src={objectUrl}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
          aria-hidden="true"
        />
      </div>
    )
  }

  const badge = uploadTypeBadge(file)

  return (
    <div
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-xl",
        badgeTone(kind),
        className,
      )}
      aria-hidden="true"
    >
      {kind === "generic" && badge === "FILE" ? (
        <FileText className="size-5 text-files-text-muted" strokeWidth={1.5} />
      ) : (
        <span className="font-product text-product-meta font-semibold tracking-wide">
          {badge}
        </span>
      )}
    </div>
  )
}
