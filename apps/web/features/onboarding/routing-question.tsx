"use client";

import { useEffect, useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { completeOnboardingRouting } from "@/app/onboarding/actions";
import {
  trackOnboardingRoutingSelected,
  trackOnboardingRoutingViewed,
  trackOnboardingWorkspaceSeeded,
} from "@/lib/analytics/onboarding-events";
import {
  ORGANIZING_ANSWERS,
  getStarterWorkspaceConfig,
  type OrganizingAnswer,
} from "@planevo/core/defaults/starter-workspaces";

export function RoutingQuestion() {
  const [selected, setSelected] = useState<OrganizingAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    trackOnboardingRoutingViewed();
  }, []);

  const handleSelect = (answer: OrganizingAnswer) => {
    if (isPending) return;
    setError(null);
    setSelected(answer);
    startTransition(async () => {
      const startedAt = Date.now();
      trackOnboardingRoutingSelected(answer);
      try {
        await completeOnboardingRouting(answer);
      } catch (cause) {
        if (isRedirectError(cause)) {
          trackOnboardingWorkspaceSeeded({
            organizing: answer,
            durationMs: Date.now() - startedAt,
          });
          throw cause;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Something went wrong. Please try again.",
        );
        setSelected(null);
      }
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <header className="text-center">
          <h1 className="text-h1">What are you organizing?</h1>
          <p className="mt-2 text-body text-text-secondary">
            Just a few more steps to unlock your new workspace
          </p>
        </header>

        <div
          role="group"
          aria-label="What are you organizing?"
          className="mt-10 grid gap-3 sm:grid-cols-2"
        >
          {ORGANIZING_ANSWERS.map((answer) => {
            const config = getStarterWorkspaceConfig(answer);
            const isSelected = selected === answer;

            return (
              <button
                key={answer}
                type="button"
                disabled={isPending}
                onClick={() => handleSelect(answer)}
                className={`flex min-h-28 flex-col items-start rounded-card border bg-surface-raised p-5 text-left outline-none transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-70 ${
                  isSelected
                    ? "border-marigold"
                    : "border-border hover:border-border-strong focus-visible:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                }`}
              >
                <span className="text-h2" aria-hidden>
                  {config.workspaceIcon}
                </span>
                <span className="mt-3 text-small font-medium">{config.cardLabel}</span>
                <span className="mt-1 text-small text-text-secondary">
                  {config.cardDescription}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-lg bg-brick-tint px-4 py-3 text-center text-small text-ink"
          >
            {error}
          </p>
        ) : null}

        {isPending ? (
          <p className="mt-6 text-center text-small text-text-muted">
            Setting up your workspace…
          </p>
        ) : null}
      </div>
    </main>
  );
}
