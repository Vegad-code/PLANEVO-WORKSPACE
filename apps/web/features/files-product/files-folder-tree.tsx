"use client";

import { useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, Folder, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { SaveIndicator } from "@/features/editor/toolbar/save-indicator";
import { cn } from "@/lib/utils";
import {
  folderAncestorIds,
  folderHasChildren,
  getCollapsedFolderIds,
  setCollapsedFolderIds,
  visibleFolderEntries,
} from "./folder-tree-collapse";
import { folderDropId, type FolderTreeItem } from "./kb-contracts";
import { useAutosaveField } from "./use-autosave-field";

export type FilesFolderTreeProps = {
  folders: FolderTreeItem[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<boolean>;
  onRenameFolder: (folderId: string, name: string) => Promise<boolean>;
  onDeleteFolder: (folderId: string) => void;
};

const INDENT_PX = 20;
const BASE_PADDING_PX = 8;
/** Chevron column + gap before the folder glyph — keeps icons aligned. */
const ROW_ICON_INSET_PX = 20;
/** Vertical guide sits under an ancestor's folder icon center. */
const GUIDE_OFFSET_PX = ROW_ICON_INSET_PX + 8;
const ROW_CENTER_PX = 16; // half of the 32px row — where elbows meet
/** Horizontal elbow from parent guide to the child folder icon's left edge. */
const ELBOW_WIDTH_PX = INDENT_PX - 8;

function guideX(level: number): number {
  return BASE_PADDING_PX + level * INDENT_PX + GUIDE_OFFSET_PX;
}

/** True when a later sibling exists at `depth` before the tree goes shallower. */
function spineContinues(folders: FolderTreeItem[], index: number, depth: number): boolean {
  for (let i = index + 1; i < folders.length; i += 1) {
    const nextDepth = folders[i]!.depth;
    if (nextDepth < depth) return false;
    if (nextDepth === depth) return true;
  }
  return false;
}

/** ├─ / └─ / │ connector lines for a nested row. */
function TreeConnectors({
  folders,
  index,
}: {
  folders: FolderTreeItem[];
  index: number;
}) {
  const depth = folders[index]!.depth;
  if (depth === 0) return null;

  const lines: React.ReactNode[] = [];
  for (let level = 0; level < depth; level += 1) {
    const left = guideX(level);
    if (level < depth - 1) {
      // Pass-through ancestor spine.
      if (spineContinues(folders, index, level)) {
        lines.push(
          <span
            key={`v-${level}`}
            className="absolute inset-y-0 w-px bg-files-border"
            style={{ left }}
          />,
        );
      }
      continue;
    }
    // Parent-level elbow: down to center, across to the icon, and onward if not last.
    lines.push(
      <span
        key={`elbow-v-${level}`}
        className="absolute top-0 w-px bg-files-border"
        style={{ left, height: ROW_CENTER_PX }}
      />,
      <span
        key={`elbow-h-${level}`}
        className="absolute h-px bg-files-border"
        style={{ left, top: ROW_CENTER_PX, width: ELBOW_WIDTH_PX }}
      />,
    );
    if (spineContinues(folders, index, level)) {
      lines.push(
        <span
          key={`elbow-vb-${level}`}
          className="absolute bottom-0 w-px bg-files-border"
          style={{ left, top: ROW_CENTER_PX }}
        />,
      );
    }
  }
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {lines}
    </div>
  );
}

/**
 * Inline "new folder name" row. Shared by the sidebar header's root-create
 * action and each tree row's add-subfolder action.
 */
export function FolderCreateRow({
  depth,
  placeholder = "Folder name",
  onSubmit,
  onCancel,
}: {
  depth: number;
  placeholder?: string;
  onSubmit: (name: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || isPending) return;
    setIsPending(true);
    const ok = await onSubmit(trimmed);
    setIsPending(false);
    if (ok) setName("");
  }

  return (
    <li
      style={{ paddingLeft: BASE_PADDING_PX + depth * INDENT_PX }}
      className="flex items-center gap-2 py-1 pr-2"
    >
      <span aria-hidden="true" className="size-4 shrink-0" />
      <Folder aria-hidden="true" className="size-4 shrink-0 text-files-text-muted" />
      <input
        autoFocus
        value={name}
        disabled={isPending}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          if (!name.trim()) onCancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        placeholder={placeholder}
        aria-label="New folder name"
        className="min-w-0 flex-1 rounded-lg border border-files-border-strong bg-files-surface px-2 py-1 text-product-body text-files-text outline-none focus-visible:border-files-cta disabled:opacity-60"
      />
    </li>
  );
}

function FolderRow({
  folder,
  folders,
  index,
  isSelected,
  isCollapsed,
  isAddingChild,
  onToggleCollapsed,
  onToggleAddChild,
  onSelectFolder,
  onCreateChild,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: FolderTreeItem;
  folders: FolderTreeItem[];
  index: number;
  isSelected: boolean;
  isCollapsed: boolean;
  isAddingChild: boolean;
  onToggleCollapsed: () => void;
  onToggleAddChild: () => void;
  onSelectFolder: (folderId: string | null) => void;
  onCreateChild: (name: string) => Promise<boolean>;
  onRenameFolder: (folderId: string, name: string) => Promise<boolean>;
  onDeleteFolder: (folderId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: folderDropId(folder.id) });
  const { value, setValue, status } = useAutosaveField({
    initial: folder.name,
    onSave: (nextName) => {
      // ponytail: blank rename is a no-op "save" (input reverts to folder.name on
      // exit) rather than failing and retry-looping forever.
      if (!nextName) return Promise.resolve(true);
      return onRenameFolder(folder.id, nextName);
    },
  });

  function exitEditing() {
    if (!value.trim()) setValue(folder.name);
    setIsEditing(false);
  }

  const hasChildFolders = folderHasChildren(folders, index);
  const FolderIcon = hasChildFolders && !isCollapsed ? FolderOpen : Folder;

  return (
    <>
      <li>
        <div
          ref={setNodeRef}
          className={cn(
            "group relative flex min-h-8 items-center gap-0.5 rounded-lg pr-1 transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isOver
              ? "bg-files-surface-muted ring-1 ring-inset ring-files-cta"
              : isSelected
                ? "bg-files-surface-muted"
                : "hover:bg-files-surface-muted",
          )}
        >
          <TreeConnectors folders={folders} index={index} />

          <div
            style={{ paddingLeft: BASE_PADDING_PX + folder.depth * INDENT_PX }}
            className="relative flex min-w-0 flex-1 items-center gap-1 py-1.5"
          >
            {hasChildFolders ? (
              <button
                type="button"
                aria-label={
                  isCollapsed
                    ? `Expand ${folder.name}`
                    : `Collapse ${folder.name}`
                }
                aria-expanded={!isCollapsed}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapsed();
                }}
                className="flex size-4 shrink-0 items-center justify-center rounded-sm text-files-text-muted outline-none transition-colors hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta active:scale-[0.96]"
              >
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                    !isCollapsed && "rotate-90",
                  )}
                />
              </button>
            ) : (
              <span aria-hidden="true" className="size-4 shrink-0" />
            )}
            <FolderIcon
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0",
                isSelected ? "text-files-text" : "text-files-text-muted",
              )}
            />
            {isEditing ? (
              <>
                <input
                  autoFocus
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onBlur={exitEditing}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      exitEditing();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setValue(folder.name);
                      setIsEditing(false);
                    }
                  }}
                  aria-label={`Rename ${folder.name}`}
                  className="min-w-0 flex-1 rounded-lg border border-files-border-strong bg-files-surface px-2 py-0.5 text-product-body text-files-text outline-none focus-visible:border-files-cta"
                />
                <SaveIndicator state={status} />
              </>
            ) : (
              <button
                type="button"
                onClick={() => onSelectFolder(folder.id)}
                className="flex min-w-0 flex-1 items-center pl-1 text-left outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
              >
                <span
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setIsEditing(true);
                  }}
                  className={cn(
                    "truncate text-product-body",
                    isSelected ? "font-medium text-files-text" : "text-files-text",
                  )}
                >
                  {folder.name}
                </span>
              </button>
            )}
          </div>

          {!isEditing && (
            <>
              <span className="shrink-0 rounded-md bg-paper/[0.06] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-files-text-muted group-hover:hidden">
                {folder.fileCount}
              </span>
              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <button
                  type="button"
                  aria-label={`Add subfolder to ${folder.name}`}
                  onClick={onToggleAddChild}
                  className="flex size-6 items-center justify-center rounded-md text-files-text-muted outline-none hover:bg-files-surface hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${folder.name}`}
                  onClick={() => setIsEditing(true)}
                  className="flex size-6 items-center justify-center rounded-md text-files-text-muted outline-none hover:bg-files-surface hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
                >
                  <Pencil aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${folder.name}`}
                  onClick={() => onDeleteFolder(folder.id)}
                  className="flex size-6 items-center justify-center rounded-md text-files-text-muted outline-none hover:bg-files-surface hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </li>
      {isAddingChild && (
        <FolderCreateRow
          depth={folder.depth + 1}
          onSubmit={onCreateChild}
          onCancel={onToggleAddChild}
        />
      )}
    </>
  );
}

/**
 * Folders tab of the library sidebar. Renders the flat, DFS-ordered
 * `folders` array with indentation + ├─/└─ connector lines by depth; each row is
 * its own drop target for the files DnD wired up in files-product-view.
 * Folders with children fold/unfold via chevron; collapse state persists.
 */
export function FilesFolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: FilesFolderTreeProps) {
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [collapseRestored, setCollapseRestored] = useState(false);

  useEffect(() => {
    setCollapsedIds(getCollapsedFolderIds());
    setCollapseRestored(true);
  }, []);

  useEffect(() => {
    if (!collapseRestored) return;
    setCollapsedFolderIds(collapsedIds);
  }, [collapsedIds, collapseRestored]);

  // Keep the selected folder visible — expand any collapsed ancestors.
  useEffect(() => {
    if (!selectedFolderId || !collapseRestored) return;
    const ancestors = folderAncestorIds(folders, selectedFolderId);
    if (ancestors.length === 0) return;
    setCollapsedIds((current) => {
      let changed = false;
      const next = new Set(current);
      for (const id of ancestors) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : current;
    });
  }, [selectedFolderId, folders, collapseRestored]);

  function handleToggleCollapsed(folderId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  if (folders.length === 0) {
    return (
      <p className="px-2 py-1.5 text-product-meta text-files-text-muted">
        No folders yet.
      </p>
    );
  }

  const visible = visibleFolderEntries(folders, collapsedIds);

  return (
    <ul className="flex flex-col gap-0.5">
      {visible.map(({ folder, index }) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          folders={folders}
          index={index}
          isSelected={selectedFolderId === folder.id}
          isCollapsed={collapsedIds.has(folder.id)}
          isAddingChild={addingParentId === folder.id}
          onToggleCollapsed={() => handleToggleCollapsed(folder.id)}
          onToggleAddChild={() => {
            setCollapsedIds((current) => {
              if (!current.has(folder.id)) return current;
              const next = new Set(current);
              next.delete(folder.id);
              return next;
            });
            setAddingParentId((current) => (current === folder.id ? null : folder.id));
          }}
          onSelectFolder={onSelectFolder}
          onCreateChild={async (name) => {
            const ok = await onCreateFolder(name, folder.id);
            if (ok) setAddingParentId(null);
            return ok;
          }}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </ul>
  );
}
