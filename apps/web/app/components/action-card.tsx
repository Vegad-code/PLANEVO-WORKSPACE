import type { IconName } from "./planevo-icon";
import { Icon } from "./planevo-icon";

export function ActionCard({
  icon,
  title,
  description,
  action,
  variant = "default",
}: {
  icon: IconName;
  title: string;
  description: string;
  action: React.ReactNode;
  variant?: "default" | "ai";
}) {
  return (
    <article className={`flex min-h-64 flex-col rounded-card border p-4 ${variant === "ai" ? "border-slate bg-slate-tint" : "border-border bg-surface-raised"}`}>
      <div className="flex min-h-28 items-center justify-center rounded-xl border border-border bg-paper">
        <span className={`flex size-12 items-center justify-center rounded-xl border ${variant === "ai" ? "border-slate bg-slate-tint text-ink" : "border-border-strong bg-surface-raised text-text-secondary"}`}>
          <Icon name={icon} className="size-6" />
        </span>
      </div>
      <h2 className="mt-4 text-h3">{title}</h2>
      <p className="mt-1 flex-1 text-small text-text-secondary">{description}</p>
      <div className="mt-4">{action}</div>
    </article>
  );
}
