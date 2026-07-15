import { Icon } from "@/components/ui/planevo-icon";

export function ErrorState({
  title = "Something went wrong",
  description = "Planevo couldn't load this view. Your data is safe — try again.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-card border border-border bg-surface-raised px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-brick-tint text-ink">
        <Icon name="warning" className="size-6" />
      </div>
      <h2 className="mt-5 text-h2">{title}</h2>
      <p className="mt-2 max-w-md text-body text-text-secondary">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
