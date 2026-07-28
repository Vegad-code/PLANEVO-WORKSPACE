#!/usr/bin/env node
/**
 * Director capture adapter for auto_demo narrated demos.
 * Maps the unified `runCapture(plan)` contract to `runNarrated()` in narrate-autodemo.mjs.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNarrated } from "./narrate-autodemo.mjs";

const SKILL_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * @param {import('../lib/resolve-plan.mjs').DemoVideoPlan} plan
 */
export async function runCapture(plan) {
  const flow = path.join(SKILL_ROOT, "flows", `${plan.screen}.demo.json`);
  const out = plan.polishedOut;

  const result = await runNarrated({
    flow,
    out,
    url: plan.url,
    vertical: plan.platform === "vertical",
  });

  return { out: result.out, recording: result.recording, voice: result.voice };
}
