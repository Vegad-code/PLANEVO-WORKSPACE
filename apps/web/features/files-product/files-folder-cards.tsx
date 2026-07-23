"use client";

import { useDroppable } from "@dnd-kit/core";
import { FileImage, FileText } from "lucide-react";
import { mimeFamily, type MimeFamily } from "@planevo/core/types/files";
import { cn } from "@/lib/utils";
import { folderDropId, type FolderTreeItem } from "./kb-contracts";
import type { ProductFileItem } from "./files-table";

export type FilesFolderCardsProps = {
  folders: FolderTreeItem[];
  files: ProductFileItem[];
  parentId: string | null;
  onOpenFolder: (folderId: string) => void;
};

const GLYPH_ORDER: MimeFamily[] = ["pdfs", "images", "documents"];

const GLYPH_STYLE: Record<
  MimeFamily,
  { icon: typeof FileText; className: string; label: string }
> = {
  pdfs: { icon: FileText, className: "bg-[#e2483d]", label: "PDF" },
  images: { icon: FileImage, className: "bg-[#8a63d2]", label: "Image" },
  documents: { icon: FileText, className: "bg-[#3a7bd5]", label: "Document" },
};

/** Distinct file-type glyphs (real data) for a folder's direct files, capped at 3. */
function folderGlyphs(files: ProductFileItem[], folderId: string): MimeFamily[] {
  const present = new Set<MimeFamily>();
  for (const file of files) {
    if (file.folder_id === folderId) present.add(mimeFamily(file.mime_type));
  }
  return GLYPH_ORDER.filter((family) => present.has(family)).slice(0, 3);
}

/**
 * Premium glassmorphic folder illustration: a dark back + tab, white sheets
 * peeking out (when the folder holds files, one flagged as a PDF), and a frosted
 * front flap blurring the sheets behind it. Source glyphs sit on the flap.
 */
function FolderArt({
  hasFiles,
  glyphs,
}: {
  hasFiles: boolean;
  glyphs: MimeFamily[];
}) {
  return (
    <div aria-hidden="true" className="relative mx-auto h-28 w-44">
      {/* grounding shadow */}
      <div className="absolute inset-x-6 bottom-1 h-5 rounded-[50%] bg-black/50 blur-lg" />
      {/* folder tab */}
      <div className="absolute left-4 top-2 h-6 w-20 rounded-t-[10px] bg-gradient-to-b from-[#454547] to-[#37373a]" />
      {/* folder back body */}
      <div className="absolute inset-x-1 bottom-1 top-5 rounded-[14px] bg-gradient-to-b from-[#3d3d40] to-[#2b2b2e] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />

      {/* sheets peeking out */}
      {hasFiles ? (
        <>
          <div className="absolute left-8 top-3 h-16 w-24 -rotate-6 rounded-[8px] bg-[#f5f5f7] shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
          <div className="absolute left-12 top-4 h-16 w-24 rotate-6 rounded-[8px] bg-[#e9e9ee] shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
            <span className="absolute right-1.5 top-1.5 rounded-[3px] bg-[#e2483d] px-1 py-px text-[7px] font-bold leading-none tracking-wide text-white">
              PDF
            </span>
          </div>
        </>
      ) : null}

      {/* frosted glass front flap */}
      <div className="absolute inset-x-1 bottom-1 top-10 overflow-hidden rounded-[14px] border-t border-white/20 bg-gradient-to-b from-white/[0.14] to-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md">
        {/* source glyphs on the flap */}
        {glyphs.length > 0 ? (
          <div className="absolute bottom-2 left-3 flex items-center">
            {glyphs.map((family, index) => {
              const { icon: GlyphIcon, className, label } = GLYPH_STYLE[family];
              return (
                <span
                  key={family}
                  title={label}
                  className={cn(
                    "flex size-5 items-center justify-center rounded-[6px] ring-2 ring-[#2b2b2e]",
                    className,
                    index > 0 && "-ml-1.5",
                  )}
                >
                  <GlyphIcon className="size-2.5 text-white" />
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FolderCard({
  folder,
  files,
  onOpenFolder,
}: {
  folder: FolderTreeItem;
  files: ProductFileItem[];
  onOpenFolder: (folderId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: folderDropId(folder.id) });
  const glyphs = folderGlyphs(files, folder.id);

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={`Open folder ${folder.name}`}
      onClick={() => onOpenFolder(folder.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpenFolder(folder.id);
      }}
      className={cn(
        "group flex w-56 shrink-0 cursor-pointer flex-col rounded-2xl border p-3 shadow-[0_1px_2px_rgba(0,0,0,0.4)] outline-none transition-all focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
        isOver
          ? "border-files-cta bg-files-surface-muted ring-1 ring-files-cta"
          : "border-files-border bg-files-surface hover:border-files-border-strong hover:bg-files-surface-muted",
      )}
    >
      <div className="flex items-center justify-center pt-2">
        <FolderArt hasFiles={folder.fileCount > 0} glyphs={glyphs} />
      </div>
      <div className="mt-3 min-w-0 px-1">
        <p className="truncate text-product-title font-semibold text-files-text">
          {folder.name}
        </p>
        <p className="mt-0.5 text-product-meta text-files-text-muted">
          {folder.fileCount === 1 ? "1 File" : `${folder.fileCount} Files`}
        </p>
      </div>
    </div>
  );
}

/** "Folders" section: a horizontal rail of cards for the direct children of `parentId`. */
export function FilesFolderCards({
  folders,
  files,
  parentId,
  onOpenFolder,
}: FilesFolderCardsProps) {
  const children = folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  if (children.length === 0) return null;

  return (
    <section aria-label="Folders">
      <h2 className="text-product-body font-medium text-files-text-muted">Folders</h2>
      <div className="-mx-1 mt-4 flex gap-4 overflow-x-auto px-1 pb-2">
        {children.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            files={files}
            onOpenFolder={onOpenFolder}
          />
        ))}
      </div>
    </section>
  );
}
