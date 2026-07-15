import { Icon } from "@/components/ui/planevo-icon";

const TEMPLATES = [
  { name: "Weekly planner", detail: "Tasks, priorities, and a week view." },
  { name: "Project launch", detail: "Milestones, workstreams, and decisions." },
  { name: "Course hub", detail: "Assignments, readings, and exam dates." },
  { name: "Reading library", detail: "Sources, notes, status, and topics." },
  { name: "Content calendar", detail: "Ideas, drafts, channels, and publish dates." },
  { name: "Client workspace", detail: "Projects, meetings, files, and follow-ups." },
  { name: "Personal admin", detail: "Life tasks, documents, and recurring dates." },
  { name: "Research tracker", detail: "Questions, evidence, sources, and findings." },
] as const;

export default function TemplatesPage() {
  return (
    <div className="mx-auto min-h-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <p className="text-label uppercase text-text-muted">Start your way</p>
      <h1 className="mt-2 text-h1">Templates</h1>
      <p className="mt-2 max-w-2xl text-body text-text-secondary">Choose a Planevo structure, start blank, or describe what you need. None is treated as the default.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <section className="rounded-card border border-border bg-surface-raised p-5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary"><Icon name="page" className="size-5" /></span>
          <h2 className="mt-4 text-h3">Template</h2>
          <p className="mt-2 text-small text-text-secondary">Pick a ready structure and make it yours.</p>
        </section>
        <section className="rounded-card border border-border bg-surface-raised p-5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary"><Icon name="document" className="size-5" /></span>
          <h2 className="mt-4 text-h3">Blank</h2>
          <p className="mt-2 text-small text-text-secondary">Begin with an empty page and no imposed system.</p>
        </section>
        <section className="rounded-card border border-slate bg-slate-tint p-5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-slate bg-paper text-text-secondary"><Icon name="ai" className="size-5" /></span>
          <h2 className="mt-4 text-h3">Describe it</h2>
          <p className="mt-2 text-small text-text-secondary">Explain the workspace, then edit its preview before confirming.</p>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-label uppercase text-text-muted">Planevo templates</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((template) => (
            <article key={template.name} className="rounded-card border border-border bg-surface-raised p-4">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary"><Icon name="workspace" /></span>
              <h3 className="mt-4 text-body font-medium">{template.name}</h3>
              <p className="mt-2 text-small text-text-secondary">{template.detail}</p>
              <p className="mt-5 text-label uppercase text-text-muted">Preview available next</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
