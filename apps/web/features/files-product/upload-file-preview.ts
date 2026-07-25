/**
 * Client-side upload preview helpers.
 * Images/video get object-URL thumbs; everything else gets an industry-standard type badge.
 */

export type UploadPreviewKind =
  | "image"
  | "video"
  | "pdf"
  | "spreadsheet"
  | "document"
  | "archive"
  | "audio"
  | "generic"

export const uploadPreviewKind = (file: File): UploadPreviewKind => {
  const mime = (file.type || "").toLowerCase()
  const name = file.name.toLowerCase()

  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf"

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    /\.(xlsx?|csv|ods)$/i.test(name)
  ) {
    return "spreadsheet"
  }

  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("x-tar") ||
    mime.includes("x-rar") ||
    mime.includes("x-7z") ||
    /\.(zip|rar|7z|tar|gz)$/i.test(name)
  ) {
    return "archive"
  }

  if (
    mime.startsWith("text/") ||
    mime.includes("document") ||
    mime.includes("msword") ||
    mime.includes("wordprocessing") ||
    mime.includes("presentation") ||
    /\.(docx?|pptx?|txt|md|rtf|pages)$/i.test(name)
  ) {
    return "document"
  }

  return "generic"
}

/** Short industry-standard badge label (PDF, XLS, ZIP, …). */
export const uploadTypeBadge = (file: File): string => {
  const kind = uploadPreviewKind(file)
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".") + 1).toUpperCase()
    : ""

  switch (kind) {
    case "image":
      return ext && ext.length <= 4 ? ext : "IMG"
    case "video":
      return ext && ext.length <= 4 ? ext : "VID"
    case "audio":
      return ext && ext.length <= 4 ? ext : "AUD"
    case "pdf":
      return "PDF"
    case "spreadsheet":
      if (ext === "CSV") return "CSV"
      if (ext === "XLS" || ext === "XLSX") return "XLS"
      return "XLS"
    case "document":
      if (ext === "DOC" || ext === "DOCX") return "DOC"
      if (ext === "PPT" || ext === "PPTX") return "PPT"
      if (ext === "TXT") return "TXT"
      if (ext === "MD") return "MD"
      return ext && ext.length <= 4 ? ext : "DOC"
    case "archive":
      if (ext === "ZIP" || ext === "RAR" || ext === "7Z" || ext === "TAR") return ext
      return "ZIP"
    case "generic":
      return ext && ext.length <= 4 ? ext : "FILE"
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export const canCreateObjectPreview = (kind: UploadPreviewKind): boolean =>
  kind === "image" || kind === "video"

export const formatUploadBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B"
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ["KB", "MB", "GB"] as const
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}
