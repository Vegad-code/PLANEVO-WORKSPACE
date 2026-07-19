"use client";

const ROUTING_OPTIONS = [
  {
    id: "work",
    label: "Work",
    description: "Projects, clients, and professional goals",
    emoji: "💼",
  },
  {
    id: "personal",
    label: "Personal",
    description: "Life admin, habits, and home projects",
    emoji: "🏠",
  },
  {
    id: "school",
    label: "School",
    description: "Classes, assignments, and exams",
    emoji: "🎓",
  },
  {
    id: "other",
    label: "Something else",
    description: "Start with a flexible blank slate",
    emoji: "✨",
  },
] as const;

function RoutingCard({
  label,
  description,
  emoji,
  selected = false,
}: {
  label: string;
  description: string;
  emoji: string;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`flex w-full items-start gap-4 rounded-card border bg-surface-raised p-5 text-left outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
        selected
          ? "border-marigold"
          : "border-border hover:border-border-strong hover:bg-paper"
      }`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-paper text-h3">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium text-ink">{label}</span>
        <span className="mt-1 block text-small text-text-secondary">{description}</span>
      </span>
    </button>
  );
}

function RoutingQuestion({
  selectedId,
}: {
  selectedId?: (typeof ROUTING_OPTIONS)[number]["id"];
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-6 py-10">
      <div className="text-center">
        <h2 className="text-h2 text-ink">What are you organizing?</h2>
        <p className="mt-2 text-body text-text-secondary">
          Just a few more steps to unlock your new workspace
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {ROUTING_OPTIONS.map((option) => (
          <RoutingCard
            key={option.id}
            label={option.label}
            description={option.description}
            emoji={option.emoji}
            selected={option.id === selectedId}
          />
        ))}
      </div>
    </div>
  );
}

/** Kitchen-sink preview for onboarding step 1 — four routing cards, static. */
export function OnboardingPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="overflow-hidden rounded-card border border-border bg-paper">
        <p className="border-b border-border px-4 py-2 font-mono text-mono text-text-muted">
          Default · no selection
        </p>
        <RoutingQuestion />
      </div>
      <div className="overflow-hidden rounded-card border border-border bg-paper">
        <p className="border-b border-border px-4 py-2 font-mono text-mono text-text-muted">
          Selected · School (one marigold accent)
        </p>
        <RoutingQuestion selectedId="school" />
      </div>
    </div>
  );
}
