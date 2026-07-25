"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function CalendarError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-12">
      <ErrorState
        title="Could not load calendar"
        description="Your week view did not load. Try again, or come back in a moment."
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
    </section>
  );
}
