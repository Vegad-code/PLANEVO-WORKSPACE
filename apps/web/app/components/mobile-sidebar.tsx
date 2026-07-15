"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import type { MobileNavigationEvent } from "./navigation-state";
import { Sidebar } from "./sidebar";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DismissalType = Exclude<MobileNavigationEvent["type"], "open">;

export function MobileSidebar({
  open,
  shell,
  onDismiss,
  triggerRef,
  preview = false,
}: {
  open: boolean;
  shell: WorkspaceShellData;
  onDismiss?: (type: DismissalType) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  preview?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || preview) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef?.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open, preview, triggerRef]);

  if (!open) return null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss?.("escape");
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={`${preview ? "absolute" : "fixed md:hidden"} inset-0 z-50`}
      data-testid="mobile-sidebar"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation"
        onClick={() => onDismiss?.("overlay")}
        className="absolute inset-0 size-full bg-ink/30"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        onKeyDown={handleKeyDown}
        className="relative h-full w-sidebar bg-sidebar"
      >
        <Sidebar
          shell={shell}
          view="expanded"
          preview
          mobile
          headerButtonRef={closeRef}
          onToggle={() => onDismiss?.("close")}
          onNavigate={() => onDismiss?.("navigate")}
        />
      </div>
    </div>
  );
}
