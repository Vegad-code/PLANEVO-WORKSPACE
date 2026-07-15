"use client";

import { useState } from "react";
import { createNamedWorkspace } from "@/app/(workspace)/home/actions";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/planevo-icon";

export function WorkspaceComposer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-2 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">
        Create workspace
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="workspace-composer-title" className="m-auto w-full max-w-md rounded-card border border-border bg-paper p-0 text-ink backdrop:bg-ink/30">
        <form action={createNamedWorkspace}>
          <div className="flex h-14 items-center justify-between border-b border-border px-5">
            <h2 id="workspace-composer-title" className="text-h3">Create workspace</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close workspace composer" className="flex size-8 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"><Icon name="close" /></button>
          </div>
          <div className="p-5">
            <label className="block">
              <span className="text-label uppercase text-text-muted">Workspace name</span>
              <input autoFocus required name="name" placeholder="My workspace" className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none placeholder:text-text-muted focus:border-ink" />
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
            <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-border-strong px-4 text-small font-medium outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">Cancel</button>
            <button type="submit" className="h-9 rounded-lg bg-ink px-4 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">Create workspace</button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
