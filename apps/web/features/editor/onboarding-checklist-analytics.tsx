"use client";

import { useEffect, useRef } from "react";
import {
  ONBOARDING_TASK_TITLES,
  type OnboardingTaskKey,
} from "@planevo/core/defaults/getting-started-content";
import { trackOnboardingTaskCompleted } from "@/lib/analytics/onboarding-events";

function collectCheckedTitles(content: unknown): Set<string> {
  const titles = new Set<string>();
  if (!Array.isArray(content)) return titles;

  function walk(blocks: unknown[]) {
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      const row = block as {
        type?: string;
        props?: { checked?: boolean };
        content?: Array<{ text?: string }>;
        children?: unknown[];
      };
      if (row.type === "checkListItem" && row.props?.checked) {
        const text = (row.content ?? [])
          .map((part) => (typeof part.text === "string" ? part.text : ""))
          .join("")
          .trim();
        if (text) titles.add(text);
      }
      if (Array.isArray(row.children)) walk(row.children);
    }
  }

  walk(content);
  return titles;
}

const TITLE_TO_KEY = Object.entries(ONBOARDING_TASK_TITLES).reduce(
  (map, [key, title]) => {
    map.set(title, key as OnboardingTaskKey);
    return map;
  },
  new Map<string, OnboardingTaskKey>(),
);

/**
 * Watches Getting Started checklist toggles and fires onboarding_task_completed.
 */
export function OnboardingChecklistAnalytics({
  enabled,
  content,
}: {
  enabled: boolean;
  content: unknown;
}) {
  const previousChecked = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const checked = collectCheckedTitles(content);
    if (!hydrated.current) {
      previousChecked.current = checked;
      hydrated.current = true;
      return;
    }
    for (const title of checked) {
      if (previousChecked.current.has(title)) continue;
      const key = TITLE_TO_KEY.get(title);
      if (key) trackOnboardingTaskCompleted(key);
    }
    previousChecked.current = checked;
  }, [enabled, content]);

  return null;
}
