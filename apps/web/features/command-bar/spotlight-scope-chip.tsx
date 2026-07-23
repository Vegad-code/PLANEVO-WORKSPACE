"use client";

import { SPOTLIGHT_SCOPE_ITEMS, type SpotlightScope } from "./spotlight-scope";

type SpotlightScopeChipProps = {
  scope: SpotlightScope;
  onClear: () => void;
};

export function SpotlightScopeChip({ scope, onClear }: SpotlightScopeChipProps) {
  const label =
    SPOTLIGHT_SCOPE_ITEMS.find((item) => item.scope === scope)?.label ?? scope;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-label text-ink">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label} scope`}
        className="rounded-full px-0.5 text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-ink"
      >
        ×
      </button>
    </span>
  );
}
