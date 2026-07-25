"use client";

import { useCallback, useRef } from "react";
import type { IconName } from "@/components/ui/planevo-icon";
import { Icon } from "@/components/ui/planevo-icon";
import { cn } from "@/lib/utils";
import { isScopeActive, SPOTLIGHT_SCOPE_ITEMS, type SpotlightScope } from "./spotlight-scope";

type SpotlightScopeIconsProps = {
  activeScope: SpotlightScope | null;
  onScopeAction: (scope: SpotlightScope) => void;
};

export function SpotlightScopeIcons({
  activeScope,
  onScopeAction,
}: SpotlightScopeIconsProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

      event.preventDefault();
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[data-scope-index]',
      );
      if (!buttons || buttons.length === 0) return;

      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
    },
    [],
  );

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Search scope"
      className="relative z-20 flex shrink-0 gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 md:overflow-visible md:pb-0"
    >
      {SPOTLIGHT_SCOPE_ITEMS.map((item, index) => {
        const active = isScopeActive(activeScope, item.scope);
        return (
          <button
            key={item.scope}
            type="button"
            data-scope-index={index}
            aria-pressed={active}
            aria-label={`Search ${item.label} only`}
            title={`Search ${item.label} only`}
            onClick={(event) => {
              event.stopPropagation();
              onScopeAction(item.scope);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "spotlight-glass-icon flex size-11 shrink-0 snap-start items-center justify-center rounded-full outline-none transition-colors motion-reduce:transition-none",
              "focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
              "active:scale-[0.97]",
              active
                ? "bg-surface-raised/80 text-ink ring-1 ring-border"
                : "text-text-secondary hover:bg-surface-raised/40 hover:text-ink",
            )}
          >
            <Icon name={item.icon as IconName} className="size-5" />
          </button>
        );
      })}
    </div>
  );
}
