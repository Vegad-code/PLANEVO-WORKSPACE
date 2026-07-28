"use client";

import { Popover } from "radix-ui";
import { LayoutTemplate } from "lucide-react";
import type { DocumentEditorMode } from "@/lib/files/editor-prefs";

/**
 * Layout chooser for the document editor, rendered as labelled preview cards rather than three
 * bare icons — the mode changes how the whole screen is arranged, so it is worth showing rather
 * than describing. Native radios carry the arrow-key navigation and grouping semantics for free.
 */

const LAYOUTS: ReadonlyArray<{
  mode: DocumentEditorMode;
  label: string;
  /** Where the editor sits in the miniature window drawn on the card. */
  shape: string;
}> = [
  { mode: "full", label: "Full", shape: "inset-x-1 bottom-1 top-3" },
  { mode: "side", label: "Side", shape: "bottom-1 right-1 top-3 w-1/2" },
  { mode: "bottom", label: "Bottom", shape: "inset-x-1 bottom-1 h-1/2" },
];

function LayoutCard({
  mode,
  label,
  shape,
  selected,
  onSelect,
}: {
  mode: DocumentEditorMode;
  label: string;
  shape: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-2 rounded-lg border-2 bg-files-editor-solid p-2 outline-none ${
        selected
          ? "border-files-cta"
          : "border-files-border hover:border-files-border-strong"
      }`}
    >
      <input
        type="radio"
        name="document-editor-layout"
        value={mode}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className="relative block h-12 overflow-hidden rounded border border-files-border bg-files-surface-muted"
      >
        <span className="absolute left-1 top-1 flex gap-0.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1 rounded-full bg-files-border-strong"
            />
          ))}
        </span>
        <span
          className={`absolute rounded-sm bg-files-border-strong ${shape}`}
        />
      </span>
      <span className="text-center text-product-meta text-files-text">
        {label}
      </span>
    </label>
  );
}

export function DocumentLayoutPicker({
  mode,
  onModeChange,
}: {
  mode: DocumentEditorMode;
  onModeChange: (mode: DocumentEditorMode) => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Editor layout"
        title="Editor layout"
        className="files-editor-control flex size-8 items-center justify-center rounded-full text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text"
      >
        <LayoutTemplate aria-hidden="true" className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label="Editor layout"
          className="z-50 w-72 rounded-files-card border border-files-border bg-files-editor-solid p-4 shadow-files-bubble"
        >
          <p className="text-product-title text-files-text">Layout</p>
          <p className="mt-0.5 text-product-meta text-files-text-muted">
            Where this document sits on screen.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-files-card bg-files-surface-muted p-2">
            {LAYOUTS.map((layout) => (
              <LayoutCard
                key={layout.mode}
                {...layout}
                selected={mode === layout.mode}
                onSelect={() => onModeChange(layout.mode)}
              />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
