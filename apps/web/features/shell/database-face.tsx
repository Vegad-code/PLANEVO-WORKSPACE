import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import type { IconName } from "@/components/ui/planevo-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { DatabaseWorkspace } from "@/features/database/database-workspace";

type DatabaseFaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  bundle: DatabaseBundle | null;
  workspaceId: string;
  unavailable?: {
    icon: IconName;
    title: string;
    description: string;
  };
  empty: {
    icon: IconName;
    title: string;
    description: string;
    recreate: ReactNode;
  };
  headerAction?: ReactNode;
};

export function DatabaseFace({
  eyebrow,
  title,
  description,
  bundle,
  workspaceId,
  unavailable,
  empty,
  headerAction,
}: DatabaseFaceProps) {
  if (!workspaceId && unavailable) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <EmptyState
          icon={unavailable.icon}
          title={unavailable.title}
          description={unavailable.description}
        />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          action={empty.recreate}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label uppercase text-text-muted">{eyebrow}</p>
          <h1 className="mt-2 text-h1">{title}</h1>
          <p className="mt-2 text-body text-text-secondary">{description}</p>
        </div>
        {headerAction}
      </div>

      <div className="mt-8 min-h-0 flex-1">
        <Suspense fallback={<p className="text-small text-text-muted">Loading…</p>}>
          <DatabaseWorkspace bundle={bundle} />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-small text-text-muted">
        <Link href={`/databases/${bundle.database.id}`} className="hover:text-ink">
          Open full database
        </Link>
      </p>
    </div>
  );
}
