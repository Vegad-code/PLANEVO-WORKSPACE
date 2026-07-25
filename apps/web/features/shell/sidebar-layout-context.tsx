"use client"

import { createContext, useContext, useMemo } from "react"
import type { SidebarPreference } from "@planevo/core/state/sidebar-state"

export type SidebarLayoutContextValue = {
  preference: SidebarPreference
  spacerWidth: number
  isExpanded: boolean
  /**
   * True when primary preference is hidden — reserve left safe inset for the
   * reveal hamburger. Must stay true during peek so product rails (Library)
   * do not jump and re-trigger the edge hover loop.
   */
  showRevealChrome: boolean
}

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(
  null,
)

export function SidebarLayoutProvider({
  value,
  children,
}: {
  value: SidebarLayoutContextValue
  children: React.ReactNode
}) {
  const memoized = useMemo(
    () => value,
    [
      value.preference,
      value.spacerWidth,
      value.isExpanded,
      value.showRevealChrome,
    ],
  )

  return (
    <SidebarLayoutContext.Provider value={memoized}>
      {children}
    </SidebarLayoutContext.Provider>
  )
}

export function useSidebarLayout(): SidebarLayoutContextValue {
  const context = useContext(SidebarLayoutContext)
  if (!context) {
    throw new Error("useSidebarLayout must be used within SidebarLayoutProvider")
  }
  return context
}
