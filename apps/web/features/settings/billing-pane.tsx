import { SettingHeading } from "./setting-heading";

export type Plan = "free" | "plus" | "pro";

export function BillingSummary({ plan }: { plan: Plan }) {
  if (plan === "free") {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-body font-medium">Free</p>
            <p className="mt-1 text-small text-text-secondary">
              Your workspace is fully available. AI access resets on a rolling
              schedule.
            </p>
          </div>
          <span className="rounded-full border border-border-strong px-3 py-1 text-small">
            Current plan
          </span>
        </div>
      </div>
    );
  }

  const used = plan === "plus" ? 620 : 1840;
  const total = plan === "plus" ? 1500 : 5000;

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-body font-medium">
            {plan === "plus" ? "Plus" : "Pro"}
          </p>
          <p className="mt-1 text-small text-text-secondary">
            AI credits reset monthly.
          </p>
        </div>
        <span className="font-mono text-mono text-text-secondary">
          {used.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label={`${plan} credit use`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={used}
      >
        <div
          className={plan === "plus" ? "h-full w-2/5 bg-ink" : "h-full w-1/3 bg-ink"}
        />
      </div>
    </div>
  );
}

export function BillingPane({ plan }: { plan: Plan }) {
  return (
    <div>
      <SettingHeading
        title="Billing & credits"
        description="Your workspace stays complete on every plan. Paid plans add AI capacity."
      />
      <div className="mt-6">
        <BillingSummary plan={plan} />
      </div>
    </div>
  );
}
