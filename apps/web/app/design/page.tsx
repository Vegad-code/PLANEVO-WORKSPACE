import { MinimalToggle } from "./minimal-toggle";

/*
 * The kitchen sink (design-brief §6). Dev-only surface — every token rendered and
 * labeled. Hex labels show the canonical (non-minimal) values from globals.css;
 * the swatches themselves respond live to the minimal-mode toggle.
 */

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
    </main>
  );
}
