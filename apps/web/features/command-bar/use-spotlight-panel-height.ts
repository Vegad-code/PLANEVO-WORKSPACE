"use client";

import { useEffect, useRef } from "react";

/**
 * cmdk-style panel height (pacocoursey/cmdk — ResizeObserver + --cmdk-list-height).
 * Drives `--spotlight-panel-height` on the list wrapper for smooth expand/collapse.
 * Shell shape stays a single fixed radius — height alone morphs pill ↔ panel.
 */
export function useSpotlightPanelHeight(expanded: boolean) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const sizer = sizerRef.current;
    if (!wrapper || !sizer) return;

    let animationFrame = 0;

    const setHeight = () => {
      const height = expanded ? sizer.offsetHeight : 0;
      wrapper.style.setProperty("--spotlight-panel-height", `${height.toFixed(1)}px`);
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(setHeight);
    });

    observer.observe(sizer);
    setHeight();

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [expanded]);

  return { wrapperRef, sizerRef };
}
