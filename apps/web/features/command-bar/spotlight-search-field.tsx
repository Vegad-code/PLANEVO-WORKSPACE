"use client";

import type { Ref } from "react";
import { Icon } from "@/components/ui/planevo-icon";
import { SpotlightScopeChip } from "./spotlight-scope-chip";
import type { SpotlightScope } from "./spotlight-scope";

type SpotlightSearchFieldProps = {
  inputId: string;
  listId: string;
  inputRef: Ref<HTMLInputElement>;
  value: string;
  expanded: boolean;
  activeScope: SpotlightScope | null;
  onClearScope: () => void;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

/** Glass pill search input for macOS-style Spotlight chrome. */
export function SpotlightSearchField({
  inputId,
  listId,
  inputRef,
  value,
  expanded,
  activeScope,
  onClearScope,
  onChange,
  onKeyDown,
}: SpotlightSearchFieldProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Icon name="search" className="size-5 shrink-0 text-text-secondary" />
      <label htmlFor={inputId} className="sr-only">
        Find anything
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Find anything…"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-h3 font-normal text-ink outline-none placeholder:text-text-muted"
        />
        {activeScope ? (
          <SpotlightScopeChip scope={activeScope} onClear={onClearScope} />
        ) : null}
      </div>
    </div>
  );
}
