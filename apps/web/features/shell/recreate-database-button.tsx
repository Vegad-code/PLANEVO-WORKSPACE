"use client";

import { useTransition } from "react";
import { Icon } from "@/components/ui/planevo-icon";

type RecreateDatabaseButtonProps = {
  label: string;
  onRecreate: () => Promise<void>;
};

export function RecreateDatabaseButton({
  label,
  onRecreate,
}: RecreateDatabaseButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => onRecreate())}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
    >
      <Icon name="plus" />
      {isPending ? "Creating…" : label}
    </button>
  );
}
