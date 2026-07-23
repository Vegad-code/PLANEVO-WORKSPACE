import { Suspense } from "react";
import { MinimalModeSwitch, ThemeButtonGroup } from "@/components/ui/theme-controls";
import { NavItem } from "@/features/shell/nav-item";
import { MobileSidebar } from "@/features/shell/mobile-sidebar";
import { Sidebar } from "@/features/shell/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectField } from "@/components/ui/select";
import { ErrorState } from "@/components/ui/error-state";
import { Icon } from "@/components/ui/planevo-icon";
import { TaskComposer } from "@/features/tasks/task-composer";
import { FileEntry } from "@/features/files/file-entry";
import { HomeCommandCenter } from "@/features/home/home-command-center";
import { ActionCard } from "@/features/home/action-card";
import { PlanevoComposer } from "@/features/home/planevo-composer";
import { SidebarNewButton } from "@/features/shell/sidebar/sidebar-new-button";
import { LoginForm } from "../(auth)/login/login-form";
import {
  BillingSummary,
  IntegrationRow,
  SettingsPanel,
} from "@/features/settings/settings-dialog";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import type { DisplayRecord } from "@planevo/core/queries/record-display";
import { RecordBoard, RecordList } from "@/features/database/record-board";
import { MonthGrid } from "@/features/database/month-grid";
import { CommandBarPreview } from "./command-bar-preview";
import { DatabaseViewsPreview } from "./database-views-preview";
import { DeleteControlsPreview } from "./delete-controls-preview";
import { EditorPreview } from "./editor-preview";
import { OnboardingPreview } from "./onboarding-preview";
import { PageChromePreview } from "./page-chrome-preview";
import { RecordPeekPreview } from "./record-peek-preview";
import { RecordSurfacePreview } from "./record-surface-preview";
import { CalendarProductPreview } from "./calendar-product-preview";
import { FilesProductPreview } from "./files-product-preview";
import { TasksProductPreview } from "./tasks-product-preview";
import { WorkspacePreview } from "./workspace-preview";

/*
 * The kitchen sink (design-brief §6). Dev-only surface — every token rendered and
 * labeled. Light hex labels are Notion-caliber @theme defaults; dark hex labels
 * are the [data-theme="dark"] overrides in globals.css. Swatches respond live
 * to the theme / minimal-mode toggles.
 */

const DESIGN_PREVIEW_SHELL: WorkspaceShellData = {
  status: "ready",
  workspace: {
    id: "design-workspace",
    owner_id: "design-owner",
    name: "Anthony's workspace",
    icon: null,
    settings_json: {},
    created_at: "2026-07-14T00:00:00.000Z",
  },
  workspaces: [{ id: "design-workspace", name: "Anthony's workspace", icon: null }],
  pages: [
    { id: "design-physics", label: "Physics 2400", depth: 0, parentPageId: null, position: 0 },
    { id: "design-lab", label: "Lab notes", depth: 1, parentPageId: "design-physics", position: 1 },
    { id: "design-figures", label: "Figures", depth: 2, parentPageId: "design-lab", position: 2 },
    { id: "design-apps", label: "Apps tracker", depth: 0, parentPageId: null, position: 3 },
    { id: "design-launch", label: "Launch checklist", depth: 1, parentPageId: "design-apps", position: 4 },
    { id: "design-reading", label: "Reading list", depth: 0, parentPageId: null, position: 5 },
  ],
  userDisplayName: "Anthony",
  userInitials: "AP",
  userEmail: "anthony@example.com",
  memberCount: 1,
};

const DESIGN_RECORDS: DisplayRecord[] = [
  { id: "r1", title: "Draft the lab report", description: "Sections 2–4 with figures", status: "In progress", priority: "High", dueDate: "2026-07-18T18:00:00.000Z", estimateMinutes: 90, tags: ["school"] },
  { id: "r2", title: "Review launch checklist", description: null, status: "To do", priority: null, dueDate: "2026-07-21T09:00:00.000Z", estimateMinutes: null, tags: [] },
  { id: "r3", title: "Archive old references", description: "Keep only cited sources", status: "Blocked", priority: "Low", dueDate: null, estimateMinutes: 20, tags: ["cleanup"] },
  { id: "r4", title: "Untriaged idea", description: null, status: null, priority: null, dueDate: null, estimateMinutes: null, tags: [] },
];

const CORE = [
  { name: "paper", cls: "bg-paper", hex: "#FFFFFF", role: "App canvas background" },
  { name: "ink", cls: "bg-ink", hex: "#37352F", role: "Primary text, logo" },
  { name: "marigold", cls: "bg-marigold", hex: "#2383E2", role: "CTA / active — Notion blue" },
  { name: "brick", cls: "bg-brick", hex: "#E03E3E", role: "Destructive, errors" },
  { name: "meadow", cls: "bg-meadow", hex: "#0F7B6C", role: "Success, done" },
  { name: "slate", cls: "bg-slate", hex: "#6940A5", role: "The AI layer only" },
];

const DERIVED = [
  { name: "sidebar", cls: "bg-sidebar", hex: "#F7F6F3", role: "Sidebar surface" },
  { name: "surface-raised", cls: "bg-surface-raised", hex: "#F1F1EF", role: "Cards, popovers, callouts" },
  { name: "border", cls: "bg-border", hex: "rgba(55,53,47,0.09)", role: "Hairline dividers" },
  { name: "border-strong", cls: "bg-border-strong", hex: "rgba(55,53,47,0.16)", role: "Inputs, tables" },
  { name: "text-secondary", cls: "bg-text-secondary", hex: "#787774", role: "Body secondary" },
  { name: "text-muted", cls: "bg-text-muted", hex: "#9B9A97", role: "Metadata" },
];

/** Canonical dark values — Notion-caliber cool neutrals (globals.css). */
const DARK_CORE = [
  { name: "paper", cls: "bg-paper", hex: "#191919", role: "Canvas (unified with sidebar)" },
  { name: "ink", cls: "bg-ink", hex: "rgba(255,255,255,0.9)", role: "Primary text" },
  { name: "marigold", cls: "bg-marigold", hex: "#2383E2", role: "CTA / active — Notion blue" },
  { name: "brick", cls: "bg-brick", hex: "#FF7369", role: "Destructive, errors" },
  { name: "meadow", cls: "bg-meadow", hex: "#4DAB9A", role: "Success, done" },
  { name: "slate", cls: "bg-slate", hex: "#9A6DD7", role: "The AI layer only" },
];

const DARK_DERIVED = [
  { name: "sidebar", cls: "bg-sidebar", hex: "#191919", role: "Sidebar (unified with canvas)" },
  { name: "surface-raised", cls: "bg-surface-raised", hex: "#252525", role: "Cards, popovers, callouts" },
  { name: "border", cls: "bg-border", hex: "rgba(255,255,255,0.13)", role: "Hairline dividers" },
  { name: "border-strong", cls: "bg-border-strong", hex: "#373737", role: "Inputs, tables" },
  { name: "text-secondary", cls: "bg-text-secondary", hex: "#9B9B9B", role: "Body secondary" },
  { name: "text-muted", cls: "bg-text-muted", hex: "#6F6F6F", role: "Metadata" },
];

const DARK_TINTS = [
  { name: "marigold-tint", cls: "bg-marigold-tint", hex: "#364954" },
  { name: "meadow-tint", cls: "bg-meadow-tint", hex: "#354C4B" },
  { name: "brick-tint", cls: "bg-brick-tint", hex: "#594141" },
  { name: "slate-tint", cls: "bg-slate-tint", hex: "#443F57" },
];

const TINTS = [
  { name: "marigold-tint", cls: "bg-marigold-tint", hex: "#DDEBF1" },
  { name: "meadow-tint", cls: "bg-meadow-tint", hex: "#DDEDEA" },
  { name: "brick-tint", cls: "bg-brick-tint", hex: "#FBE4E4" },
  { name: "slate-tint", cls: "bg-slate-tint", hex: "#EAE4F2" },
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
  const blurb =
    theme === "dark"
      ? "Notion cool neutrals — canvas #191919, CTA #2383E2."
      : "Notion light — canvas #FFFFFF, sidebar #F7F6F3, CTA #2383E2.";

  return (
    <div
      data-theme={theme}
      data-minimal={minimal ? "" : undefined}
      className="w-48 rounded-xl border border-border bg-paper p-4 text-ink"
    >
      <p className="text-small font-medium">{label}</p>
      <p className="mt-1 text-small text-text-secondary">{blurb}</p>
      <div className="mt-4 flex gap-2">
        <span className="size-5 rounded-full bg-marigold" aria-label="Marigold" />
        <span className="size-5 rounded-full bg-brick" aria-label="Brick" />
        <span className="size-5 rounded-full bg-meadow" aria-label="Meadow" />
        <span className="size-5 rounded-full bg-slate" aria-label="Slate" />
      </div>
    </div>
  );
}

function DarkSwatchPanel({
  title,
  swatches,
}: {
  title: string;
  swatches: { name: string; cls: string; hex: string; role?: string }[];
}) {
  return (
    <div data-theme="dark" className="rounded-xl border border-border bg-paper p-4 text-ink">
      <p className="text-small font-medium text-text-secondary">{title}</p>
      <div className="mt-4 flex flex-wrap gap-6">
        {swatches.map((s) => (
          <Swatch key={s.name} {...s} />
        ))}
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
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ThemeButtonGroup />
          <MinimalModeSwitch />
        </div>
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
        <div className="mt-8 flex flex-col gap-6">
          <DarkSwatchPanel title="Dark core (Notion-caliber)" swatches={DARK_CORE} />
          <DarkSwatchPanel title="Dark derived neutrals" swatches={DARK_DERIVED} />
          <DarkSwatchPanel title="Dark status tints" swatches={DARK_TINTS} />
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
        <div className="flex w-sidebar flex-col gap-1 border border-border bg-sidebar py-2">
          <NavItem href="/" label="Home" icon="workspace" state="default" />
          <NavItem href="/tasks" label="Tasks" icon="tasks" state="hover" />
          <NavItem href="/calendar" label="Calendar" icon="calendar" state="active" />
          <NavItem href="/files" label="Files" icon="files" state="default" />
          <NavItem href="/ai" label="Planevo AI" icon="ai" state="ai" />
        </div>
      </Section>

      <Section title="Sidebar — minimal IA · expanded / empty tree / peek">
        <div className="flex flex-wrap items-start gap-8">
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">
              Expanded · Home / Tasks / Calendar / Files / Workspace tree
            </p>
            <div className="relative h-128 w-sidebar overflow-hidden border-y border-l border-border">
              <Sidebar shell={DESIGN_PREVIEW_SHELL} view="expanded" width={210} preview />
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">Empty workspace tree</p>
            <div className="relative h-128 w-sidebar overflow-hidden border-y border-l border-border">
              <Sidebar
                shell={{ ...DESIGN_PREVIEW_SHELL, pages: [] }}
                view="expanded"
                width={210}
                preview
              />
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">Hidden · hamburger</p>
            <div className="relative h-128 w-64 overflow-hidden border border-border bg-paper">
              <div className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-secondary">
                <Icon name="menu" className="size-4" />
              </div>
              <p className="absolute left-6 top-14 max-w-48 text-small text-text-muted">
                Floating three-line control on the canvas. Hover edge or click to peek.
              </p>
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">Inset peek · not full height</p>
            <div className="relative h-128 w-80 overflow-hidden border border-border bg-paper">
              <Sidebar shell={DESIGN_PREVIEW_SHELL} view="peek" width={240} preview />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Record peek — center / side">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">Center peek</p>
            <RecordPeekPreview record={DESIGN_RECORDS[0]!} mode="center" />
          </div>
          <div>
            <p className="mb-2 font-mono text-mono text-text-muted">Side peek</p>
            <RecordPeekPreview record={DESIGN_RECORDS[0]!} mode="side" />
          </div>
        </div>
      </Section>

      <Section title="Database views — tabs, config bar, table / board / list">
        <Suspense fallback={<p className="text-small text-text-muted">Loading database preview…</p>}>
          <DatabaseViewsPreview />
        </Suspense>
      </Section>

      <Section title="Record surface — page and peek variants">
        <RecordSurfacePreview />
      </Section>

      <Section title="Spotlight — account search, capture, modes">
        <CommandBarPreview />
      </Section>

      <Section title="Editor — slash, promote, icon / cover, mentions">
        <EditorPreview />
      </Section>

      <Section title="Onboarding — routing question (four cards)">
        <OnboardingPreview />
      </Section>

      <Section title="Page chrome — top bar, cover, breadcrumb">
        <PageChromePreview />
      </Section>

      <Section title="Tasks primitives — Button, Badge, Select">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Create task</Button>
          <Button variant="outline">Cancel</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="ink">Ink</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="high">High</Badge>
          <Badge variant="medium">Medium</Badge>
          <Badge variant="low">Low</Badge>
          <Badge variant="muted">Muted</Badge>
        </div>
        <div className="mt-4 max-w-xs">
          <SelectField label="Priority" defaultValue="medium">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </SelectField>
        </div>
      </Section>

      <Section title="Tasks product: task card states and board">
        <TasksProductPreview />
      </Section>

      <Section title="Calendar product: sidebar, today column, week grid">
        <CalendarProductPreview />
      </Section>

      <Section title="Files product: cabinet, table, storage meter">
        <FilesProductPreview />
      </Section>

      <Section title="Workspace — switcher, manage, faces">
        <WorkspacePreview />
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

      <Section title="Settings modal — all panes">
        <p className="mb-4 text-small text-text-secondary">
          Use the local navigation to review Account, Export, Integrations,
          Billing & credits, and Appearance.
        </p>
        <div className="h-128 overflow-hidden rounded-card border border-border">
          <SettingsPanel shell={DESIGN_PREVIEW_SHELL} plan="plus" />
        </div>
      </Section>

      <Section title="Settings integrations — disconnected / connected">
        <div className="overflow-hidden rounded-xl border border-border bg-surface-raised">
          <IntegrationRow id="gmail" connected={false} />
          <div className="border-t border-border" />
          <IntegrationRow id="google-calendar" connected />
        </div>
      </Section>

      <Section title="Billing summary — Free / Plus / Pro">
        <div className="grid gap-4 md:grid-cols-3">
          <BillingSummary plan="free" />
          <BillingSummary plan="plus" />
          <BillingSummary plan="pro" />
        </div>
      </Section>

      <Section title="Settings appearance — theme / minimal mode">
        <div className="h-128 overflow-hidden rounded-card border border-border">
          <SettingsPanel
            shell={DESIGN_PREVIEW_SHELL}
            initialSection="appearance"
          />
        </div>
      </Section>

      <Section title="Record board — configured, orphan, and no-status lanes">
        <RecordBoard
          records={DESIGN_RECORDS}
          statusOptions={["To do", "In progress", "In review", "Done"]}
        />
      </Section>

      <Section title="Record list — role-projected rows">
        <RecordList records={DESIGN_RECORDS} />
      </Section>

      <Section title="Month grid — dated records">
        <MonthGrid
          items={DESIGN_RECORDS.filter((record) => record.dueDate).map((record) => ({
            id: record.id,
            title: record.title,
            date: record.dueDate!,
          }))}
        />
      </Section>

      <Section title="Error state — load failure / not found">
        <div className="grid gap-4 lg:grid-cols-2">
          <ErrorState
            action={
              <button type="button" className="h-9 rounded-lg bg-ink px-4 text-small font-medium text-paper">
                Try again
              </button>
            }
          />
          <ErrorState
            title="Not found"
            description="This page doesn't exist or isn't part of your workspace."
          />
        </div>
      </Section>

      <Section title="Login — sign in / sign up card">
        <div className="mx-auto w-full max-w-sm rounded-card border border-border bg-surface-raised p-6">
          <LoginForm />
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

      <Section title="File entry — document / upload / import">
        <div className="rounded-xl border border-border bg-paper">
          <FileEntry workspaceId="design-workspace" />
        </div>
      </Section>

      <Section title="Delete controls — confirm dialog and destructive actions">
        <DeleteControlsPreview />
      </Section>

      <Section title="Home — Acme-layout launch hub (chips, greeting, cards, composer)">
        <div className="rounded-xl border border-border bg-paper">
          <HomeCommandCenter data={{ state: "first-run", workspaceId: null, workspaceName: null, userName: "Anthony", recents: [] }} />
        </div>
      </Section>

      <Section title="Home action card — link / form / button triggers">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard icon="page" title="Create new page" description="Start writing freely." href="/design" />
          <ActionCard icon="canvas" title="Open workspace" description="Build with pages, databases, and records." href="/design" />
          <ActionCard icon="calendar" title="Connect calendar" description="Bring dates into Planevo." href="/design" />
        </div>
      </Section>

      <Section title="Home composer — search, create, or ask Planevo">
        <div className="mx-auto max-w-2xl">
          <PlanevoComposer />
        </div>
      </Section>

      <Section title="Sidebar new button — split action with create menu">
        <div className="w-sidebar rounded-xl border border-border bg-sidebar pb-32 pt-1">
          <SidebarNewButton />
        </div>
      </Section>
    </main>
  );
}
