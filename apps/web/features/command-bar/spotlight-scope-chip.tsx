"use client"

import { Badge } from "@/components/ui/badge"
import { SPOTLIGHT_SCOPE_ITEMS, type SpotlightScope } from "./spotlight-scope"

type SpotlightScopeChipProps = {
  scope: SpotlightScope
  onClear: () => void
}

export function SpotlightScopeChip({ scope, onClear }: SpotlightScopeChipProps) {
  const label =
    SPOTLIGHT_SCOPE_ITEMS.find((item) => item.scope === scope)?.label ?? scope

  return (
    <Badge variant="secondary">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label} scope`}
        className="rounded-full px-0.5 text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-ink"
      >
        ×
      </button>
    </Badge>
  )
}
