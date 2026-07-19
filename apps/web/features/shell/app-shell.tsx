"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { getShellLayoutTransition } from "@/lib/motion/shell-spring";
import {
  SHELL_TOP_BAR_HEIGHT_PX,
  useScrollChrome,
} from "@/lib/motion/use-scroll-chrome";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import { pageBreadcrumbLabels } from "@/lib/onboarding/page-breadcrumb";
import { MobileSidebar } from "@/features/shell/mobile-sidebar";
import {
  reduceMobileNavigation,
  type MobileNavigationEvent,
} from "@planevo/core/state/navigation-state";
import { Sidebar } from "@/features/shell/sidebar";
import { SidebarPeekTrigger } from "@/features/shell/sidebar/sidebar-peek-trigger";
import {
  createInitialSidebarState,
  getSidebarPresentation,
  matchesSidebarShortcut,
  normalizeSidebarPreference,
  normalizeSidebarWidth,
  PEEK_DELAY_MS,
  PREVENT_HOVER_MS,
  reduceSidebarState,
  type SidebarEvent,
  type SidebarState,
} from "@planevo/core/state/sidebar-state";
import { CommandBar } from "@/features/command-bar/command-bar";
import { createPageAndOpen } from "@/app/(workspace)/actions";
import { SettingsDialog } from "@/features/settings/settings-dialog";
import { TopBar } from "@/features/shell/top-bar";
import { SidebarLayoutProvider } from "@/features/shell/sidebar-layout-context";

const SIDEBAR_PREFERENCE_KEY = "planevo.sidebar.preference";
const SIDEBAR_WIDTH_KEY = "planevo.sidebar.width";
const DISMISS_PEEK_DELAY_MS = 100;
const PEEK_EXIT_MS = 200;

/** Product routes where scroll should reclaim vertical space (Notion / Linear pattern). */
const AUTO_HIDE_CHROME_PREFIXES = ["/tasks", "/calendar", "/files"];

function shouldAutoHideChrome(pathname: string): boolean {
  return AUTO_HIDE_CHROME_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AppShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: WorkspaceShellData;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();
  const shellLayoutTransition = getShellLayoutTransition(prefersReducedMotion);
  const [sidebarState, setSidebarState] = useState<SidebarState>(
    createInitialSidebarState(),
  );
  const [restored, setRestored] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [peekExiting, setPeekExiting] = useState(false);
  const [mobileNavigation, dispatchMobileNavigation] = useReducer(
    reduceMobileNavigation,
    { open: false },
  );
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekGuardUntil = useRef(0);
  const preventHoverUntil = useRef(0);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const topBarSettingsTrigger = useRef<HTMLButtonElement>(null);
  const settingsReturnFocus = useRef<HTMLElement | null>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const autoHideChrome = shouldAutoHideChrome(pathname);
  const topBarVisible = useScrollChrome(mainScrollRef, { enabled: autoHideChrome });

  const dispatch = useCallback((event: SidebarEvent) => {
    setSidebarState((state) => {
      const next = reduceSidebarState(state, event);
      if (
        event.type === "toggle" &&
        state.preference === "expanded" &&
        next.preference === "hidden"
      ) {
        preventHoverUntil.current = Date.now() + PREVENT_HOVER_MS;
      }
      return next;
    });
  }, []);

  const clearPeekTimer = useCallback(() => {
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  }, []);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
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
      setSidebarState(
        createInitialSidebarState(
          normalizeSidebarPreference(localStorage.getItem(SIDEBAR_PREFERENCE_KEY)),
          normalizeSidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_KEY)),
        ),
      );
      setRestored(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!restored) return;
    localStorage.setItem(SIDEBAR_PREFERENCE_KEY, sidebarState.preference);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarState.width));
  }, [restored, sidebarState.preference, sidebarState.width]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (matchesSidebarShortcut(event)) {
        event.preventDefault();
        clearPeekTimer();
        clearDismissTimer();
        dispatch({ type: "toggle" });
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandBarOpen(true);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createPageAndOpen();
      } else if (event.key === "Escape" && sidebarState.peeked) {
        clearPeekTimer();
        scheduleDismissPeek();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearDismissTimer,
    clearPeekTimer,
    dispatch,
    sidebarState.peeked,
  ]);

  useEffect(
    () => () => {
      clearPeekTimer();
      clearDismissTimer();
    },
    [clearDismissTimer, clearPeekTimer],
  );

  function canHoverPeek() {
    return (
      sidebarState.preference === "hidden" &&
      Date.now() >= preventHoverUntil.current
    );
  }

  function schedulePeek() {
    if (!canHoverPeek()) return;
    clearDismissTimer();
    setPeekExiting(false);
    if (sidebarState.peeked) return;
    clearPeekTimer();
    peekTimer.current = setTimeout(() => {
      dispatch({ type: "peek" });
      peekTimer.current = null;
    }, PEEK_DELAY_MS);
  }

  function keepPeek() {
    clearPeekTimer();
    clearDismissTimer();
    setPeekExiting(false);
    if (canHoverPeek() && !sidebarState.peeked) {
      dispatch({ type: "peek" });
    }
  }

  function openPeekNow() {
    clearPeekTimer();
    clearDismissTimer();
    setPeekExiting(false);
    if (sidebarState.preference === "hidden") {
      peekGuardUntil.current = Date.now() + PEEK_EXIT_MS + DISMISS_PEEK_DELAY_MS + 50;
      dispatch({ type: "peek" });
    }
  }

  function scheduleDismissPeek() {
    clearPeekTimer();
    clearDismissTimer();
    if (!sidebarState.peeked) return;
    if (Date.now() < peekGuardUntil.current) return;
    setPeekExiting(true);
    dismissTimer.current = setTimeout(() => {
      dispatch({ type: "dismiss-peek" });
      setPeekExiting(false);
      dismissTimer.current = null;
    }, PEEK_EXIT_MS + DISMISS_PEEK_DELAY_MS);
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

  const pageIdMatch = pathname.match(/^\/pages\/([^/]+)/);
  const pageBreadcrumb = pageIdMatch
    ? pageBreadcrumbLabels(shell.pages, pageIdMatch[1]!)
    : undefined;

  const sidebarPresentation = getSidebarPresentation(sidebarState);
  const isExpanded = sidebarPresentation.spacer === "expanded";
  const showEdgeTrigger = sidebarState.preference === "hidden";
  const showRevealButton =
    sidebarState.preference === "hidden" && !sidebarState.peeked;
  const showDesktopSidebar =
    sidebarPresentation.view === "expanded" || sidebarPresentation.view === "peek";

  const spacerWidth = isExpanded ? sidebarState.width : 0;
  const sidebarLayoutValue = useMemo(
    () => ({
      preference: sidebarState.preference,
      spacerWidth,
      isExpanded,
    }),
    [isExpanded, sidebarState.preference, spacerWidth],
  );

  return (
    <LayoutGroup id="app-shell-layout">
      <div className="flex h-dvh min-h-0 overflow-hidden bg-paper" data-testid="app-shell">
        <motion.div
          layout
          data-testid="sidebar-spacer"
          data-sidebar-preference={sidebarState.preference}
          animate={{ width: spacerWidth }}
          transition={shellLayoutTransition}
          style={
            {
              ["--sidebar-width" as string]: `${sidebarState.width}px`,
            } satisfies CSSProperties
          }
          className="relative hidden shrink-0 overflow-hidden md:block"
        >
          {showDesktopSidebar && sidebarPresentation.view === "expanded" && (
            <Sidebar
              shell={shell}
              view="expanded"
              width={sidebarState.width}
              onToggle={() => dispatch({ type: "toggle" })}
              onPin={() => dispatch({ type: "pin" })}
              onWidthChange={(nextWidth) =>
                dispatch({ type: "set-width", width: nextWidth })
              }
              onOpenSettings={() => openSettings()}
            />
          )}
        </motion.div>

      {showDesktopSidebar && sidebarPresentation.view === "peek" && (
        <Sidebar
          shell={shell}
          view="peek"
          width={sidebarState.width}
          peekExiting={peekExiting}
          onToggle={() => dispatch({ type: "toggle" })}
          onPin={() => dispatch({ type: "pin" })}
          onMouseEnter={keepPeek}
          onMouseLeave={scheduleDismissPeek}
          onFocusCapture={keepPeek}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              scheduleDismissPeek();
            }
          }}
          onOpenSettings={() => openSettings()}
        />
      )}

      <motion.div
        layout
        transition={shellLayoutTransition}
        className="flex min-w-0 flex-1 flex-col"
      >
        <motion.div
          layout
          animate={{
            height: topBarVisible || !autoHideChrome ? SHELL_TOP_BAR_HEIGHT_PX : 0,
            opacity: topBarVisible || !autoHideChrome ? 1 : 0,
          }}
          transition={shellLayoutTransition}
          className="shrink-0 overflow-hidden"
        >
          <TopBar
            breadcrumb={
              pageBreadcrumb && pageBreadcrumb.length > 0
                ? pageBreadcrumb
                : undefined
            }
            userDisplayName={shell.userDisplayName}
            userInitials={shell.userInitials}
            menuButtonRef={mobileMenuTrigger}
            settingsButtonRef={topBarSettingsTrigger}
            onOpenNavigation={() => dispatchMobileNavigation({ type: "open" })}
            onOpenSettings={() => openSettings()}
            navigationOpen={mobileNavigation.open}
            showSidebarReveal={showRevealButton}
          />
        </motion.div>
        <SidebarLayoutProvider value={sidebarLayoutValue}>
          <main
            ref={mainScrollRef}
            aria-label="Workspace canvas"
            className="min-h-0 flex-1 overflow-auto bg-paper"
          >
            {children}
          </main>
        </SidebarLayoutProvider>
      </motion.div>

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
      <CommandBar
        open={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        onOpenSettings={() => {
          setCommandBarOpen(false);
          openSettings();
        }}
      />

      {showEdgeTrigger && (
        <SidebarPeekTrigger
          showRevealButton={showRevealButton}
          onOpenPeek={openPeekNow}
          onSchedulePeek={schedulePeek}
          onScheduleDismissPeek={scheduleDismissPeek}
        />
      )}
      </div>
    </LayoutGroup>
  );
}
