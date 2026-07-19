/**
 * Onboarding funnel events (F-45). Prefer PostHog when `window.posthog` exists.
 * No PII — only organizing answer and task keys.
 */

type PostHogLike = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
};

function getPostHog(): PostHogLike | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { posthog?: PostHogLike }).posthog;
  return candidate && typeof candidate.capture === "function" ? candidate : null;
}

function capture(event: string, properties?: Record<string, unknown>): void {
  try {
    getPostHog()?.capture(event, properties);
  } catch {
    // Analytics must never break product flows.
  }
}

export function trackOnboardingRoutingViewed(): void {
  capture("onboarding_routing_viewed");
}

export function trackOnboardingRoutingSelected(organizing: string): void {
  capture("onboarding_routing_selected", { organizing });
}

export function trackOnboardingWorkspaceSeeded(input: {
  organizing: string;
  durationMs: number;
}): void {
  capture("onboarding_workspace_seeded", {
    organizing: input.organizing,
    duration_ms: input.durationMs,
  });
}

export function trackOnboardingTaskCompleted(taskKey: string): void {
  capture("onboarding_task_completed", { task_key: taskKey });
}
