#!/usr/bin/env node
/**
 * Demo-video director — routes a plan through capture and compose pipelines.
 *
 * Usage:
 *   node skills/demo-video/pipelines/director.mjs \
 *     --screen onboarding-create-task \
 *     --intent polished \
 *     --out artifacts/final/onboarding-create-task.mp4
 *
 *   node skills/demo-video/pipelines/director.mjs \
 *     --plan skills/demo-video/plans/onboarding-create-task.json
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowsComposeFallback,
  captureFallbackChain,
} from "../lib/decision-matrix.mjs";
import { mergePlan, parseCliArgs } from "../lib/resolve-plan.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const CAPTURE_MODULES = {
  "record-flow": "./capture-record-flow.mjs",
  clipwise: "./capture-clipwise.mjs",
  demowright: "./capture-demowright.mjs",
  auto_demo: "./capture-auto-demo.mjs",
};

const COMPOSE_MODULES = {
  remotion: "./compose-remotion.mjs",
};

/**
 * @param {string} relativePath
 */
async function tryImportPipeline(relativePath) {
  const moduleUrl = new URL(relativePath, import.meta.url).href;
  try {
    return await import(moduleUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Cannot find module") || message.includes("ERR_MODULE_NOT_FOUND")) {
      return null;
    }
    throw error;
  }
}

/**
 * @param {import('../lib/resolve-plan.mjs').DemoVideoPlan} plan
 */
async function runCaptureWithFallbacks(plan) {
  const chain = captureFallbackChain(plan.intent, plan.capture);
  let lastError = null;

  for (const pipeline of chain) {
    const modulePath = CAPTURE_MODULES[pipeline];
    if (!modulePath) continue;

    const mod = await tryImportPipeline(modulePath);
    if (!mod?.runCapture) {
      console.warn(`[director] capture pipeline "${pipeline}" not available — trying fallback.`);
      continue;
    }

    try {
      console.log(`[director] capture → ${pipeline}`);
      const result = await mod.runCapture({ ...plan, capture: pipeline });
      return { pipeline, result };
    } catch (error) {
      lastError = error;
      console.warn(`[director] capture "${pipeline}" failed:`, error);
    }
  }

  throw lastError ?? new Error(`No capture pipeline available for intent "${plan.intent}".`);
}

/**
 * @param {import('../lib/resolve-plan.mjs').DemoVideoPlan} plan
 * @param {string} inputPath
 */
async function runCompose(plan, inputPath) {
  if (plan.compose === "none") {
    mkdirSync(path.dirname(plan.out), { recursive: true });
    copyFileSync(inputPath, plan.out);
    return { pipeline: "none", out: plan.out };
  }

  const modulePath = COMPOSE_MODULES[plan.compose];
  const mod = modulePath ? await tryImportPipeline(modulePath) : null;

  if (!mod?.runCompose) {
    if (allowsComposeFallback(plan.intent)) {
      console.warn(
        `[director] compose "${plan.compose}" unavailable — falling back to polished capture only.`,
      );
      mkdirSync(path.dirname(plan.out), { recursive: true });
      copyFileSync(inputPath, plan.out);
      return { pipeline: "fallback-polished", out: plan.out };
    }
    throw new Error(`Compose pipeline "${plan.compose}" is not available.`);
  }

  console.log(`[director] compose → ${plan.compose} (${plan.composition})`);
  return mod.runCompose({ plan, inputPath, out: plan.out });
}

/**
 * @param {string[]} argv
 */
function parseArgv(argv) {
  const args = /** @type {Record<string, string | undefined>} */ ({});
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

async function main() {
  const rawArgs = parseArgv(process.argv.slice(2));
  const cli = parseCliArgs(rawArgs);

  /** @type {Record<string, unknown>} */
  let filePlan = {};
  if (cli.plan) {
    const planPath = path.isAbsolute(cli.plan)
      ? cli.plan
      : path.join(REPO_ROOT, cli.plan);
    filePlan = JSON.parse(readFileSync(planPath, "utf8"));
  }

  const plan = mergePlan(filePlan, cli);

  for (const dir of ["artifacts/raw", "artifacts/polished", "artifacts/final"]) {
    mkdirSync(path.join(REPO_ROOT, dir), { recursive: true });
  }

  console.log("[director] plan:", JSON.stringify({
    screen: plan.screen,
    intent: plan.intent,
    capture: plan.capture,
    compose: plan.compose,
    composition: plan.composition,
    platform: plan.platform,
    out: path.relative(REPO_ROOT, plan.out),
    notes: plan.notes,
  }, null, 2));

  const { pipeline: capturePipeline, result: captureResult } = await runCaptureWithFallbacks(plan);
  const captureOut = captureResult.out ?? plan.rawOut;

  const intermediate =
    capturePipeline === "record-flow" ? plan.rawOut : plan.polishedOut;
  if (captureOut !== intermediate && captureOut !== plan.rawOut) {
    mkdirSync(path.dirname(intermediate), { recursive: true });
    copyFileSync(captureOut, intermediate);
  }

  const composeResult = await runCompose(plan, captureOut);

  console.log("[director] done:", composeResult.out);
  return composeResult;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
