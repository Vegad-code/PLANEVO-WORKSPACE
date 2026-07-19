"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useRowSelection(orderedIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<string | null>(null);
  const orderedRef = useRef(orderedIds);

  orderedRef.current = orderedIds;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, []);

  const toggleSelect = useCallback((recordId: string, shiftKey = false) => {
    const order = orderedRef.current;
    const index = order.indexOf(recordId);
    if (index < 0) return;

    if (shiftKey && anchorRef.current) {
      const anchorIndex = order.indexOf(anchorRef.current);
      if (anchorIndex >= 0) {
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);
        setSelectedIds((current) => {
          const next = new Set(current);
          for (let i = start; i <= end; i += 1) {
            next.add(order[i]!);
          }
          return next;
        });
        return;
      }
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
    anchorRef.current = recordId;
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='dialog']",
        )
      ) {
        return;
      }
      if (selectedIds.size === 0) return;
      event.preventDefault();
      clearSelection();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, selectedIds.size]);

  useEffect(() => {
    setSelectedIds((current) => {
      const idSet = new Set(orderedIds);
      const next = new Set([...current].filter((id) => idSet.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [orderedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelect,
    clearSelection,
  };
}
