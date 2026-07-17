"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ViewRow } from "@planevo/core/types/database.types";
import {
  changeViewType,
  createView,
  deleteView,
  duplicateView,
  renameView,
  setDefaultView,
} from "@/app/(workspace)/databases/[databaseId]/view-actions";
import { Icon } from "@/components/ui/planevo-icon";
import { toast } from "@/components/ui/toast";
import { useOutsidePointer } from "./use-outside-pointer";

const VIEW_TYPES = [
  { type: "table", label: "Table" },
  { type: "board", label: "Board" },
  { type: "list", label: "List" },
  { type: "calendar", label: "Calendar" },
] as const;

function ViewTabMenu({
  databaseId,
  view,
  isLast,
  onRenamed,
}: {
  databaseId: string;
  view: ViewRow;
  isLast: boolean;
  onRenamed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(view.name);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useOutsidePointer(ref, open, () => setOpen(false));

  function run(action: () => Promise<{ ok: boolean; error?: string; viewId?: string }>): void {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast(result.error ?? "Something went wrong.", { tone: "error" });
        return;
      }
      setOpen(false);
      onRenamed();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`${view.name} options`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex size-7 items-center justify-center rounded-md text-text-muted outline-none hover:bg-paper/20 hover:text-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Icon name="menu" className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-paper py-1"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink"
            onClick={() => {
              setRenaming(true);
              setOpen(false);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isPending}
            className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink disabled:opacity-50"
            onClick={() => run(() => duplicateView({ databaseId, viewId: view.id }))}
          >
            Duplicate
          </button>
          {!view.is_default && (
            <button
              type="button"
              role="menuitem"
              disabled={isPending}
              className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink disabled:opacity-50"
              onClick={() => run(() => setDefaultView({ databaseId, viewId: view.id }))}
            >
              Set default
            </button>
          )}
          <div className="my-1 border-t border-border" />
          {VIEW_TYPES.map((item) => (
            <button
              key={item.type}
              type="button"
              role="menuitem"
              disabled={isPending || view.type === item.type}
              className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink disabled:opacity-50"
              onClick={() =>
                run(() => changeViewType({ databaseId, viewId: view.id, type: item.type }))
              }
            >
              Change to {item.label.toLowerCase()}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            disabled={isPending || isLast}
            className="flex h-9 w-full items-center px-3 text-left text-small text-brick hover:bg-brick-tint disabled:opacity-50"
            onClick={() => run(() => deleteView({ databaseId, viewId: view.id }))}
          >
            Delete
          </button>
        </div>
      )}
      {renaming && (
        <form
          className="absolute left-0 top-full z-50 mt-1 flex items-center gap-1 rounded-lg border border-border bg-paper p-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await renameView({ databaseId, viewId: view.id, name });
              if (!result.ok) {
                toast(result.error ?? "Couldn't rename the view.", { tone: "error" });
                return;
              }
              setRenaming(false);
              onRenamed();
            });
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 w-36 rounded-md border border-border-strong px-2 text-small outline-none focus:border-ink"
          />
          <button type="submit" className="h-8 rounded-md bg-ink px-2 text-small text-paper">
            Save
          </button>
        </form>
      )}
    </div>
  );
}

export function ViewTabs({
  databaseId,
  views,
  activeViewId,
}: {
  databaseId: string;
  views: ViewRow[];
  activeViewId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const addRef = useRef<HTMLDivElement>(null);

  useOutsidePointer(addRef, addOpen, () => setAddOpen(false));

  function selectView(viewId: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set("v", viewId);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function create(type: string): void {
    startTransition(async () => {
      const result = await createView({ databaseId, type });
      if (!result.ok || !result.viewId) {
        toast(result.error ?? "Couldn't create the view.", { tone: "error" });
        return;
      }
      setAddOpen(false);
      selectView(result.viewId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Database views" className="flex flex-wrap gap-1">
        {views.map((view) => {
          const active = view.id === activeViewId;
          return (
            <div
              key={view.id}
              className={`flex items-center gap-0.5 rounded-lg pr-1 ${
                active ? "bg-ink text-paper" : "text-text-secondary"
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectView(view.id)}
                className={`h-8 rounded-lg px-3 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                  active
                    ? "text-paper"
                    : "hover:bg-surface-raised hover:text-ink"
                }`}
              >
                {view.name}
                {view.is_default && (
                  <span className="ml-1.5 text-label opacity-70">Default</span>
                )}
              </button>
              <ViewTabMenu
                databaseId={databaseId}
                view={view}
                isLast={views.length <= 1}
                onRenamed={() => router.refresh()}
              />
            </div>
          );
        })}
      </div>

      <div ref={addRef} className="relative">
        <button
          type="button"
          aria-expanded={addOpen}
          disabled={isPending}
          onClick={() => setAddOpen((value) => !value)}
          className="h-8 rounded-lg border border-border-strong px-3 text-small font-medium text-text-secondary outline-none hover:border-ink hover:text-ink disabled:opacity-50"
        >
          + View
        </button>
        {addOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-paper py-1">
            {VIEW_TYPES.map((item) => (
              <button
                key={item.type}
                type="button"
                className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink"
                onClick={() => create(item.type)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
