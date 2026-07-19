"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

type FilesUploadDropzoneProps = {
  onUploadFiles: (files: File[]) => void;
  isUploading?: boolean;
  children: React.ReactNode;
};

/** Wraps the table area; dropping files anywhere inside starts an upload. */
export function FilesUploadDropzone({
  onUploadFiles,
  isUploading = false,
  children,
}: FilesUploadDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    if (isUploading) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onUploadFiles(files);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={handleDrop}
      className="relative"
    >
      {children}
      {isDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-card border-2 border-dashed border-border-strong bg-paper/90">
          <span className="flex items-center gap-2 text-body font-medium text-ink">
            <Upload aria-hidden="true" className="size-5" />
            Drop files to upload
          </span>
        </div>
      ) : null}
    </div>
  );
}
