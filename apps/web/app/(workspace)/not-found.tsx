import Link from "next/link";
import { ErrorState } from "../components/error-state";

export default function WorkspaceNotFound() {
  return (
    <div className="mx-auto min-h-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <ErrorState
        title="Not found"
        description="This page doesn't exist or isn't part of your workspace."
        action={
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg bg-ink px-4 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Back home
          </Link>
        }
      />
    </div>
  );
}
