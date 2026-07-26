"use client"

import { useEffect, useState } from "react"

const QUERY = "(prefers-reduced-transparency: reduce)"

export function usePrefersReducedTransparency(): boolean {
  const [prefersReducedTransparency, setPrefersReducedTransparency] =
    useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(QUERY)
    const update = () => setPrefersReducedTransparency(mediaQuery.matches)
    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  return prefersReducedTransparency
}
