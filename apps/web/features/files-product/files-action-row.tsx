"use client";

import { useRef } from "react";
import { FolderPlus, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type FilesActionRowProps = {
  onUploadFiles: (files: File[]) => void;
  isUploading?: boolean;
};

export function FilesActionRow({
  onUploadFiles,
  isUploading = false,
}: FilesActionRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilesChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset so choosing the same file twice re-fires the change event.
    event.target.value = "";
    if (files.length > 0) onUploadFiles(files);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" disabled title="Documents come later">
        <Plus aria-hidden="true" className="size-4" />
        Create
      </Button>

      {/* The view's single marigold element. */}
      <Button
        type="button"
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload aria-hidden="true" className="size-4" />
        {isUploading ? "Uploading…" : "Upload or drop"}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        aria-label="Choose files to upload"
        onChange={handleFilesChosen}
      />

      <Button type="button" variant="outline" disabled title="Folders come later">
        <FolderPlus aria-hidden="true" className="size-4" />
        Create folder
      </Button>
    </div>
  );
}
