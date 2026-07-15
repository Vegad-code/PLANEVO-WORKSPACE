import Link from "next/link";
import type { HomeData } from "@/lib/queries/home";
import { createWorkspaceCalendar } from "@/app/(workspace)/calendar/actions";
import { ActionCard } from "./action-card";
import { Icon } from "./planevo-icon";
import { TaskComposer } from "./task-composer";
import { WorkspaceComposer } from "./workspace-composer";

const quietActionClass = "inline-flex h-8 items-center rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink";

export function HomeCommandCenter({ data }: { data: HomeData }) {
  const greeting = data.userName ? `Welcome back, ${data.userName}` : "Welcome to Planevo";
  const firstRun = data.state === "first-run" || data.recents.length === 0;

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className={firstRun ? "mx-auto w-full max-w-3xl" : "w-full"}>
        <p className="text-label uppercase text-text-muted">Home</p>
        <h1 className="mt-2 text-h1">{greeting}</h1>
        <p className="mt-2 text-body text-text-secondary">
          {firstRun ? "What would you like to make first?" : `Continue in ${data.workspaceName ?? "your workspace"}, or start something new.`}
        </p>
      </div>

      {!firstRun && (
        <section className="mt-9">
          <div className="flex items-center justify-between">
            <h2 className="text-label uppercase text-text-muted">Continue where you left off</h2>
            <span className="text-small text-text-muted">Real workspace activity</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.recents.map((item) => (
              <Link key={`${item.kind}:${item.id}`} href={item.href} className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-4 outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary"><Icon name={item.kind === "conversation" ? "ai" : item.kind === "file" ? "files" : "page"} /></span>
                <span className="min-w-0"><span className="block truncate text-small font-medium">{item.title}</span><span className="mt-1 block text-label capitalize text-text-muted">{item.kind}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={firstRun ? "mx-auto mt-9 w-full max-w-3xl" : "mt-9"}>
        <h2 className="text-label uppercase text-text-muted">Create</h2>
        <div className={`mt-3 grid gap-4 sm:grid-cols-2 ${firstRun ? "lg:grid-cols-3" : "lg:grid-cols-6"}`}>
          <ActionCard icon="tasks" title="New task" description="Capture the next thing that needs doing." action={<TaskComposer workspaceId={data.workspaceId} buttonLabel="Create task" appearance="quiet" />} />
          <ActionCard icon="calendar" title="New calendar" description="Create a calendar born with calendar, list, and table views." action={<form action={createWorkspaceCalendar}><input type="hidden" name="workspaceId" value={data.workspaceId ?? ""} /><button type="submit" className={quietActionClass}>Create calendar</button></form>} />
          <ActionCard icon="workspace" title="New workspace" description="Make another calm place for a different part of life." action={<WorkspaceComposer />} />
          <ActionCard icon="files" title="New file" description="Create a document, upload from your device, or import." action={<Link href="/files/new" className={quietActionClass}>Add file</Link>} />
          <ActionCard icon="page" title="Browse templates" description="Start balanced: template, blank, or describe it." action={<Link href="/templates" className={quietActionClass}>Browse templates</Link>} />
          <ActionCard icon="ai" title="Open Planevo AI" description="Ask across your workspace when you choose to." variant="ai" action={<Link href="/ai" className={quietActionClass}>Open Planevo AI</Link>} />
        </div>
      </section>

      <div className="mt-auto pt-10">
        <Link href="/search" className="flex min-h-14 w-full items-center gap-3 rounded-card border border-border-strong bg-surface-raised px-4 text-body text-text-muted outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">
          <Icon name="search" className="size-5" />
          <span>Create, find, or ask anything…</span>
          <span className="ml-auto hidden rounded-md border border-border bg-paper px-2 py-1 font-mono text-label sm:inline">⌘K</span>
        </Link>
      </div>
    </div>
  );
}
