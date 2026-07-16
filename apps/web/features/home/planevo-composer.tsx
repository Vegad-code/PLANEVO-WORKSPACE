"use client";

import { useFormStatus } from "react-dom";
import { askPlanevo } from "@/app/(workspace)/home/actions";
import { Icon } from "@/components/ui/planevo-icon";

function ComposerSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Ask Planevo"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper outline-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 motion-reduce:transition-none"
    >
      <Icon name="arrow-right" className="size-4" />
    </button>
  );
}

export function PlanevoComposer() {
  return (
    <div className="w-full">
      <form
        action={askPlanevo}
        className="flex min-h-14 w-full items-center gap-3 rounded-card border border-border-strong bg-surface-raised px-4 transition-colors focus-within:border-ink motion-reduce:transition-none"
      >
        <Icon name="ai" className="size-5 shrink-0 text-slate" />
        <input
          name="content"
          required
          autoComplete="off"
          placeholder="Search, create, or ask Planevo…"
          className="h-14 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-muted"
        />
        <ComposerSubmit />
      </form>
      <p className="mt-2 text-center text-small text-text-muted">
        Asking opens a saved Planevo AI conversation. Everything here also works by hand.
      </p>
    </div>
  );
}
