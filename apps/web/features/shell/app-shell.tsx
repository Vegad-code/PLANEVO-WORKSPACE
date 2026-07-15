"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import { MobileSidebar } from "@/features/shell/mobile-sidebar";
import {
  reduceMobileNavigation,
  type MobileNavigationEvent,
} from "@planevo/core/state/navigation-state";
import { Sidebar } from "@/features/shell/sidebar";
import {
  getSidebarPresentation,
  matchesSidebarShortcut,
  normalizeSidebarPreference,
  PEEK_DELAY_MS,
  reduceSidebarState,
  type SidebarEvent,
  type SidebarState,
} from "@planevo/core/state/sidebar-state";
import { SettingsDialog } from "@/features/settings/settings-dialog";
import { TopBar } from "@/features/shell/top-bar";

const SIDEBAR_STORAGE_KEY = "planevo.sidebar.preference";

export function AppShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: WorkspaceShellData;
}) {
  const [sidebarState, setSidebarState] = useState<SidebarState>({
    preference: "expanded",
    peeked: false,
  });
  const [restored, setRestored] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavigation, dispatchMobileNavigation] = useReducer(
    reduceMobileNavigation,
    { open: false },
  );
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const topBarSettingsTrigger = useRef<HTMLButtonElement>(null);
  const settingsReturnFocus = useRef<HTMLElement | null>(null);

  const dispatch = useCallback((event: SidebarEvent) => {
    setSidebarState((state) => reduceSidebarState(state, event));
  }, []);

  const clearPeekTimer = useCallback(() => {
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  }, []);

  const dismissMobileNavigation = useCallback(
    (type: Exclude<MobileNavigationEvent["type"], "open">) => {
      dispatchMobileNavigation({ type });
    },
    [],
  );

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      setSidebarState({
        preference: normalizeSidebarPreference(localStorage.getItem(SIDEBAR_STORAGE_KEY)),
        peeked: false,
      });
      setRestored(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (restored) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarState.preference);
    }
  }, [restored, sidebarState.preference]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (matchesSidebarShortcut(event)) {
        event.preventDefault();
        clearPeekTimer();
        dispatch({ type: "toggle" });
      } else if (event.key === "Escape" && sidebarState.peeked) {
        clearPeekTimer();
        dispatch({ type: "dismiss-peek" });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearPeekTimer, dispatch, sidebarState.peeked]);

  useEffect(() => clearPeekTimer, [clearPeekTimer]);

  function schedulePeek() {
    if (sidebarState.preference !== "rail" || sidebarState.peeked) return;
    clearPeekTimer();
    peekTimer.current = setTimeout(() => {
      dispatch({ type: "peek" });
      peekTimer.current = null;
    }, PEEK_DELAY_MS);
  }

  function dismissPeek() {
    clearPeekTimer();
    dispatch({ type: "dismiss-peek" });
  }

  function openSettings(returnFocus?: HTMLElement | null) {
    settingsReturnFocus.current =
      returnFocus ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : topBarSettingsTrigger.current);
    setSettingsOpen(true);
  }

  function handleSettingsOpenChange(nextOpen: boolean) {
    setSettingsOpen(nextOpen);
    if (nextOpen) return;

    window.requestAnimationFrame(() => {
      const returnTarget = settingsReturnFocus.current;
      if (returnTarget?.isConnected) {
        returnTarget.focus();
      } else {
        topBarSettingsTrigger.current?.focus();
      }
    });
  }

  const sidebarPresentation = getSidebarPresentation(sidebarState);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-paper" data-testid="app-shell">
      <div
        data-testid="sidebar-spacer"
        data-sidebar-preference={sidebarState.preference}
        className={`relative hidden shrink-0 transition-all duration-200 motion-reduce:transition-none md:block ${
          sidebarPresentation.spacer === "expanded" ? "w-sidebar" : "w-rail"
        }`}
      >
        <Sidebar
          shell={shell}
          view={sidebarPresentation.view}
          onToggle={() => dispatch({ type: "toggle" })}
          onPin={() => dispatch({ type: "pin" })}
          onMouseEnter={schedulePeek}
          onMouseLeave={dismissPeek}
          onFocusCapture={() => {
            clearPeekTimer();
            dispatch({ type: "peek" });
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) dismissPeek();
          }}
          onOpenSettings={() => openSettings()}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          userDisplayName={shell.userDisplayName}
          userInitials={shell.userInitials}
          menuButtonRef={mobileMenuTrigger}
          settingsButtonRef={topBarSettingsTrigger}
          onOpenNavigation={() => dispatchMobileNavigation({ type: "open" })}
          onOpenSettings={() => openSettings()}
          navigationOpen={mobileNavigation.open}
        />
        <main aria-label="Workspace canvas" className="min-h-0 flex-1 overflow-auto bg-paper">
          {children}
        </main>
      </div>

      <MobileSidebar
        open={mobileNavigation.open}
        shell={shell}
        onDismiss={dismissMobileNavigation}
        triggerRef={mobileMenuTrigger}
        onOpenSettings={() => {
          dispatchMobileNavigation({ type: "navigate" });
          openSettings(mobileMenuTrigger.current);
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        shell={shell}
        onOpenChange={handleSettingsOpenChange}
      />
    </div>
  );
}
