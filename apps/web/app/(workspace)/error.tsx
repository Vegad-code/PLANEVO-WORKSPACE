"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto min-h-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <ErrorState
        action={
          <button
            type="button"
            onClick={reset}
            className="h-9 rounded-lg bg-ink px-4 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Try again
          </button>
        }
      />
    </div>
  );
}
