"use client";

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
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import type { ViewSort } from "@planevo/core/views/view-config";
import { Icon } from "@/components/ui/planevo-icon";

const ROW_CLASS =
  "flex items-center gap-2 rounded-lg border border-border bg-paper px-2 py-1.5";

function SortRow({
  sort,
  propertyName,
}: {
  sort: ViewSort;
  propertyName: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `sort:${sort.property_id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={ROW_CLASS}
    >
      <button
        type="button"
        aria-label={`Reorder ${propertyName}`}
        className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon name="menu" className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-small">{propertyName}</span>
      <span className="text-label text-text-muted">{sort.direction === "asc" ? "A→Z" : "Z→A"}</span>
    </div>
  );
}

export function SortEditor({
  sorts,
  properties,
  onChange,
}: {
  sorts: ViewSort[];
  properties: DatabasePropertyRow[];
  onChange: (sorts: ViewSort[]) => void;
}) {
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id).replace(/^sort:/, "");
    const overId = String(over.id).replace(/^sort:/, "");
    const oldIndex = sorts.findIndex((sort) => sort.property_id === activeId);
    const newIndex = sorts.findIndex((sort) => sort.property_id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(sorts, oldIndex, newIndex));
  }

  function addSort(): void {
    const used = new Set(sorts.map((sort) => sort.property_id));
    const next = properties.find((property) => !used.has(property.id));
    if (!next) return;
    onChange([...sorts, { property_id: next.id, direction: "asc" }]);
  }

  return (
    <div className="flex w-72 flex-col gap-3 p-1">
      {sorts.length === 0 && (
        <p className="text-small text-text-muted">No sort order. Records keep their load order.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sorts.map((sort) => `sort:${sort.property_id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {sorts.map((sort) => (
              <div key={sort.property_id} className="flex flex-col gap-2">
                <SortRow
                  sort={sort}
                  propertyName={propertyById.get(sort.property_id)?.name ?? "Property"}
                />
                <div className="flex items-center gap-2 px-1">
                  <select
                    aria-label="Sort direction"
                    value={sort.direction}
                    onChange={(event) =>
                      onChange(
                        sorts.map((item) =>
                          item.property_id === sort.property_id
                            ? { ...item, direction: event.target.value as "asc" | "desc" }
                            : item,
                        ),
                      )
                    }
                    className="h-8 flex-1 rounded-md border border-border-strong bg-paper px-2 text-small outline-none focus:border-ink"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Remove sort"
                    onClick={() =>
                      onChange(sorts.filter((item) => item.property_id !== sort.property_id))
                    }
                    className="h-8 rounded-md px-2 text-small text-text-muted hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addSort}
        disabled={sorts.length >= properties.length}
        className="h-8 rounded-lg border border-border-strong px-3 text-left text-small font-medium text-text-secondary outline-none hover:border-ink hover:text-ink disabled:opacity-50"
      >
        Add sort
      </button>
    </div>
  );
}
