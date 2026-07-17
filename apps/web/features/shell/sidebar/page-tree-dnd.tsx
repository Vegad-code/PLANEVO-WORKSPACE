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
import {
  needsRebalance,
  positionBetween,
  rebalanced,
} from "@planevo/core/ordering/fractional";
import { reorderPage } from "@/app/(workspace)/pages/actions";
import { TreeNavItem } from "@/features/shell/sidebar/tree-nav-item";
import type { PageTreeItem } from "@/lib/queries/workspace-shell";

type PageTreeDndProps = {
  pages: PageTreeItem[];
  onNavigate?: () => void;
  /** Stable DndContext id — required when multiple sidebars mount (desktop + mobile). */
  dndId?: string;
};

type ReorderUpdate = {
  pageId: string;
  parentPageId: string | null;
  position: number;
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

function siblingIndices(pages: PageTreeItem[], parentPageId: string | null): number[] {
  const indices: number[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    if (resolveParentId(pages, i) === parentPageId) indices.push(i);
  }
  return indices;
}

function buildReorderUpdates(
  pages: PageTreeItem[],
  movedIndex: number,
  parentPageId: string | null,
): ReorderUpdate[] {
  const siblings = siblingIndices(pages, parentPageId);
  const siblingIndex = siblings.indexOf(movedIndex);
  if (siblingIndex < 0) return [];

  const previous =
    siblingIndex > 0 ? pages[siblings[siblingIndex - 1]!]!.position : null;
  const next =
    siblingIndex < siblings.length - 1
      ? pages[siblings[siblingIndex + 1]!]!.position
      : null;

  if (needsRebalance(previous, next)) {
    const positions = rebalanced(siblings.length);
    return siblings.map((pageIndex, index) => ({
      pageId: pages[pageIndex]!.id,
      parentPageId,
      position: positions[index]!,
    }));
  }

  return [
    {
      pageId: pages[movedIndex]!.id,
      parentPageId,
      position: positionBetween(previous, next),
    },
  ];
}

/** True when a later sibling exists at `depth` before the tree goes shallower. */
function spineContinuesAtDepth(
  pages: PageTreeItem[],
  index: number,
  depth: number,
): boolean {
  for (let i = index + 1; i < pages.length; i += 1) {
    const nextDepth = pages[i]!.depth;
    if (nextDepth < depth) return false;
    if (nextDepth === depth) return true;
  }
  return false;
}

function treeRowProps(pages: PageTreeItem[], index: number) {
  const page = pages[index]!;
  const ancestorSpines: boolean[] = [];
  for (let depth = 0; depth < page.depth; depth += 1) {
    ancestorSpines.push(spineContinuesAtDepth(pages, index, depth));
  }
  return {
    page,
    continueSpine: spineContinuesAtDepth(pages, index, page.depth),
    ancestorSpines,
  };
}

/** Static rows — used for SSR / pre-hydration so dnd-kit IDs cannot mismatch. */
function StaticPageTree({
  pages,
  onNavigate,
}: {
  pages: PageTreeItem[];
  onNavigate?: () => void;
}) {
  return (
    <>
      {pages.map((page, index) => {
        const { continueSpine, ancestorSpines } = treeRowProps(pages, index);
        return (
          <TreeNavItem
            key={page.id}
            pageId={page.id}
            label={page.label}
            depth={page.depth}
            continueSpine={continueSpine}
            ancestorSpines={ancestorSpines}
            onNavigate={onNavigate}
          />
        );
      })}
    </>
  );
}

function SortableTreeRow({
  page,
  continueSpine,
  ancestorSpines,
  onNavigate,
}: {
  page: PageTreeItem;
  continueSpine: boolean;
  ancestorSpines: boolean[];
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
        ancestorSpines={ancestorSpines}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export function PageTreeDnd({
  pages,
  onNavigate,
  dndId = "workspace-page-tree",
}: PageTreeDndProps) {
  const [items, setItems] = useState(pages);
  const [dndReady, setDndReady] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setItems(pages);
  }, [pages]);

  useEffect(() => {
    setDndReady(true);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((page) => page.id === active.id);
      const newIndex = items.findIndex((page) => page.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const nextItems = arrayMove(items, oldIndex, newIndex);
      const parentPageId = resolveParentId(nextItems, newIndex);
      const updates = buildReorderUpdates(nextItems, newIndex, parentPageId);

      setItems(nextItems);

      let failed = false;
      for (const update of updates) {
        const result = await reorderPage(update);
        if (!result.ok) {
          failed = true;
          break;
        }
      }

      if (failed) {
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

  if (!dndReady) {
    return <StaticPageTree pages={items} onNavigate={onNavigate} />;
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((page) => page.id)} strategy={verticalListSortingStrategy}>
        {items.map((page, index) => {
          const { continueSpine, ancestorSpines } = treeRowProps(items, index);
          return (
            <SortableTreeRow
              key={page.id}
              page={page}
              continueSpine={continueSpine}
              ancestorSpines={ancestorSpines}
              onNavigate={onNavigate}
            />
          );
        })}
      </SortableContext>
    </DndContext>
  );
}
