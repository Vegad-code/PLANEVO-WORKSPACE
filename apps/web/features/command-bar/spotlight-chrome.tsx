"use client";

import type { ReactNode } from "react";
import { SpotlightScopeIcons } from "./spotlight-scope-icons";
import type { SpotlightScope } from "./spotlight-scope";
import { useSpotlightPanelHeight } from "./use-spotlight-panel-height";

type SpotlightChromeProps = {
  expanded: boolean;
  activeScope: SpotlightScope | null;
  onScopeAction: (scope: SpotlightScope) => void;
  searchField: ReactNode;
  results: ReactNode;
};

/**
 * macOS-style spotlight shell. One fixed corner radius (~half pill height) so the
 * bar reads as a pill when short and a soft panel when tall — only height animates.
 */
export function SpotlightChrome({
  expanded,
  activeScope,
  onScopeAction,
  searchField,
  results,
}: SpotlightChromeProps) {
  const { wrapperRef, sizerRef } = useSpotlightPanelHeight(expanded);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 md:flex-row md:items-start">
      <div
        data-expanded={expanded ? "true" : "false"}
        className="spotlight-glass-shell isolate min-w-0 w-full md:flex-1"
      >
        <div aria-hidden className="spotlight-glass-blur" />
        <div className="relative z-[1]">
          {searchField}
          <div
            ref={wrapperRef}
            className="spotlight-panel-list"
            data-expanded={expanded ? "true" : "false"}
            aria-hidden={!expanded}
          >
            <div ref={sizerRef} className="spotlight-panel-sizer border-t border-border/60">
              {results}
            </div>
          </div>
        </div>
      </div>

      <SpotlightScopeIcons activeScope={activeScope} onScopeAction={onScopeAction} />
    </div>
  );
}
