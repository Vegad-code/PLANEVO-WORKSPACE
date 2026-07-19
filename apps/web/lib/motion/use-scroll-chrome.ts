"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const TOP_OFFSET = 8;
const DELTA_THRESHOLD = 6;

type UseScrollChromeOptions = {
  enabled?: boolean;
};

/**
 * Notion / Linear / iOS-style chrome: hide on scroll down, reveal on scroll up.
 * Always visible when scrolled to the top.
 */
export function useScrollChrome(
  scrollRef: RefObject<HTMLElement | null>,
  { enabled = true }: UseScrollChromeOptions = {},
): boolean {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }

    const element = scrollRef.current;
    if (!element) return;

    lastScrollY.current = element.scrollTop;

    function updateVisibility() {
      ticking.current = false;
      const currentY = element!.scrollTop;
      const delta = currentY - lastScrollY.current;

      if (currentY <= TOP_OFFSET) {
        setVisible(true);
      } else if (delta > DELTA_THRESHOLD) {
        setVisible(false);
      } else if (delta < -DELTA_THRESHOLD) {
        setVisible(true);
      }

      lastScrollY.current = currentY;
    }

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(updateVisibility);
    }

    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [enabled, scrollRef]);

  return visible;
}

export const SHELL_TOP_BAR_HEIGHT_PX = 56;
