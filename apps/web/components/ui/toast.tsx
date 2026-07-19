"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type ToastTone = "default" | "error";
type ToastAction = { label: string; onClick: () => void };
export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

// Module-scope store: any client component can call `toast(...)`; the single
// mounted <Toaster/> subscribes and renders. Max 3 stacked, oldest dropped.
let counter = 0;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismiss(id: number): void {
  items = items.filter((item) => item.id !== id);
  emit();
}

export function toast(
  message: string,
  opts: { action?: ToastAction; tone?: ToastTone } = {},
): number {
  const item: ToastItem = {
    id: (counter += 1),
    message,
    tone: opts.tone ?? "default",
    action: opts.action,
  };
  items = [...items, item].slice(-3);
  emit();
  return item.id;
}

function ToastRow({ item }: { item: ToastItem }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // rAF defers the state flip out of the synchronous effect body so the
    // opacity transition actually plays on mount.
    const raf = requestAnimationFrame(() => setVisible(true));
    // Action-bearing toasts linger so the action stays reachable.
    const timeout = setTimeout(() => dismiss(item.id), item.action ? 8000 : 5000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [item.id, item.action]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg border px-4 py-3 text-body transition-opacity duration-200 motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0"
      } ${
        item.tone === "error"
          ? "border-brick bg-brick-tint text-ink"
          : "border-border bg-surface-raised text-ink"
      }`}
    >
      <span className="min-w-0 flex-1">{item.message}</span>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action!.onClick();
            dismiss(item.id);
          }}
          className="shrink-0 text-small font-medium text-ink underline underline-offset-2 outline-none hover:opacity-80 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}

/** Mount once, near the app root. Announces politely; stacks bottom-center. */
export function Toaster() {
  const current = useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {current.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  );
}
