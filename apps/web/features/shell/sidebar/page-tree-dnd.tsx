"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderPage } from "@/app/(workspace)/pages/actions";
import { TreeNavItem } from "@/features/shell/sidebar/tree-nav-item";
import type { PageTreeItem } from "@/lib/queries/workspace-shell";

type PageTreeDndProps = {
  pages: PageTreeItem[];
  onNavigate?: () => void;
};

function resolveParentId(pages: PageTreeItem[], index: number): string | null {
  const depth = pages[index]?.depth ?? 0;
  if (depth === 0) return null;

  for (let i = index - 1; i >= 0; i -= 1) {
    if (pages[i]!.depth === depth - 1) return pages[i]!.id;
    if (pages[i]!.depth < depth - 1) break;
  }

  return null;
}

function computeSiblingPosition(
  pages: PageTreeItem[],
  index: number,
  parentPageId: string | null,
): number {
  const siblings: { index: number; position: number }[] = [];

  for (let i = 0; i < pages.length; i += 1) {
    if (resolveParentId(pages, i) === parentPageId) {
      siblings.push({ index: i, position: pages[i]!.position });
    }
  }

  const siblingIndex = siblings.findIndex((entry) => entry.index === index);
  const previous = siblings[siblingIndex - 1]?.position;
  const next = siblings[siblingIndex + 1]?.position;

  if (previous === undefined && next === undefined) return 0;
  if (previous === undefined) return next! - 1;
  if (next === undefined) return previous + 1;
  return (previous + next) / 2;
}

function continueSpineForIndex(pages: PageTreeItem[], index: number): boolean {
  const page = pages[index];
  const next = pages[index + 1];
  return Boolean(next && next.depth >= page!.depth && page!.depth > 0);
}

function SortableTreeRow({
  page,
  continueSpine,
  onNavigate,
}: {
  page: PageTreeItem;
  continueSpine: boolean;
  onNavigate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TreeNavItem
        pageId={page.id}
        label={page.label}
        depth={page.depth}
        continueSpine={continueSpine}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export function PageTreeDnd({ pages, onNavigate }: PageTreeDndProps) {
  const [items, setItems] = useState(pages);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setItems(pages);
  }, [pages]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((page) => page.id === active.id);
      const newIndex = items.findIndex((page) => page.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const nextItems = arrayMove(items, oldIndex, newIndex);
      const parentPageId = resolveParentId(nextItems, newIndex);
      const position = computeSiblingPosition(nextItems, newIndex, parentPageId);

      setItems(nextItems);

      const result = await reorderPage({
        pageId: String(active.id),
        parentPageId,
        position,
      });

      if (!result.ok) {
        setItems(pages);
      }
    },
    [items, pages],
  );

  if (items.length === 0) {
    return (
      <p className="px-5 py-2 text-small text-text-muted">Your pages will appear here.</p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((page) => page.id)} strategy={verticalListSortingStrategy}>
        {items.map((page, index) => (
          <SortableTreeRow
            key={page.id}
            page={page}
            continueSpine={continueSpineForIndex(items, index)}
            onNavigate={onNavigate}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
