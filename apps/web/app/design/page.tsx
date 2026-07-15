import { MinimalToggle } from "./minimal-toggle";
import { NavItem } from "../components/nav-item";
import { MobileSidebar } from "../components/mobile-sidebar";
import { Sidebar } from "../components/sidebar";
import { TopBar } from "../components/top-bar";
import { EmptyState } from "../components/empty-state";
import { TaskComposer } from "../components/task-composer";
import { CalendarView } from "../components/calendar-view";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";

/*
 * The kitchen sink (design-brief §6). Dev-only surface — every token rendered and
 * labeled. Hex labels show the canonical (non-minimal) values from globals.css;
 * the swatches themselves respond live to the minimal-mode toggle.
 */

const DESIGN_PREVIEW_SHELL: WorkspaceShellData = {
  status: "ready",
  workspace: {
    id: "design-workspace",
    owner_id: "design-owner",
    name: "Anthony's workspace",
    icon: null,
    created_at: "2026-07-14T00:00:00.000Z",
  },
  pages: [
    { id: "design-physics", label: "Physics 2400", depth: 0 },
    { id: "design-lab", label: "Lab notes", depth: 1 },
    { id: "design-apps", label: "Apps tracker", depth: 0 },
    { id: "design-launch", label: "Launch checklist", depth: 1 },
    { id: "design-reading", label: "Reading list", depth: 0 },
  ],
  userDisplayName: "Anthony",
  userInitials: "AP",
};

const CORE = [
  { name: "paper", cls: "bg-paper", hex: "#F5F3ED", role: "App canvas background" },
  { name: "ink", cls: "bg-ink", hex: "#1A1915", role: "Primary text, primary buttons" },
  { name: "marigold", cls: "bg-marigold", hex: "#E4A62F", role: "CTA / active — once per view" },
  { name: "brick", cls: "bg-brick", hex: "#D14B32", role: "Destructive, errors" },
  { name: "meadow", cls: "bg-meadow", hex: "#5E8A54", role: "Success, done" },
  { name: "slate", cls: "bg-slate", hex: "#93A9BB", role: "The AI layer only" },
];

const DERIVED = [
  { name: "sidebar", cls: "bg-sidebar", hex: "#EEEBE2", role: "Sidebar surface" },
  { name: "surface-raised", cls: "bg-surface-raised", hex: "#FBFAF6", role: "Inline cards, tables" },
  { name: "border", cls: "bg-border", hex: "#E4E0D6", role: "Hairline borders" },
  { name: "border-strong", cls: "bg-border-strong", hex: "#C3BDAF", role: "Inputs, checkboxes" },
  { name: "text-secondary", cls: "bg-text-secondary", hex: "#57534A", role: "Body secondary" },
  { name: "text-muted", cls: "bg-text-muted", hex: "#8A8578", role: "Metadata" },
];

const TINTS = [
  { name: "marigold-tint", cls: "bg-marigold-tint", hex: "#F7E7C9" },
  { name: "meadow-tint", cls: "bg-meadow-tint", hex: "#DBE8D7" },
  { name: "brick-tint", cls: "bg-brick-tint", hex: "#F5DAD3" },
  { name: "slate-tint", cls: "bg-slate-tint", hex: "#DEE6EC" },
];

const TYPE_STYLES = [
  { cls: "text-h1", name: "h1", spec: "27 / 500 / 1.2", sample: "Apps tracker" },
  { cls: "text-h2", name: "h2", spec: "20 / 500", sample: "This week's readings" },
  { cls: "text-h3", name: "h3", spec: "16 / 500", sample: "Properties and views" },
  { cls: "text-body", name: "body", spec: "14.5 / 400 / 1.6", sample: "Structure grows around your work instead of being demanded before it." },
  { cls: "text-small", name: "small", spec: "13 / 400", sample: "Edited 2 hours ago · 14 records" },
  { cls: "text-label uppercase", name: "label", spec: "11.5 / 500 / caps / +0.04em", sample: "Due date" },
  { cls: "text-mono font-mono", name: "mono", spec: "13 / 400 Geist Mono", sample: "⌘K · rec_8f3a · friday 6pm" },
];

const SPACING = [4, 8, 12, 16, 20, 24, 32, 40, 48];

const RADII = [
  { name: "rounded-lg (8)", cls: "rounded-lg", use: "Controls, buttons, inputs" },
  { name: "rounded-xl (12)", cls: "rounded-xl", use: "Inline cards" },
  { name: "rounded-card (14)", cls: "rounded-card", use: "Action cards" },
  { name: "rounded-full", cls: "rounded-full", use: "Pills, tabs" },
];

function Swatch({ name, cls, hex, role }: { name: string; cls: string; hex: string; role?: string }) {
  return (
    <div className="w-40">
      <div className={`h-20 rounded-xl border border-border ${cls}`} />
      <p className="mt-2 text-small font-medium">{name}</p>
      <p className="font-mono text-mono text-text-muted">--color-{name} · {hex}</p>
      {role && <p className="text-small text-text-secondary">{role}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-label uppercase text-text-muted border-b border-border pb-2">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function AppearancePreview({
  label,
  theme,
  minimal,
}: {
  label: string;
  theme: "light" | "dark";
  minimal: boolean;
}) {
  return (
    <div
      data-theme={theme}
      data-minimal={minimal ? "" : undefined}
      className="w-48 rounded-xl border border-border bg-paper p-4 text-ink"
    >
      <p className="text-small font-medium">{label}</p>
      <p className="mt-1 text-small text-text-secondary">Paper, ink, and independent accents.</p>
      <div className="mt-4 flex gap-2">
        <span className="size-5 rounded-full bg-marigold" aria-label="Marigold" />
        <span className="size-5 rounded-full bg-brick" aria-label="Brick" />
        <span className="size-5 rounded-full bg-meadow" aria-label="Meadow" />
        <span className="size-5 rounded-full bg-slate" aria-label="Slate" />
      </div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-4xl px-8 py-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1">Planevo design tokens</h1>
          <p className="mt-2 text-body text-text-secondary">
            Every value is provisional until it survives this page. Change globals.css, not components.
          </p>
        </div>
        <MinimalToggle />
      </div>

      <Section title="Core palette">
        <div className="flex flex-wrap gap-6">
          {CORE.map((s) => <Swatch key={s.name} {...s} />)}
        </div>
      </Section>

      <Section title="Appearance — light / dark / minimal-light / minimal-dark">
        <div className="flex flex-wrap gap-4">
          <AppearancePreview label="Light" theme="light" minimal={false} />
          <AppearancePreview label="Dark" theme="dark" minimal={false} />
          <AppearancePreview label="Minimal light" theme="light" minimal />
          <AppearancePreview label="Minimal dark" theme="dark" minimal />
        </div>
      </Section>

      <Section title="Derived neutrals">
        <div className="flex flex-wrap gap-6">
          {DERIVED.map((s) => <Swatch key={s.name} {...s} />)}
        </div>
      </Section>

      <Section title="Status tints">
        <div className="flex flex-wrap gap-6">
          {TINTS.map((s) => <Swatch key={s.name} {...s} />)}
        </div>
        <div className="mt-6 flex gap-3">
          <span className="rounded-full bg-marigold-tint px-3 py-1 text-small">In progress</span>
          <span className="rounded-full bg-meadow-tint px-3 py-1 text-small">Done</span>
          <span className="rounded-full bg-brick-tint px-3 py-1 text-small">Overdue</span>
          <span className="rounded-full bg-slate-tint px-3 py-1 text-small">Planevo AI</span>
        </div>
      </Section>

      <Section title="Type scale — General Sans, two weights (400/500)">
        <div className="space-y-6">
          {TYPE_STYLES.map((t) => (
            <div key={t.name} className="flex items-baseline gap-8">
              <p className="w-44 shrink-0 font-mono text-mono text-text-muted">{t.name} · {t.spec}</p>
              <p className={t.cls}>{t.sample}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing — 4px base">
        <div className="space-y-2">
          {SPACING.map((s) => (
            <div key={s} className="flex items-center gap-4">
              <span className="w-10 font-mono text-mono text-text-muted">{s}</span>
              <div className="h-4 bg-border-strong" style={{ width: s }} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radii">
        <div className="flex flex-wrap gap-6">
          {RADII.map((r) => (
            <div key={r.name} className="w-40">
              <div className={`h-20 border border-border bg-surface-raised ${r.cls}`} />
              <p className="mt-2 font-mono text-mono text-text-muted">{r.name}</p>
              <p className="text-small text-text-secondary">{r.use}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Flat elevation — border + surface-raised, never shadows">
        <div className="rounded-xl border border-border bg-surface-raised p-5">
          <p className="text-h3">A raised card</p>
          <p className="mt-1 text-small text-text-secondary">
            1px hairline border on a slightly lighter surface. No shadow, no gradient, no glow.
          </p>
        </div>
      </Section>

      <Section title="NavItem — default / hover / active / AI">
        <div className="w-sidebar space-y-1 border border-border bg-sidebar py-2">
          <NavItem href="/" label="Home" icon="workspace" state="default" />
          <NavItem href="/tasks" label="Tasks" icon="tasks" state="hover" />
          <NavItem href="/calendar" label="Calendar" icon="calendar" state="active" />
          <NavItem href="/ai" label="Planevo AI" icon="ai" state="ai" />
        </div>
      </Section>

      <Section title="TopBar — live identity / neutral settings">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <TopBar
              userDisplayName={DESIGN_PREVIEW_SHELL.userDisplayName}
              userInitials={DESIGN_PREVIEW_SHELL.userInitials}
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <TopBar breadcrumb={["Workspace", "Physics 2400", "Lab notes"]} />
          </div>
        </div>
      </Section>

      <Section title="Sidebar — expanded / icon rail / hover-peek">
        <div className="flex flex-wrap items-start gap-8">
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">Expanded · w-sidebar</p>
            <div className="relative h-128 w-sidebar overflow-hidden border-y border-l border-border">
              <Sidebar shell={DESIGN_PREVIEW_SHELL} view="expanded" preview />
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">Rail · w-rail</p>
            <div className="relative h-128 w-rail overflow-hidden border-y border-l border-border">
              <Sidebar shell={DESIGN_PREVIEW_SHELL} view="rail" preview />
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">Hover-peek · overlay</p>
            <div className="relative h-128 w-sidebar overflow-hidden border-y border-l border-border">
              <Sidebar shell={DESIGN_PREVIEW_SHELL} view="peek" preview />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Mobile navigation — open drawer">
        <div className="relative h-128 max-w-xl overflow-hidden rounded-xl border border-border bg-paper">
          <MobileSidebar
            open
            shell={DESIGN_PREVIEW_SHELL}
            preview
          />
        </div>
      </Section>

      <Section title="Empty state — task database">
        <EmptyState
          icon="tasks"
          title="Your task board is ready when you are"
          description="Create the first real task without sample rows or fabricated activity."
          action={<TaskComposer workspaceId={null} buttonLabel="Create first task" />}
        />
      </Section>

      <Section title="Task composer — Lumis-inspired full field set">
        <div className="rounded-xl border border-border bg-surface-raised p-5">
          <p className="text-body font-medium">Task composer</p>
          <p className="mt-1 text-small text-text-secondary">
            Title, description, status, priority, due date, estimate, tags, and attachment handoff.
          </p>
          <div className="mt-4">
            <TaskComposer workspaceId={null} buttonLabel="Open task composer" />
          </div>
        </div>
      </Section>

      <Section title="Workspace calendar — true empty state">
        <div className="h-screen overflow-auto rounded-xl border border-border">
          <CalendarView
            data={{
              status: "ready",
              workspaceId: "design-workspace",
              hasCalendarDatabase: true,
              items: [],
            }}
          />
        </div>
      </Section>
    </main>
  );
}
