import type { IconName } from "@/components/ui/planevo-icon";
import { Icon } from "@/components/ui/planevo-icon";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-card border border-dashed border-border-strong bg-surface-raised px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-paper text-text-secondary">
        <Icon name={icon} className="size-6" />
      </div>
      <h2 className="mt-5 text-h2">{title}</h2>
      <p className="mt-2 max-w-md text-body text-text-secondary">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
